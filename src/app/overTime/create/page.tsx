'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CompensationType_STATUS, OverTimeKind_STATUS } from '@/i18n/overTime.vi';
import { UserWithOrganization } from "@/types";
import { Organization as OrganizationType } from "@/types/organization";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

type ObjectId = string;

enum OvertimeKind { WEEKDAY = 'WEEKDAY', WEEKEND = 'WEEKEND', HOLIDAY = 'HOLIDAY' }
enum CompensationType { PAY = 'PAY', TIME_OFF = 'TIME_OFF' }

type UserLite = { _id: ObjectId; fullName: string; email?: string };
type UploadFileLite = { _id: ObjectId; fileName: string; url?: string; size?: number };

type SegmentDraft = {
  date: string;         // YYYY-MM-DD (local)
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm (cho phép qua ngày -> nếu end < start coi là qua nửa đêm)
  kind?: OvertimeKind;  // tuỳ chọn, server có thể suy ra
  compensationOverride?: CompensationType;
};

const BASE = '/overtime-requests';

async function api(
  path: string,
  opts: { method?: string; query?: Record<string, any>; body?: any; headers?: Record<string, string> } = {},
) {
  const { method, query, body, headers } = opts;
  const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).reduce((a, [k, v]) => {
    if (v == null) return a;
    a[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return a;
  }, {} as Record<string, string>)).toString() : '';
  const res = await fetch(`${url}${qs}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}
const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });

function toISO(date: string, hm: string) {
  return new Date(`${date}T${hm}:00`).toISOString();
}
function fmtDT(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }

export default function OvertimeCreatePage() {
  const { data: users } = useSWR<UserWithOrganization[]>('/users/withOrganizationName', p => fetcher(p), { revalidateOnFocus: false });
  const { data: orgsData, error: orgsError, isLoading: isLoadingOrganizations } = useSWR<OrganizationType[]>(
    `/organizations/under`,
    (p) => fetcher(p),
    { revalidateOnFocus: false }
  );
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [userId, setUserId] = useState<string>('');
  const [compensation, setCompensation] = useState<CompensationType>(CompensationType.PAY);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [segments, setSegments] = useState<SegmentDraft[]>([
    { date: todayStr, startTime: '18:00', endTime: '21:00' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [createdDoc, setCreatedDoc] = useState<any | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(''); 
  const [nameFilter, setNameFilter] = useState<string>('');
  const EMPTY_USERS: UserWithOrganization[] = useMemo(() => [], []);
  const EMPTY_ORGS: OrganizationType[] = useMemo(() => [], []);

  const getAllSegmentsFromString = (fullString?: string) => {
    return fullString?.split('/').filter(Boolean) ?? [];
  };

  const usersData = users ?? EMPTY_USERS;
  const organizations = orgsData ?? EMPTY_ORGS;

  const filteredUsers = useMemo(() => {
    let userData = usersData;
    if (selectedOrganizationId) {
      userData = userData.filter(user => {
        const segments = getAllSegmentsFromString(user.organizationPath);
        segments.push(user.organizationId);
        return segments.includes(selectedOrganizationId);
      });
    }
    if (nameFilter) {
      const lowerCaseFilter = nameFilter.toLowerCase();
      userData = userData.filter(user => user.fullName.toLowerCase().includes(lowerCaseFilter));
    }
    return userData;
  }, [usersData, selectedOrganizationId, nameFilter]);

  const userMap = useMemo(() => new Map((usersData || []).map(u => [String(u._id), u])), [usersData]);

  function addSeg() {
    setSegments(s => [...s, { date: todayStr, startTime: '18:00', endTime: '21:00' }]);
  }
  function removeSeg(i: number) { setSegments(s => s.filter((_, idx) => idx !== i)); }
  function patchSeg(i: number, p: Partial<SegmentDraft>) {
    setSegments(s => { const n = [...s]; n[i] = { ...n[i], ...p }; return n; });
  }

  function buildPayload() {
    if (!userId) throw new Error('Chọn người tăng ca.');
    if (!segments.length) throw new Error('Thêm ít nhất 1 khoảng tăng ca.');
    const out = segments.map(s => {
      const startAt = toISO(s.date, s.startTime);
      // Nếu end < start => qua ngày +1
      let end = new Date(`${s.date}T${s.endTime}:00`);
      const st = new Date(startAt);
      if (end <= st) end = new Date(st.getTime() + 24 * 3600 * 1000 - (st.getHours() * 3600 * 1000 + st.getMinutes() * 60 * 1000)); // simpler: add 1 day if not later
      const endAt = end.toISOString();
      if (!(new Date(endAt) > st)) throw new Error('Khoảng giờ không hợp lệ.');
      return {
        startAt, endAt,
        ...(s.kind ? { kind: s.kind } : {}),
        ...(s.compensationOverride ? { compensationOverride: s.compensationOverride } : {}),
      };
    });
    return { userId, compensation, reason: reason || undefined, segments: out };
  }

  async function uploadAll(): Promise<string[]> {
    if (!files?.length) return [];
    const ids: string[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/upload-files', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload thất bại');
      const json: UploadFileLite = await res.json();
      ids.push(String(json._id));
    }
    return ids;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setMsg(''); setCreatedDoc(null);
    try {
      const payload = buildPayload();
      const attachmentIds = await uploadAll();
      const doc = await api(BASE, { method: 'POST', body: { ...payload, attachmentIds } });
      setCreatedDoc(doc);
      setMsg('Đã gửi đơn tăng ca.');
      setReason(''); setFiles(null); setSegments([{ date: todayStr, startTime: '18:00', endTime: '21:00' }]);
    } catch (err: any) {
      setMsg(err.message || 'Có lỗi.');
    } finally {
      setSubmitting(false);
    }
  };

  // In đơn (mở popup đồng bộ)
  function printDoc(useCreated: boolean) {
    const w = window.open('', '_blank', 'width=1024,height=768');
    if (!w) return alert('Trình duyệt chặn cửa sổ. Hãy cho phép pop-up.');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Đơn tăng ca</title></head><body>Đang chuẩn bị…</body></html>');
    w.document.close();

    const payload = useCreated && createdDoc ? {
      userId: String(createdDoc.userId?._id ?? createdDoc.userId),
      compensation: String(createdDoc.compensation),
      reason: createdDoc.reason,
      segments: createdDoc.segments || [],
      _id: String(createdDoc._id),
      createdAt: createdDoc.createdAt,
    } : buildPayload();

    const requester = (users || []).find(u => String(u._id) === String(payload.userId))?.fullName || String(payload.userId);
    const segRows = (payload.segments as any[]).map((s, i) => {
      return `<tr><td>${i + 1}</td><td>${fmtDT(s.startAt)} → ${fmtDT(s.endAt)}</td><td>${OverTimeKind_STATUS[s.kind] || ''}</td><td>${CompensationType_STATUS[s.compensationOverride] || ''}</td></tr>`;
    }).join('');

    const idLine = (useCreated && (payload as any)._id) ? `<div><b>Mã đơn:</b> ${(payload as any)._id}</div>` : '';
    const createdAt = (useCreated && (payload as any).createdAt) ? `<div><b>Ngày tạo:</b> ${fmtDT((payload as any).createdAt)}</div>` : '';

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>Đơn tăng ca</title>
      <style>
        body{font-family:ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial; padding:24px; color:#0f172a}
        .header{display:flex;justify-content:space-between;margin-bottom:16px}
        .title{font-size:18px;font-weight:700}
        .card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #e2e8f0;padding:8px;font-size:13px}
        th{background:#f8fafc;color:#475569;text-transform:uppercase;letter-spacing:.02em}
      </style></head><body>
      <div class="header">
        <div class="title">ĐƠN TĂNG CA</div>
        <div>
          ${idLine}
          ${createdAt}
          <div><b>Ngày in:</b> ${fmtDT(new Date().toISOString())}</div>
        </div>
      </div>
      <div class="card">
        <div><b>Người tăng ca:</b> ${requester}</div>
        <div><b>Hình thức tính công:</b> ${CompensationType_STATUS[payload.compensation]}</div>
        ${payload.reason ? `<div><b>Lý do:</b> ${payload.reason}</div>` : ''}
      </div>
      <div class="card">
        <div style="font-weight:600;margin-bottom:8px;">Các khoảng tăng ca</div>
        <table><thead><tr><th>#</th><th>Thời gian</th><th>Loại tăng ca</th><th>Theo đơn</th></tr></thead>
        <tbody>${segRows || `<tr><td colspan="4" style="text-align:center;color:#64748b;">(Không có)</td></tr>`}</tbody></table>
      </div>
      <script>setTimeout(()=>window.print(), 50)</script>
    </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tạo đơn tăng ca</h1>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="h-10 rounded-md border px-3 text-sm hover:bg-slate-50" onClick={() => printDoc(false)}>In (nháp)</button>
          {createdDoc && <button type="button" className="h-10 rounded-md border px-3 text-sm hover:bg-slate-50" onClick={() => printDoc(true)}>In đã tạo</button>}
        </div>
        
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Chọn Tổ Chức</label>
          <select
            value={selectedOrganizationId}
            onChange={(e) => setSelectedOrganizationId(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoadingOrganizations}
          >
            <option value="">Tất cả Tổ chức</option>
            {organizations.map((org) => (
              <option key={org._id} value={org._id}>{org.name}</option>
            ))}
          </select>
        </div>

        {/* Tên nhân viên */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Tìm Tên Nhân Viên</label>
          <input
            type="text"
            placeholder="Nhập tên nhân viên..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <Field label="Người tăng ca">
          <select className="h-10 rounded-md border px-3 text-sm" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">— Chọn —</option>
            {(filteredUsers || []).slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')).map(u => (
              <option key={u._id} value={String(u._id)}>{u.fullName}</option>
            ))}
          </select>
        </Field>

        <Field label="Hình thức tính công">
          <select className="h-10 rounded-md border px-3 text-sm" value={compensation} onChange={e => setCompensation(e.target.value as CompensationType)}>
            {Object.values(CompensationType).map(v => <option key={v} value={v}>{CompensationType_STATUS[v]}</option>)}
          </select>
        </Field>

        <Field label="Lý do">
          <textarea className="min-h-[80px] rounded-md border p-3 text-sm" value={reason} onChange={e => setReason(e.target.value)} />
        </Field>

        {/* Segments */}
        <div className="rounded-xl border p-3">
          <div className="mb-2 text-sm font-medium">Các khoảng tăng ca</div>
          <div className="grid gap-3">
            {segments.map((s, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="grid gap-3 md:grid-cols-5">
                  <Field label="Ngày">
                    <input type="date" className="h-10 w-full rounded-md border px-3 text-sm" value={s.date} onChange={e => patchSeg(i, { date: e.target.value })} />
                  </Field>
                  <Field label="Từ giờ">
                    <input type="time" className="h-10 w-full rounded-md border px-3 text-sm" value={s.startTime} onChange={e => patchSeg(i, { startTime: e.target.value })} />
                  </Field>
                  <Field label="Đến giờ">
                    <input type="time" className="h-10 w-full rounded-md border px-3 text-sm" value={s.endTime} onChange={e => patchSeg(i, { endTime: e.target.value })} />
                  </Field>
                  <Field label="Loại tăng ca (tuỳ chọn)">
                    <select className="h-10 w-full rounded-md border px-3 text-sm" value={s.kind || ''} onChange={e => patchSeg(i, { kind: e.target.value as OvertimeKind || undefined })}>
                      <option value="">(Auto)</option>
                      {Object.values(OvertimeKind).map(k => <option key={k} value={k}>{OverTimeKind_STATUS[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Comp Override">
                    <select className="h-10 w-full rounded-md border px-3 text-sm" value={s.compensationOverride || ''} onChange={e => patchSeg(i, { compensationOverride: e.target.value as CompensationType || undefined })}>
                      <option value="">(Theo đơn)</option>
                      {Object.values(CompensationType).map(k => <option key={k} value={k}>{CompensationType_STATUS[k]}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-2">
                  <button type="button" className="h-9 rounded-md border px-2 text-sm hover:bg-slate-50" onClick={() => removeSeg(i)}>Xoá</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button type="button" className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50" onClick={addSeg}>+ Thêm khoảng</button>
          </div>
        </div>

        <Field label="Tệp đính kèm">
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="block text-sm" />
        </Field>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={submitting} className="h-10 rounded-md bg-black px-4 text-sm text-white disabled:opacity-60">
            {submitting ? 'Đang gửi…' : 'Gửi đơn'}
          </button>
          {msg && <div className="text-sm text-slate-600">{msg}</div>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
