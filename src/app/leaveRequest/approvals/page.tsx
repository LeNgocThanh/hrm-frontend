'use client';

import { useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api/room-meetings';
import {LeaveType, LeaveUnit} from '@/types/leave'
import { LT_STATUS, LT_UNIT, STATUS_OPTIONS_LT, LR_STATUS, LEAVE_STATUS_OPTIONS } from '@/i18n/leaveRequest.vi';

// =======================
// Types & helpers
// =======================
type ObjectId = string;
type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';

type UserLite = { _id: ObjectId; fullName: string; email?: string };

type Segment =
  | { unit: LeaveUnit.DAY; fromDate: string; toDate: string; hours?: number; leaveTypeOverride?: LeaveType }
  | { unit: LeaveUnit.HALF_DAY; date: string; slot: 'AM' | 'PM'; hours?: number; leaveTypeOverride?: LeaveType }
  | { unit: LeaveUnit.HOUR; startAt: string; endAt: string; hours?: number; leaveTypeOverride?: LeaveType };

type LeaveRequest = {
  _id: ObjectId;
  userId: ObjectId | { _id: ObjectId; fullName?: string; email?: string };
  reviewerId?: ObjectId | { _id: ObjectId; fullName?: string; email?: string };
  leaveType: LeaveType | string; // loại mặc định của đơn
  segments: Segment[];
  totalHours?: number;
  status: Status | string;
  reason?: string;
  attachmentIds?: ObjectId[];
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

// API helper
const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });
async function fetchList<T = any>(path: string, query?: Record<string, any>): Promise<T[]> {
  const data = await fetcher(path, query);
  return Array.isArray(data) ? data : (data?.items ?? []);
}

// utils
function normalizeUserId(userField: any): string {
  if (typeof userField === 'string') return userField;
  if (userField && typeof userField === 'object') return String((userField as any)._id ?? '');
  return '';
}
function resolveUserLabel(userField: any, userMap: Map<string, UserLite>): string {
  if (typeof userField === 'string') return userMap.get(userField)?.fullName || userField;
  if (userField && typeof userField === 'object') {
    const id = (userField as any)._id ? String((userField as any)._id) : '';
    return (userField as any).fullName || userMap.get(id)?.fullName || id;
  }
  return String(userField ?? '');
}
function calcHours(seg: Segment): number {
  if (typeof (seg as any).hours === 'number') return (seg as any).hours!;
  if (seg.unit === LeaveUnit.DAY) return 8; // fallback nếu server chưa tính
  if (seg.unit === LeaveUnit.HALF_DAY) return (seg as any).slot === 'AM' ? 4 : 4;
  if (seg.unit === LeaveUnit.HOUR) {
    const ms = +new Date((seg as any).endAt) - +new Date((seg as any).startAt);
    return Math.max(0, ms / 3_600_000);
  }
  return 0;
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}
function fmtDT(d: string) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}
function segLabel(seg: Segment): string {
  if (seg.unit === LeaveUnit.DAY) {
    const s = seg as Extract<Segment, { unit: LeaveUnit.DAY }>;
    return `DAY: ${fmtDate(s.fromDate)} → ${fmtDate(s.toDate)}`;
  }
  if (seg.unit === LeaveUnit.HALF_DAY) {
    const s = seg as Extract<Segment, { unit: LeaveUnit.HALF_DAY }>;
    return `HALF_DAY: ${fmtDate(s.date)} (${s.slot})`;
  }
  const s = seg as Extract<Segment, { unit: LeaveUnit.HOUR }>;
  return `HOUR: ${fmtDT(s.startAt)} → ${fmtDT(s.endAt)}`;
}
function segType(seg: Segment, defaultType: string | LeaveType): string {
  return (seg as any).leaveTypeOverride || defaultType;
}

// =======================
// Page
// =======================
export default function LeaveApprovalsPage() {
  // ====== Filters
  const [userId, setUserId] = useState<string>('');
  const [status, setStatus] = useState<Status>('pending');
  const [leaveType, setLeaveType] = useState<string>(''); // lọc theo loại phép của đơn
  const [unit, setUnit] = useState<string>(''); // lọc theo đơn vị trong segments
  const anchorRef = useRef(new Date());
  const defaultFrom = useMemo(() => { const d = new Date(anchorRef.current); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d.toISOString(); }, []);
  const defaultTo = useMemo(() => { const d = new Date(anchorRef.current); d.setMonth(d.getMonth() + 1); d.setHours(23,59,59,999); return d.toISOString(); }, []);
  const [from, setFrom] = useState<string>(defaultFrom.slice(0,10));
  const [to, setTo] = useState<string>(defaultTo.slice(0,10));
  const [q, setQ] = useState('');

  const swrOpts = { revalidateOnFocus: false, dedupingInterval: 30_000 };

  // ====== Data
  const { data: users } = useSWR<UserLite[]>('/users', p => fetcher(p), swrOpts);
  const key = ['/leave-requests', from, to, status, userId, leaveType, unit, q] as const;

  const { data: leaves } = useSWR<LeaveRequest[]>(
    key,
    ([, f, t, st, uid, ltype, u, query]) => {
      // đẩy phần lọc chính lên server để giảm tải client (nếu backend đã hỗ trợ)
      const queryObj: Record<string, any> = {
        from: new Date(`${f}T00:00:00`).toISOString(),
        to:   new Date(`${t}T23:59:59.999`).toISOString(),
        status: st,
      };
      if (uid) queryObj.userId = uid;
      if (ltype) queryObj.leaveType = ltype;
      if (u) queryObj.unit = u;
      if (typeof query === 'string' && query.trim()) queryObj.q = query.trim();

      return fetchList<LeaveRequest>('/leave-requests', queryObj);
    },
    swrOpts
  );

  const userMap = useMemo(()=> new Map((users||[]).map(u => [String(u._id), u])), [users]);
  const rows = Array.isArray(leaves) ? leaves : [];

  // fallback lọc client (nếu backend chưa filter theo leaveType/unit)
  const filtered = useMemo(() => {
    return rows.filter(l => {
      if (leaveType && String(l.leaveType) !== leaveType) return false;
      if (unit) {
        const ok = l.segments?.some(s => String(s.unit) === unit);
        if (!ok) return false;
      }
      return true;
    });
  }, [rows, leaveType, unit]);

  async function actReview(id: string, action: 'approve'|'reject'|'cancel') {
    // TODO: lấy reviewerId từ session thực tế
    await api(`/leave-requests/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
    mutate(key);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Duyệt đơn nghỉ phép</h1>

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
          <Field label="Người nghỉ">
            <SelectUser value={userId} onChange={setUserId} users={users||[]} />
          </Field>
          <Field label="Trạng thái">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={status} onChange={e=>setStatus(e.target.value as Status)}>
              {(['pending','approved','rejected','cancelled'] as Status[]).map(s => <option key={s} value={s}>{LR_STATUS[s]}</option>)}
            </select>
          </Field>
          <Field label="Loại phép (đơn)">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={leaveType} onChange={e=>setLeaveType(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(LeaveType).map(t => <option key={t} value={t}>{LT_STATUS[t]}</option>)}
            </select>
          </Field>
          <Field label="Đơn vị (segment)">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={unit} onChange={e=>setUnit(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(LeaveUnit).map(u => <option key={u} value={u}>{LT_UNIT[u]}</option>)}
            </select>
          </Field>
          <Field label="Từ ngày">
            <input type="date" className="h-10 w-full rounded-md border px-3 text-sm" value={from} onChange={e=>setFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input type="date" className="h-10 w-full rounded-md border px-3 text-sm" value={to} onChange={e=>setTo(e.target.value)} />
          </Field>
          <Field label="Tìm lý do" className="lg:col-span-2">
            <div className="flex gap-2">
              <input className="h-10 w-full flex-1 rounded-md border px-3 text-sm" value={q} onChange={e=>setQ(e.target.value)} placeholder="Nhập từ khoá…" />
              <button type="button" onClick={()=>setQ('')} className="h-10 rounded-md border px-3 text-sm hover:bg-slate-50">Xoá</button>
            </div>
          </Field>
        </div>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="text-sm text-slate-500">Không có đơn phù hợp.</div>
        ) : (
          filtered.map((l) => {
            const name = resolveUserLabel(l.userId, userMap);
            const segHours = l.segments?.map(calcHours) ?? [];
            const totalH = typeof l.totalHours === 'number' ? l.totalHours : Math.round(segHours.reduce((s,v)=>s+v,0)*100)/100;

            return (
              <div key={String(l._id)} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{name}</div>
                    <div className="text-xs text-slate-600">
                      Loại phép (đơn): <b>{STATUS_OPTIONS_LT.find(option => option.value === String(l.leaveType))?.label}</b> · Trạng thái: <b>{LEAVE_STATUS_OPTIONS.find(option => option.value === String(l.status))?.label}</b>
                    </div>
                    {!!l.reason && <div className="mt-1 text-xs text-slate-700">Lý do: {l.reason}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Tổng giờ (ước tính)</div>
                    <div className="text-base font-semibold">{totalH} h</div>
                    <div className="mt-1"><StatusPill status={l.status as Status} /></div>
                  </div>
                </div>

                {/* Segments */}
                <div className="mt-3 rounded-lg border bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-medium text-slate-600">Các đoạn nghỉ</div>
                  <div className="grid gap-2">
                    {(l.segments||[]).map((s, i) => (
                      <div key={i} className="grid items-center gap-2 md:grid-cols-[minmax(220px,1fr)_auto_auto]">
                        <div className="text-sm">
                          <div>{segLabel(s)}</div>
                          {/* <div className="text-[11px] text-slate-500">
                            Loại (segment): {segType(s, String(l.leaveType))}
                          </div> */}
                        </div>
                        <div className="text-right text-sm tabular-nums">{Math.round(calcHours(s)*100)/100} h</div>
                        <span className="justify-self-end rounded-full bg-slate-200 px-2 py-0.5 text-[11px]">{s.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.status === 'pending' && (
                    <>
                      <button onClick={()=>actReview(String(l._id), 'approve')} className="h-9 rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700">Duyệt</button>
                      <button onClick={()=>actReview(String(l._id), 'reject')} className="h-9 rounded-md bg-rose-600 px-3 text-sm text-white hover:bg-rose-700">Từ chối</button>
                    </>
                  )}
                  {l.status === 'approved' && (
                    <button onClick={()=>actReview(String(l._id), 'cancel')} className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50">Hủy duyệt</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =======================
// UI helpers
// =======================
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SelectUser({
  value, onChange, users, placeholder='Tất cả',
}: { value:string; onChange:(v:string)=>void; users:UserLite[]; placeholder?:string }) {
  return (
    <select className="h-10 w-full rounded-md border px-3 text-sm" value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {users.slice().sort((a,b)=>a.fullName.localeCompare(b.fullName,'vi')).map(u=>(
        <option key={String(u._id)} value={String(u._id)}>{u.fullName}</option>
      ))}
    </select>
  );
}

function StatusPill({ status }: { status: Status }) {
  const color =
    status === 'pending'
      ? 'bg-amber-100 text-amber-900'
      : status === 'approved'
      ? 'bg-emerald-100 text-emerald-900'
      : status === 'rejected'
      ? 'bg-rose-100 text-rose-900'
      : 'bg-slate-100 text-slate-900';
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${color}`}>{LR_STATUS[status]}</span>;
}
