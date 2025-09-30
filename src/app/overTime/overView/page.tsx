'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { OverTimeKind_STATUS, CompensationType_STATUS, Status_STATUS, VI_CompensationType, VI_OverTimeKind, VI_Status } from '@/i18n/overTime.vi';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

type ObjectId = string;
enum OvertimeKind { WEEKDAY='WEEKDAY', WEEKEND='WEEKEND', HOLIDAY='HOLIDAY' }
enum CompensationType { PAY='PAY', TIME_OFF='TIME_OFF' }

type UserLite = { _id: ObjectId; fullName: string };
type Segment = { startAt: string; endAt: string; hours?: number; kind?: OvertimeKind; compensationOverride?: CompensationType };
type OT = { _id: ObjectId; userId: ObjectId|{ _id: ObjectId; fullName?: string }; compensation: CompensationType|string; segments: Segment[]; status: string };

type Bucket = { key: string; value: number };

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

function atMidnight(d: Date){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d: Date,n:number){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d: Date,n:number){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
function startOfWeek(d: Date){ const x=atMidnight(d); const wd=x.getDay(); const diff=(wd===0?-6:1-wd); return atMidnight(addDays(x,diff)); }
function endOfWeek(d: Date){ const s=startOfWeek(d); return endOfDay(addDays(s,6)); }
function startOfMonth(d: Date){ return atMidnight(new Date(d.getFullYear(), d.getMonth(), 1)); }
function endOfMonth(d: Date){ return endOfDay(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
function toYMD(d: Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function calcHours(s: Segment){ if (typeof s.hours === 'number') return s.hours; const ms=+new Date(s.endAt)-+new Date(s.startAt); return Math.max(0, ms/3_600_000); }
function resolveUser(u: any, map: Map<string,UserLite>){ if (typeof u === 'string') return map.get(u)?.fullName || u; const id=String(u?._id??''); return u?.fullName || map.get(id)?.fullName || id; }
function fmtDT(iso: string){ try{return new Date(iso).toLocaleString()}catch{return iso} }

export default function OvertimeReportsOverview() {
  type G = 'day'|'week'|'month';
  const [g, setG] = useState<G>('day');
  const [anchor, setAnchor] = useState<Date>(()=>new Date());

  const [userId, setUserId] = useState<string>('');
  const [comp, setComp] = useState<string>('');
  const [kind, setKind] = useState<string>('');

  const { fromISO, toISO, fromDate, toDate, label } = useMemo(()=>{
    let f: Date, t: Date, lb='';
    if (g==='day'){ f=atMidnight(anchor); t=endOfDay(anchor); lb=anchor.toLocaleDateString(); }
    else if (g==='week'){ f=startOfWeek(anchor); t=endOfWeek(anchor); lb=`Tuần: ${f.toLocaleDateString()} — ${t.toLocaleDateString()}`; }
    else { f=startOfMonth(anchor); t=endOfMonth(anchor); lb=`Tháng: ${f.toLocaleString(undefined,{month:'long',year:'numeric'})}`; }
    return { fromISO:f.toISOString(), toISO:t.toISOString(), fromDate:f, toDate:t, label:lb };
  }, [g, anchor]);

  function prev(){ if (g==='day') setAnchor(addDays(anchor,-1)); else if (g==='week') setAnchor(addDays(anchor,-7)); else setAnchor(addMonths(anchor,-1)); }
  function next(){ if (g==='day') setAnchor(addDays(anchor,1)); else if (g==='week') setAnchor(addDays(anchor,7)); else setAnchor(addMonths(anchor,1)); }

  useEffect(()=>{ if (g==='week') setAnchor(startOfWeek(anchor)); if (g==='month') setAnchor(startOfMonth(anchor)); /* keep day */ // eslint-disable-next-line
  }, [g]);

  const { data: users } = useSWR<UserLite[]>('/users', p=>fetcher(p), { revalidateOnFocus:false });
  const userMap = useMemo(()=>new Map((users||[]).map(u=>[String(u._id),u])), [users]);

  const { data: items } = useSWR<OT[]>(
    [BASE, 'approved', fromISO, toISO, userId, comp, kind],
    ([, , f, t, uid, c, k])=>{
      const q: Record<string,any> = { status:'approved', from:f, to:t };
      if (uid) q.userId = uid;
      if (c) q.compensation = c;
      if (k) q.kind = k;
      return fetchList<OT>(BASE, q);
    },
    { revalidateOnFocus:false, dedupingInterval: 30_000 }
  );
  const rows = Array.isArray(items)?items:[];

  // Danh sách ngày trong kỳ
  const dayKeys = useMemo(()=>{ const keys:string[]=[]; for (let d=atMidnight(fromDate); d<=toDate; d=addDays(d,1)) keys.push(toYMD(d)); return keys; }, [fromDate, toDate]);

  // Bucket giờ theo ngày
  const buckets: Bucket[] = useMemo(()=>{
    const map = new Map<string,number>(); dayKeys.forEach(k=>map.set(k,0));
    for (const r of rows) for (const s of (r.segments||[])) {
      const start = new Date(s.startAt), end = new Date(s.endAt);
      // trải giờ theo từng ngày (nếu qua đêm)
      let cur = atMidnight(start);
      while (cur <= end) {
        const key = toYMD(cur);
        if (map.has(key)) {
          const dayStart = cur;
          const dayEnd = endOfDay(cur);
          const segStart = start > dayStart ? start : dayStart;
          const segEnd = end < dayEnd ? end : dayEnd;
          const h = Math.max(0, (+segEnd - +segStart) / 3_600_000);
          map.set(key, (map.get(key)||0) + h);
        }
        cur = addDays(cur, 1);
      }
    }
    return Array.from(map, ([key, value])=>({ key, value }));
  }, [rows, dayKeys]);

  const totalHours = useMemo(()=> buckets.reduce((s,b)=>s+b.value,0), [buckets]);

  // Bảng chi tiết: theo từng segment (cắt theo ngày nếu qua đêm)
  type DetailRow = { id: string; dateKey: string; userName: string; timeText: string; kind?: string; comp?: string; hours: number };
  const details: DetailRow[] = useMemo(()=>{
    const out: DetailRow[] = [];
    for (const r of rows) {
      const name = resolveUser(r.userId, userMap);
      for (const s of (r.segments||[])) {
        let start = new Date(s.startAt), end = new Date(s.endAt);
        let cur = atMidnight(start);
        while (cur <= end) {
          const dayStart = cur, dayEnd = endOfDay(cur);
          const segStart = start > dayStart ? start : dayStart;
          const segEnd = end < dayEnd ? end : dayEnd;
          if (segEnd > segStart) {
            out.push({
              id: `${r._id}-${+segStart}`,
              dateKey: toYMD(cur),
              userName: name,
              timeText: `${segStart.toLocaleString()} → ${segEnd.toLocaleString()}`,
              kind: s.kind,
              comp: s.compensationOverride || (r.compensation as string),
              hours: Math.max(0,(+segEnd - +segStart)/3_600_000),
            });
          }
          cur = addDays(cur, 1);
        }
      }
    }
    return out.sort((a,b)=>a.dateKey.localeCompare(b.dateKey,'en',{numeric:true}) || a.userName.localeCompare(b.userName,'vi'));
  }, [rows, userMap]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Báo cáo tăng ca</h1>

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Granularity value={g} onChange={setG} />
          <div className="ml-auto flex items-center gap-2">
            <button className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50" onClick={prev}>◀</button>
            {g==='day' ? (
              <input type="date" className="h-9 rounded-md border px-3 text-sm" value={toYMD(anchor)} onChange={e=>setAnchor(new Date(`${e.target.value}T00:00:00`))}/>
            ) : (
              <span className="min-w-[240px] text-sm text-slate-700">{label}</span>
            )}
            <button className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50" onClick={next}>▶</button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Người">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={userId} onChange={e=>setUserId(e.target.value)}>
              <option value="">Tất cả</option>
              {(users||[]).slice().sort((a,b)=>a.fullName.localeCompare(b.fullName,'vi')).map(u=><option key={u._id} value={String(u._id)}>{u.fullName}</option>)}
            </select>
          </Field>
          <Field label="Bù">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={comp} onChange={e=>setComp(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(CompensationType).map(v=><option key={v} value={v}>{CompensationType_STATUS[v]}</option>)}
            </select>
          </Field>
          <Field label="Kind">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={kind} onChange={e=>setKind(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(OvertimeKind).map(v=><option key={v} value={v}>{OverTimeKind_STATUS[v]}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 font-semibold">Giờ tăng ca theo ngày</div>
        <TimeBar data={buckets} suffix="h" />
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm">
        Tổng giờ tăng ca (đã duyệt): <b>{Math.round(totalHours*100)/100} giờ</b>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 font-semibold">Danh sách chi tiết trong kỳ</div>
        {details.length===0 ? <div className="text-sm text-slate-500">Không có dữ liệu.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="border-b p-2">Ngày</th>
                  <th className="border-b p-2">Người</th>
                  <th className="border-b p-2">Khoảng thời gian</th>
                  <th className="border-b p-2">Loại công</th>
                  <th className="border-b p-2">Cách</th>
                  <th className="border-b p-2 text-right">Giờ</th>
                </tr>
              </thead>
              <tbody>
                {details.map(d=>(
                  <tr key={d.id} className="text-sm">
                    <td className="border-b p-2 whitespace-nowrap">{d.dateKey}</td>
                    <td className="border-b p-2 whitespace-nowrap">{d.userName}</td>
                    <td className="border-b p-2">{d.timeText}</td>
                    <td className="border-b p-2 whitespace-nowrap">{VI_OverTimeKind.find(option => option.value === d.kind)?.label ||'(auto)'}</td>
                    <td className="border-b p-2 whitespace-nowrap">{VI_CompensationType.find(option => option.value === d.comp)?.label}</td>
                    <td className="border-b p-2 text-right tabular-nums">{Math.round(d.hours*100)/100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function Granularity({ value, onChange }: { value:'day'|'week'|'month'; onChange:(v:any)=>void }) {
  const opts = [{v:'day',label:'Ngày'},{v:'week',label:'Tuần'},{v:'month',label:'Tháng'}] as const;
  return (
    <div className="inline-flex rounded-lg border bg-slate-50 p-1">
      {opts.map(o=>{
        const active = value===o.v;
        return (
          <button key={o.v} type="button" onClick={()=>onChange(o.v)} className={`h-9 px-3 text-sm rounded-md ${active?'bg-white shadow border':'text-slate-600 hover:bg-white/60'}`}>{o.label}</button>
        );
      })}
    </div>
  );
}

function TimeBar({ data, suffix='' }: { data: Bucket[]; suffix?: string }) {
  const max = Math.max(1, ...data.map(d=>d.value));
  if (!data.length) return <div className="text-sm text-slate-500">Không có dữ liệu.</div>;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 py-2">
        {data.map(d=>(
          <div key={d.key} className="flex flex-col items-center gap-1">
            <div className="flex h-36 w-6 items-end rounded bg-slate-100">
              <div className="w-full rounded bg-slate-800" style={{ height: `${(d.value/max)*100}%` }} />
            </div>
            <div className="text-[11px] text-slate-600">{d.key}</div>
            <div className="text-[11px] text-slate-900 tabular-nums">{Math.round(d.value*100)/100}{suffix}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
