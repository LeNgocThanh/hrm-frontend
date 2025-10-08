'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {LeaveType, LeaveUnit} from '@/types/leave';
import { LT_STATUS, LT_UNIT, STATUS_OPTIONS_LT } from '@/i18n/leaveRequest.vi';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

// ====== Types tối thiểu dùng ở client ======
type ObjectId = string;

type UserLite = { _id: ObjectId; fullName: string; email?: string };
type UploadFileLite = { _id: ObjectId; fileName: string; url?: string; size?: number };

type SegmentDraft =
  | { unit: LeaveUnit.DAY; fromDate: string; toDate: string; singleDay?: boolean }
  | { unit: LeaveUnit.HALF_DAY; date: string; slot: 'AM' | 'PM' }
  | { unit: LeaveUnit.HOUR; date: string; startTime: string; endTime: string };

// ====== API helper ======
async function api(
  path: string,
  opts: { method?: string; query?: Record<string, any>; body?: any; headers?: Record<string, string> } = {},
) {
  const { method, query, body, headers } = opts;
  const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
  const qs = query
    ? '?' +
      new URLSearchParams(
        Object.entries(query).reduce((acc, [k, v]) => {
          if (v === undefined || v === null) return acc;
          acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return acc;
        }, {} as Record<string, string>),
      ).toString()
    : '';
  const res = await fetch(`${url}${qs}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API ${res.status}: ${t}`);
  }
  return res.json();
}
const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });

// ====== tiện ích thời gian (local -> ISO) ======
function toHM(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function toISO(dateStr: string, hm: string) {
  return new Date(`${dateStr}T${hm}:00`).toISOString();
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}
function fmtDT(d: string) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function CreateLeavePage() {
  // ====== load users ======
  const { data: users } = useSWR<UserLite[]>('/users/by-organization', (p) => fetcher(p), { revalidateOnFocus: false });
  const userMap = useMemo(()=> new Map((users||[]).map(u=>[String(u._id), u])), [users]);

  // ====== state form ======
  const [userId, setUserId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.PAID);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [createdDoc, setCreatedDoc] = useState<any | null>(null); // lưu doc sau khi tạo để in “bản chính”

  // Segments
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [segments, setSegments] = useState<SegmentDraft[]>([
    { unit: LeaveUnit.DAY, fromDate: todayStr, toDate: todayStr, singleDay: true },
  ]);

  function addSegment(kind: LeaveUnit) {
    if (kind === LeaveUnit.DAY) {
      setSegments((s) => [...s, { unit: LeaveUnit.DAY, fromDate: todayStr, toDate: todayStr, singleDay: true }]);
    } else if (kind === LeaveUnit.HALF_DAY) {
      setSegments((s) => [...s, { unit: LeaveUnit.HALF_DAY, date: todayStr, slot: 'AM' }]);
    } else {
      const start = new Date(today); start.setHours(9, 0, 0, 0);
      const end = new Date(today); end.setHours(12, 0, 0, 0);
      setSegments((s) => [
        ...s,
        { unit: LeaveUnit.HOUR, date: todayStr, startTime: toHM(start), endTime: toHM(end) },
      ]);
    }
  }
  function removeSegment(idx: number) {
    setSegments((s) => s.filter((_, i) => i !== idx));
  }
  function updateSegment<T extends SegmentDraft>(idx: number, patch: Partial<T>) {
    setSegments((s) => {
      const next = [...s];
      next[idx] = { ...(next[idx] as any), ...patch } as any;
      return next;
    });
  }
  // DAY: sync singleDay & from/to
  function syncDayRange(idx: number, next: { fromDate?: string; toDate?: string; singleDay?: boolean }) {
    setSegments((s) => {
      const cur = s[idx] as Extract<SegmentDraft, { unit: LeaveUnit.DAY }>;
      const from = next.fromDate ?? cur.fromDate;
      let to = next.singleDay ?? cur.singleDay ? from : (next.toDate ?? cur.toDate);
      if (new Date(to) < new Date(from)) to = from;
      const patch = { ...next, toDate: to } as Partial<SegmentDraft>;
      const arr = [...s];
      arr[idx] = { ...cur, ...patch } as SegmentDraft;
      return arr;
    });
  }

  // Upload helper
  async function handleUpload(): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/upload-files', { method: 'POST', body: fd, credentials: 'include', });
      if (!res.ok) throw new Error('Upload thất bại');
      const json: UploadFileLite = await res.json();
      ids.push(String(json._id));
    }
    return ids;
  }

  // Validate & build payload
  function buildPayload() {
    if (!userId) throw new Error('Chọn người nghỉ.');
    if (!Array.isArray(segments) || segments.length === 0) throw new Error('Thêm ít nhất 1 đoạn nghỉ.');

    const outSegments = segments.map((seg) => {
      if (seg.unit === LeaveUnit.DAY) {
        if (!seg.fromDate || !seg.toDate) throw new Error('DAY: thiếu fromDate/toDate.');
        if (new Date(seg.toDate) < new Date(seg.fromDate)) throw new Error('DAY: toDate phải >= fromDate.');
        return { unit: 'DAY', fromDate: seg.fromDate, toDate: seg.toDate };
      }
      if (seg.unit === LeaveUnit.HALF_DAY) {
        if (!seg.date || !seg.slot) throw new Error('HALF_DAY: thiếu date/slot.');
        return { unit: 'HALF_DAY', date: seg.date, slot: seg.slot };
      }
      if (!seg.date || !seg.startTime || !seg.endTime) throw new Error('HOUR: thiếu date/startTime/endTime.');
      const startAt = toISO(seg.date, seg.startTime);
      const endAt = toISO(seg.date, seg.endTime);
      if (!(new Date(endAt) > new Date(startAt))) throw new Error('HOUR: end phải sau start.');
      return { unit: 'HOUR', startAt, endAt };
    });

    return {
      userId,
      leaveType,
      reason: reason || undefined,
      segments: outSegments,
    };
  }

  // IN: render HTML rồi window.open + print
  function printRequest(w: Window, options?: { useCreated?: boolean }) {
  const useCreated = !!options?.useCreated && !!createdDoc;

  // Lấy payload
  const payload = useCreated
    ? {
        userId: String(createdDoc.userId?._id ?? createdDoc.userId),
        leaveType: String(createdDoc.leaveType),
        reason: createdDoc.reason,
        segments: createdDoc.segments || [],
        _id: String(createdDoc._id),
        createdAt: createdDoc.createdAt,
      }
    : (() => {
        // build từ form hiện tại (có thể throw nếu thiếu field)
        const p = buildPayload();
        return { ...p, _id: undefined, createdAt: undefined };
      })();

  const requester =
    userMap.get(payload.userId as string)?.fullName || (payload.userId as string);

  const segRows = (payload.segments as any[])
    .map((s: any, i: number) => {
      if (s.unit === 'DAY') {
        return `<tr><td>${i + 1}</td><td>DAY</td><td>${fmtDate(s.fromDate)} → ${fmtDate(s.toDate)}</td><td>${typeof s.hours === 'number' ? s.hours : ''}</td></tr>`;
      } else if (s.unit === 'HALF_DAY') {
        return `<tr><td>${i + 1}</td><td>HALF_DAY</td><td>${fmtDate(s.date)} (${s.slot})</td><td>${typeof s.hours === 'number' ? s.hours : ''}</td></tr>`;
      } else {
        return `<tr><td>${i + 1}</td><td>HOUR</td><td>${fmtDT(s.startAt)} → ${fmtDT(s.endAt)}</td><td>${typeof s.hours === 'number' ? s.hours : ''}</td></tr>`;
      }
    })
    .join('');

  const idLine = useCreated && payload._id ? `<div><b>Mã đơn:</b> ${payload._id}</div>` : '';
  const createdAt =
    useCreated && payload.createdAt
      ? `<div><b>Ngày tạo:</b> ${fmtDT(payload.createdAt as string)}</div>`
      : '';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Đơn nghỉ phép</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'; padding: 24px; color: #0f172a; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 16px; }
  .title { font-size: 18px; font-weight: 700; }
  .meta { font-size: 13px; color:#334155; }
  .card { border: 1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; vertical-align: top; }
  th { background: #f8fafc; text-transform: uppercase; letter-spacing: .02em; color:#475569; }
  .footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .sign { height: 100px; border:1px dashed #cbd5e1; border-radius:8px; padding:8px; color:#475569; }
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="title">ĐƠN NGHỈ PHÉP</div>
    <div class="meta">
      ${idLine}
      ${createdAt || ''}
      <div><b>Ngày in:</b> ${fmtDT(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="card">
    <div><b>Người nghỉ:</b> ${requester}</div>
    <div><b>Loại phép (đơn):</b> ${STATUS_OPTIONS_LT.find(option => option.value === payload.leaveType)?.label}</div>
    ${payload.reason ? `<div><b>Lý do:</b> ${payload.reason}</div>` : ''}
  </div>

  <div class="card">
    <div style="font-weight:600; margin-bottom:8px;">Các đoạn nghỉ</div>
    <table>
      <thead>
        <tr><th>#</th><th>Đơn vị</th><th>Thời gian</th><th>Giờ (nếu có)</th></tr>
      </thead>
      <tbody>${segRows || `<tr><td colspan="4" style="text-align:center;color:#64748b;">(Không có)</td></tr>`}</tbody>
    </table>
  </div>

  <div class="footer">
    <div class="sign"><b>Người làm đơn</b><br/><span style="font-size:12px;">(Ký & ghi rõ họ tên)</span></div>
    <div class="sign"><b>Người duyệt</b><br/><span style="font-size:12px;">(Ký & ghi rõ họ tên)</span></div>
  </div>

  <div class="no-print" style="margin-top:16px;">
    <button onclick="window.print()" style="padding:8px 12px;border:1px solid #0f172a;border-radius:8px;background:#0f172a;color:#fff;">In</button>
  </div>
  <script>window.print()</script>
</body>
</html>`;    
    
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setCreatedDoc(null);
    try {
      const payload = buildPayload();
      const attachmentIds = await handleUpload();
      const doc = await api('/leave-requests', {
        method: 'POST',
        body: { ...payload, attachmentIds },
      });
      setCreatedDoc(doc);
      setMessage('Đã gửi đơn nghỉ phép. Chờ duyệt.');
      setReason('');
      setFiles(null);
      setSegments([{ unit: LeaveUnit.DAY, fromDate: todayStr, toDate: todayStr, singleDay: true }]);
    } catch (err: any) {
      setMessage(err.message || 'Có lỗi xảy ra.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tạo đơn nghỉ phép</h1>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border bg-white p-4">
        {/* Hàng nút thao tác nhanh */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
      // Mở popup ĐỒNG BỘ theo yêu cầu
      const w = window.open('', '_blank', 'width=1024,height=768');
      if (!w) return alert('Trình duyệt chặn cửa sổ. Hãy cho phép pop-up.');
      // Ghi tạm nội dung chờ dựng xong
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Đơn nghỉ phép</title></head><body>Đang chuẩn bị nội dung…</body></html>');
      w.document.close();
      // Dựng và in
      printRequest(w, { useCreated: false });
    }}
            className="h-10 rounded-md border px-3 text-sm hover:bg-slate-50"
            title="In bản nháp theo dữ liệu đang nhập"
          >
            In đơn (nháp)
          </button>
          {createdDoc && (
            <button
              type="button"
             onClick={() => {
        const w = window.open('', '_blank', 'width=1024,height=768');
        if (!w) return alert('Trình duyệt chặn cửa sổ. Hãy cho phép pop-up.');
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Đơn nghỉ phép</title></head><body>Đang chuẩn bị nội dung…</body></html>');
        w.document.close();
        printRequest(w, { useCreated: true });
      }}
              className="h-10 rounded-md border px-3 text-sm hover:bg-slate-50"
              title="In bản đã tạo (kèm mã đơn)"
            >
              In đơn đã tạo
            </button>
          )}
        </div>

        {/* Người nghỉ */}
        <Field label="Người nghỉ">
          <select className="h-10 rounded-md border px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Chọn —</option>
            {(users || [])
              .slice()
              .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
              .map((u) => (
                <option key={u._id} value={String(u._id)}>
                  {u.fullName}
                </option>
              ))}
          </select>
        </Field>

        {/* Loại phép (nghiệp vụ) */}
        <Field label="Loại phép">
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
          >
            {Object.values(LeaveType).map((t) => (
              <option key={t} value={t}>
               {/* {STATUS_OPTIONS_LT.find(option => option.value === t)?.label} */}
               {LT_STATUS[t]}
              </option>
            ))}
          </select>
        </Field>

        {/* Lý do */}
        <Field label="Lý do">
          <textarea
            className="min-h-[80px] rounded-md border p-3 text-sm"
            placeholder="Nhập lý do…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {/* Segments builder */}
        <div className="rounded-xl border p-3">
          <div className="mb-2 text-sm font-medium">Các đoạn nghỉ</div>

          <div className="grid gap-3">
            {segments.map((seg, idx) => (
              <div key={idx} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border px-2 text-sm"
                    value={seg.unit}
                    onChange={(e) => {
                      const nextUnit = e.target.value as LeaveUnit;
                      if (nextUnit === LeaveUnit.DAY) {
                        updateSegment(idx, { unit: LeaveUnit.DAY, fromDate: todayStr, toDate: todayStr, singleDay: true });
                      } else if (nextUnit === LeaveUnit.HALF_DAY) {
                        updateSegment(idx, { unit: LeaveUnit.HALF_DAY, date: todayStr, slot: 'AM' });
                      } else {
                        const start = new Date(today); start.setHours(9, 0, 0, 0);
                        const end = new Date(today); end.setHours(12, 0, 0, 0);
                        updateSegment(idx, { unit: LeaveUnit.HOUR, date: todayStr, startTime: toHM(start), endTime: toHM(end) });
                      }
                    }}
                  >
                    {Object.values(LeaveUnit).map((u) => (
                      <option key={u} value={u}>
                        {LT_UNIT[u]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeSegment(idx)}
                    className="h-9 rounded-md border px-2 text-sm hover:bg-slate-50"
                  >
                    Xoá
                  </button>
                </div>

                {/* Fields theo unit */}
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {seg.unit === LeaveUnit.DAY && (
                    <>
                      <div className="md:col-span-3 flex items-center gap-3">
                        <input
                          id={`single-${idx}`}
                          type="checkbox"
                          className="h-4 w-4 border"
                          checked={!!seg.singleDay}
                          onChange={(e) => syncDayRange(idx, { singleDay: e.target.checked })}
                        />
                        <label htmlFor={`single-${idx}`} className="text-sm">Nghỉ đúng 1 ngày</label>
                        <span className="ml-auto text-xs text-slate-600">
                          {seg.singleDay || seg.fromDate === seg.toDate ? '≈ 1 ngày (8h)' : undefined}
                        </span>
                      </div>

                      <Field label="Từ ngày">
                        <input
                          type="date"
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={seg.fromDate}
                          onChange={(e) => syncDayRange(idx, { fromDate: e.target.value })}
                        />
                      </Field>

                      {!seg.singleDay && (
                        <Field label="Đến ngày">
                          <input
                            type="date"
                            className="h-10 w-full rounded-md border px-3 text-sm"
                            value={seg.toDate}
                            onChange={(e) => syncDayRange(idx, { toDate: e.target.value })}
                          />
                        </Field>
                      )}
                    </>
                  )}

                  {seg.unit === LeaveUnit.HALF_DAY && (
                    <>
                      <Field label="Ngày">
                        <input
                          type="date"
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={seg.date}
                          onChange={(e) => updateSegment(idx, { date: e.target.value } as any)}
                        />
                      </Field>
                      <Field label="Buổi">
                        <select
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={seg.slot}
                          onChange={(e) => updateSegment(idx, { slot: e.target.value as 'AM' | 'PM' } as any)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </Field>
                    </>
                  )}

                  {seg.unit === LeaveUnit.HOUR && (
                    <>
                      <Field label="Ngày">
                        <input
                          type="date"
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={seg.date}
                          onChange={(e) => updateSegment(idx, { date: e.target.value } as any)}
                        />
                      </Field>
                      <Field label="Từ giờ">
                        <input
                          type="time"
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={seg.startTime}
                          onChange={(e) => updateSegment(idx, { startTime: e.target.value } as any)}
                        />
                      </Field>
                      <Field label="Đến giờ">
                        <input
                          type="time"
                          className="h-10 w-full rounded-md border px-3 text-sm"
                          value={seg.endTime}
                          onChange={(e) => updateSegment(idx, { endTime: e.target.value } as any)}
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => addSegment(LeaveUnit.DAY)} className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50">
              + Thêm đoạn (DAY)
            </button>
            <button type="button" onClick={() => addSegment(LeaveUnit.HALF_DAY)} className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50">
              + Thêm đoạn (HALF_DAY)
            </button>
            <button type="button" onClick={() => addSegment(LeaveUnit.HOUR)} className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50">
              + Thêm đoạn (HOUR)
            </button>
          </div>
        </div>

        {/* File đính kèm */}
        <Field label="Tệp đính kèm">
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="block text-sm" />
        </Field>

        {/* Submit + message */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={submitting} className="h-10 rounded-md bg-black px-4 text-sm text-white disabled:opacity-60">
            {submitting ? 'Đang gửi…' : 'Gửi đơn'}
          </button>
          {message && <div className="text-sm text-slate-600">{message}</div>}
        </div>
      </form>
    </div>
  );
}

// ====== UI helper ======
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
