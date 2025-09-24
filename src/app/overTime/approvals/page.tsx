'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

type ObjectId = string;
type Status = 'pending'|'approved'|'rejected'|'cancelled';

enum OvertimeKind { WEEKDAY='WEEKDAY', WEEKEND='WEEKEND', HOLIDAY='HOLIDAY' }
enum CompensationType { PAY='PAY', TIME_OFF='TIME_OFF' }

type UserLite = { _id: ObjectId; fullName: string; email?: string };

type Segment = { startAt: string; endAt: string; hours?: number; kind?: OvertimeKind; compensationOverride?: CompensationType };

type OT = {
  _id: ObjectId;
  userId: ObjectId|{ _id: ObjectId; fullName?: string };
  reviewerId?: ObjectId|{ _id: ObjectId; fullName?: string };
  compensation: CompensationType|string;
  segments: Segment[];
  totalHours?: number;
  status: Status|string;
  reason?: string;
  createdAt?: string;
};

const BASE = '/overtime-requests';

async function api(path: string, opts: any = {}) {
  const { method, query, body, headers } = opts;
  const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).reduce((a,[k,v])=>{
    if (v==null) return a; a[k]= typeof v==='object'?JSON.stringify(v):String(v); return a;
  }, {} as Record<string,string>)).toString() : '';
  const res = await fetch(`${url}${qs}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type':'application/json', ...(headers||{}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
const fetcher = (p: string, q?: Record<string,any>) => api(p, { query: q });
async function fetchList<T = any>(p: string, q?: Record<string,any>): Promise<T[]> {
  const data = await fetcher(p, q);
  return Array.isArray(data) ? data : (data?.items ?? []);
}

function fmtDT(iso: string) { try { return new Date(iso).toLocaleString(); } catch { return iso; } }
function calcHours(s: Segment) {
  if (typeof s.hours === 'number') return s.hours;
  const ms = +new Date(s.endAt) - +new Date(s.startAt);
  return Math.max(0, ms/3_600_000);
}
function resolveUser(u: any, map: Map<string,UserLite>) {
  if (typeof u === 'string') return map.get(u)?.fullName || u;
  const id = String(u?._id ?? '');
  return u?.fullName || map.get(id)?.fullName || id;
}

export default function OvertimeApprovalsPage() {
  const { data: users } = useSWR<UserLite[]>('/users', p=>fetcher(p), { revalidateOnFocus:false });
  const userMap = useMemo(()=>new Map((users||[]).map(u=>[String(u._id),u])), [users]);

  const [status, setStatus] = useState<Status>('pending');
  const [userId, setUserId] = useState<string>('');
  const [comp, setComp] = useState<string>('');
  const [kind, setKind] = useState<string>('');

  const key = [BASE, status, userId, comp, kind] as const;
  const { data: items } = useSWR<OT[]>(
    key,
    ([, st, uid, c, k])=>{
      const q: Record<string,any> = { status: st };
      if (uid) q.userId = uid;
      if (c) q.compensation = c;
      if (k) q.kind = k;
      return fetchList<OT>(BASE, q);
    },
    { revalidateOnFocus:false, dedupingInterval: 30_000 }
  );
  const rows = Array.isArray(items) ? items : [];

  async function review(id: string, action: 'approve'|'reject'|'cancel') {
    await api(`${BASE}/${id}/review`, { method:'PATCH', body:{ action, reviewerId:'000000000000000000000000' } });
    mutate(key);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Duyệt đơn tăng ca</h1>

      <div className="rounded-2xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Field label="Trạng thái">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={status} onChange={e=>setStatus(e.target.value as Status)}>
              {(['pending','approved','rejected','cancelled'] as Status[]).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Người">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={userId} onChange={e=>setUserId(e.target.value)}>
              <option value="">Tất cả</option>
              {(users||[]).slice().sort((a,b)=>a.fullName.localeCompare(b.fullName,'vi')).map(u=><option key={u._id} value={String(u._id)}>{u.fullName}</option>)}
            </select>
          </Field>
          <Field label="Bù">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={comp} onChange={e=>setComp(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(CompensationType).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Kind">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={kind} onChange={e=>setKind(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(OvertimeKind).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="grid gap-3">
        {rows.length===0 ? <div className="text-sm text-slate-500">Không có đơn.</div> : rows.map(ot=>{
          const name = resolveUser(ot.userId, userMap);
          const tHours = typeof ot.totalHours === 'number' ? ot.totalHours : (ot.segments||[]).reduce((s,x)=>s+calcHours(x),0);
          return (
            <div key={String(ot._id)} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{name}</div>
                  <div className="text-xs text-slate-600">Bù: <b>{String(ot.compensation)}</b> · Trạng thái: <b>{String(ot.status)}</b></div>
                  {!!ot.reason && <div className="mt-1 text-xs text-slate-700">Lý do: {ot.reason}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Tổng giờ</div>
                  <div className="text-base font-semibold">{Math.round(tHours*100)/100} h</div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border bg-slate-50 p-3">
                <div className="mb-2 text-xs font-medium text-slate-600">Các khoảng</div>
                <div className="grid gap-2">
                  {(ot.segments||[]).map((s,i)=>(
                    <div key={i} className="grid items-center gap-2 md:grid-cols-[minmax(220px,1fr)_auto_auto]">
                      <div className="text-sm">{fmtDT(s.startAt)} → {fmtDT(s.endAt)}
                        <div className="text-[11px] text-slate-500">Kind: {s.kind||'(auto)'} · Comp: {s.compensationOverride||'(theo đơn)'}</div>
                      </div>
                      <div className="text-right text-sm tabular-nums">{Math.round(calcHours(s)*100)/100} h</div>
                      <span className="justify-self-end rounded-full bg-slate-200 px-2 py-0.5 text-[11px]">OT</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {ot.status==='pending' && (
                  <>
                    <button className="h-9 rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700" onClick={()=>review(String(ot._id),'approve')}>Duyệt</button>
                    <button className="h-9 rounded-md bg-rose-600 px-3 text-sm text-white hover:bg-rose-700" onClick={()=>review(String(ot._id),'reject')}>Từ chối</button>
                  </>
                )}
                {ot.status==='approved' && (
                  <button className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50" onClick={()=>review(String(ot._id),'cancel')}>Hủy duyệt</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
