'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { STATUS_OPTIONS_LT, LT_STATUS, LT_UNIT, UNIT_OPTIONS_LT } from '@/i18n/leaveRequest.vi';
import { UserWithOrganization } from "@/types";
import { Organization as OrganizationType } from "@/types/organization";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

/* =========================
   Types & minimal helpers
========================= */
type ObjectId = string;

enum LeaveType {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
  SICK = 'SICK',
  MATERNITY = 'MATERNITY',
  COMPENSATORY = 'COMPENSATORY',
  OTHER = 'OTHER',
}
enum LeaveUnit {
  DAY = 'DAY',
  HALF_DAY = 'HALF_DAY',
  HOUR = 'HOUR',
}

type UserLite = { _id: ObjectId; fullName: string };

type Segment =
  | { unit: LeaveUnit.DAY; fromDate: string; toDate: string; hours?: number }
  | { unit: LeaveUnit.HALF_DAY; date: string; slot: 'AM' | 'PM'; hours?: number }
  | { unit: LeaveUnit.HOUR; startAt: string; endAt: string; hours?: number };

type LeaveRequest = {
  _id: ObjectId;
  userId: ObjectId | { _id: ObjectId; fullName?: string };
  leaveType: LeaveType | string;
  segments: Segment[];
  status: string;
};

type Bucket = { key: string; value: number };

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
async function fetchList<T = any>(path: string, query?: Record<string, any>): Promise<T[]> {
  const data = await fetcher(path, query);
  return Array.isArray(data) ? data : (data?.items ?? []);
}

/* =========================
   Time helpers (Mon-Sun week)
========================= */
function atMidnight(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

function startOfWeek(d: Date) {
  const x = atMidnight(d);
  const wd = x.getDay(); // 0..6 (Sun..Sat)
  const diff = (wd === 0 ? -6 : 1 - wd); // Monday as start
  return atMidnight(addDays(x, diff));
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  return endOfDay(addDays(s, 6)); // Mon..Sun
}
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); return atMidnight(x); }
function endOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); return endOfDay(x); }

function toYMD(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function formatRangeLabel(from: Date, to: Date) {
  const fmt = (x: Date) => x.toLocaleDateString();
  return `${fmt(from)} — ${fmt(to)}`;
}

/* =========================
   Page
========================= */
export default function LeaveOverviewReportsPage() {
  type Granularity = 'day' | 'week' | 'month';

  // Granularity + anchor date:
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  // Filters
  const [userId, setUserId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<string>(''); // request-level type
  const [unit, setUnit] = useState<string>(''); // segment unit

  // from/to theo granularity & anchor
  const { fromISO, toISO, fromDate, toDate, periodLabel } = useMemo(() => {
    let f: Date, t: Date, label = '';
    if (granularity === 'day') {
      f = atMidnight(anchor);
      t = endOfDay(anchor);
      label = anchor.toLocaleDateString();
    } else if (granularity === 'week') {
      f = startOfWeek(anchor);
      t = endOfWeek(anchor);
      label = `Tuần: ${formatRangeLabel(f, t)}`;
    } else {
      f = startOfMonth(anchor);
      t = endOfMonth(anchor);
      const monthName = f.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      label = `Tháng: ${monthName}`;
    }
    return { fromISO: f.toISOString(), toISO: t.toISOString(), fromDate: f, toDate: t, periodLabel: label };
  }, [granularity, anchor]);

  function goPrev() {
    if (granularity === 'day') setAnchor(addDays(anchor, -1));
    else if (granularity === 'week') setAnchor(addDays(anchor, -7));
    else setAnchor(addMonths(anchor, -1));
  }
  function goNext() {
    if (granularity === 'day') setAnchor(addDays(anchor, 1));
    else if (granularity === 'week') setAnchor(addDays(anchor, 7));
    else setAnchor(addMonths(anchor, 1));
  }

  useEffect(() => {
    if (granularity === 'day') setAnchor(new Date(anchor));
    if (granularity === 'week') setAnchor(startOfWeek(anchor));
    if (granularity === 'month') setAnchor(startOfMonth(anchor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  const swrOpts = { revalidateOnFocus: false, dedupingInterval: 30_000 };
  const { data: users } = useSWR<UserWithOrganization[]>('/users/withOrganizationName', (p) => fetcher(p), swrOpts);
  const userMap = useMemo(() => new Map((Array.isArray(users) ? users : []).map(u => [String(u._id), u])), [users]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [userCode, setUserCode] = useState("");
  const [nameFilter, setNameFilter] = useState<string>('');

  // Fetch approved
  const { data: leaves } = useSWR<LeaveRequest[]>(
    ['/leave-requests', 'approved', fromISO, toISO, userId, leaveType, unit],
    ([, , f, t, uid, ltype, u]) => {
      const query: Record<string, any> = { from: f, to: t, status: 'approved' };
      if (uid) query.userId = uid;
      if (ltype) query.leaveType = ltype;
      if (u) query.unit = u;
      return fetchList<LeaveRequest>('/leave-requests', query);
    },
    swrOpts
  );
  const rows = Array.isArray(leaves) ? leaves : [];

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (leaveType && String(r.leaveType) !== leaveType) return false;
      if (userId) {
        const uid = typeof r.userId === 'string' ? r.userId : String((r.userId as any)?._id ?? '');
        if (uid !== userId) return false;
      }
      if (unit && !r.segments?.some(s => String(s.unit) === unit)) return false;
      return true;
    });
  }, [rows, leaveType, userId, unit]);

  // ====== Chart buckets (by day in window) ======
  const dayKeys: string[] = useMemo(() => {
    const keys: string[] = [];
    for (let d = atMidnight(fromDate); d <= toDate; d = addDays(d, 1)) {
      keys.push(toYMD(d));
    }
    return keys;
  }, [fromDate, toDate]);

  const dayBuckets: Bucket[] = useMemo(() => {
    const map = new Map<string, number>(); // YYYY-MM-DD -> hours
    dayKeys.forEach(k => map.set(k, 0));
    const isWeekend = (d: Date) => [0, 6].includes(d.getDay());
    const plus = (key: string, val: number) => map.set(key, (map.get(key) || 0) + val);

    for (const r of filtered) {
      for (const seg of (r.segments || [])) {
        if (seg.unit === LeaveUnit.DAY) {
          const s = atMidnight(new Date(seg.fromDate));
          const e = atMidnight(new Date(seg.toDate));
          let workDays = 0;
          for (let d = new Date(s); d <= e; d = addDays(d, 1)) if (!isWeekend(d)) workDays++;
          let totalH = typeof (seg as any).hours === 'number' ? (seg as any).hours! : workDays * 8;
          for (let d = new Date(s); d <= e; d = addDays(d, 1)) {
            const key = toYMD(d);
            if (!map.has(key)) continue;
            if (isWeekend(d)) continue;
            const h = workDays > 0 ? totalH / workDays : 0;
            plus(key, h);
          }
        } else if (seg.unit === LeaveUnit.HALF_DAY) {
          const d = atMidnight(new Date(seg.date));
          const key = toYMD(d);
          if (!map.has(key)) continue;
          const h = typeof (seg as any).hours === 'number' ? (seg as any).hours! : 4;
          plus(key, h);
        } else {
          const s = new Date((seg as any).startAt);
          const key = toYMD(atMidnight(s));
          if (!map.has(key)) continue;
          const h = typeof (seg as any).hours === 'number'
            ? (seg as any).hours!
            : Math.max(0, (+new Date((seg as any).endAt) - +s) / 3_600_000);
          plus(key, h);
        }
      }
    }

    return Array.from(map, ([key, value]) => ({ key, value }));
  }, [filtered, dayKeys]);

  const totalHours = useMemo(() => dayBuckets.reduce((s, b) => s + b.value, 0), [dayBuckets]);

  // ====== Details list (name + time) ======
  type DetailRow = {
    id: string;
    dateKey: string;             // YYYY-MM-DD (ngày hiển thị)
    userName: string;
    unit: LeaveUnit;
    timeText: string;            // Khoảng thời gian hiển thị
    hours: number;               // Ước tính nếu server chưa snapshot
    leaveType: string;           // loại cấp đơn (để tham khảo)
  };

  function resolveUserLabel(userField: any): string {
    if (typeof userField === 'string') return userMap.get(userField)?.fullName || userField;
    if (userField && typeof userField === 'object') {
      const id = (userField as any)?._id ? String((userField as any)._id) : '';
      return (userField as any).fullName || userMap.get(id)?.fullName || id;
    }
    return String(userField ?? '');
  }

  const details: DetailRow[] = useMemo(() => {
    const out: DetailRow[] = [];
    const inWindow = (d: Date) => d >= atMidnight(fromDate) && d <= endOfDay(toDate);
    const isWeekend = (d: Date) => [0, 6].includes(d.getDay());

    for (const r of filtered) {
      const name = resolveUserLabel(r.userId);
      for (const seg of (r.segments || [])) {
        if (seg.unit === LeaveUnit.DAY) {
          // Liệt kê từng NGÀY LÀM VIỆC trong khoảng
          const s = atMidnight(new Date(seg.fromDate));
          const e = atMidnight(new Date(seg.toDate));
          let workDays = 0;
          for (let d = new Date(s); d <= e; d = addDays(d, 1)) if (!isWeekend(d)) workDays++;
          const totalH = typeof (seg as any).hours === 'number' ? (seg as any).hours! : workDays * 8;
          const each = workDays > 0 ? totalH / workDays : 0;
          for (let d = new Date(s); d <= e; d = addDays(d, 1)) {
            if (isWeekend(d)) continue;
            if (!inWindow(d)) continue;
            out.push({
              id: `${r._id}-DAY-${toYMD(d)}`,
              dateKey: toYMD(d),
              userName: name,
              unit: LeaveUnit.DAY,
              timeText: `${d.toLocaleDateString()} (cả ngày)`,
              hours: each,
              leaveType: String(r.leaveType),
            });
          }
        } else if (seg.unit === LeaveUnit.HALF_DAY) {
          const d = atMidnight(new Date(seg.date));
          if (!inWindow(d)) continue;
          out.push({
            id: `${r._id}-HALF-${toYMD(d)}`,
            dateKey: toYMD(d),
            userName: name,
            unit: LeaveUnit.HALF_DAY,
            timeText: `${d.toLocaleDateString()} (${(seg as any).slot})`,
            hours: typeof (seg as any).hours === 'number' ? (seg as any).hours! : 4,
            leaveType: String(r.leaveType),
          });
        } else {
          const s = new Date((seg as any).startAt);
          if (!inWindow(s)) continue;
          const e = new Date((seg as any).endAt);
          const h = typeof (seg as any).hours === 'number'
            ? (seg as any).hours!
            : Math.max(0, (+e - +s) / 3_600_000);
          out.push({
            id: `${r._id}-HOUR-${+s}`,
            dateKey: toYMD(atMidnight(s)),
            userName: name,
            unit: LeaveUnit.HOUR,
            timeText: `${s.toLocaleString()} → ${e.toLocaleString()}`,
            hours: h,
            leaveType: String(r.leaveType),
          });
        }
      }
    }

    // Sắp xếp theo ngày ↑ rồi theo tên
    return out.sort((a, b) => {
      const t = a.dateKey.localeCompare(b.dateKey, 'en', { numeric: true });
      if (t !== 0) return t;
      return a.userName.localeCompare(b.userName, 'vi');
    });
  }, [filtered, fromDate, toDate, userMap]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Báo cáo tổng quan nghỉ phép</h1>

      {/* Điều hướng kỳ xem: Day / Week / Month */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <GranularityTabs value={granularity} onChange={setGranularity} />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={goPrev} className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50">◀</button>

            {granularity === 'day' ? (
              <input
                type="date"
                className="h-9 rounded-md border px-3 text-sm"
                value={toYMD(anchor)}
                onChange={(e) => setAnchor(new Date(`${e.target.value}T00:00:00`))}
              />
            ) : (
              <span className="min-w-[240px] text-sm text-slate-700">{periodLabel}</span>
            )}

            <button type="button" onClick={goNext} className="h-9 rounded-md border px-3 text-sm hover:bg-slate-50">▶</button>
          </div>
        </div>

        {/* Lọc bổ sung */}
        <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Field label="Người nghỉ">
            <SelectUser value={userId} onChange={setUserId} users={Array.isArray(users) ? users : []} />
          </Field>
          <Field label="Loại phép (đơn)">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(LeaveType).map(type => (
                <option key={type} value={type}>
                  {LT_STATUS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Đơn vị (segment)">
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="">Tất cả</option>
              {Object.values(LeaveUnit).map(u => <option key={u} value={u}>{LT_UNIT[u]}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Biểu đồ theo ngày trong kỳ */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 font-semibold">
          {granularity === 'day' ? 'Giờ nghỉ trong ngày' : granularity === 'week' ? 'Giờ nghỉ theo từng ngày trong tuần' : 'Giờ nghỉ theo từng ngày trong tháng'}
        </div>
        <TimeBar data={dayBuckets} suffix="h" />
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm">
        Tổng giờ nghỉ (đã duyệt) trong kỳ: <b>{Math.round(totalHours * 100) / 100} giờ</b>
      </div>

      {/* ===== Danh sách chi tiết trong kỳ ===== */}
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 font-semibold">Danh sách chi tiết trong kỳ</div>
        {details.length === 0 ? (
          <div className="text-sm text-slate-500">Không có dữ liệu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="border-b p-2">Ngày</th>
                  <th className="border-b p-2">Người nghỉ</th>
                  <th className="border-b p-2">Đơn vị</th>
                  <th className="border-b p-2">Thời gian</th>
                  <th className="border-b p-2 text-right">Giờ</th>
                  <th className="border-b p-2">Loại (đơn)</th>
                </tr>
              </thead>
              <tbody>
                {details.map(row => (
                  <tr key={row.id} className="text-sm">
                    <td className="border-b p-2 whitespace-nowrap">{row.dateKey}</td>
                    <td className="border-b p-2 whitespace-nowrap">{row.userName}</td>
                    <td className="border-b p-2 whitespace-nowrap">{UNIT_OPTIONS_LT.find(option => option.value === row.unit)?.label}</td>
                    <td className="border-b p-2">{row.timeText}</td>
                    <td className="border-b p-2 text-right tabular-nums">{Math.round(row.hours * 100) / 100}</td>
                    <td className="border-b p-2 whitespace-nowrap">{STATUS_OPTIONS_LT.find(option => option.value === row.leaveType)?.label}</td>
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

/* =========================
   UI components
========================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function GranularityTabs({ value, onChange }: { value: 'day' | 'week' | 'month'; onChange: (v: any) => void }) {
  const opts: Array<{ v: 'day' | 'week' | 'month', label: string }> = [
    { v: 'day', label: 'Ngày' },
    { v: 'week', label: 'Tuần' },
    { v: 'month', label: 'Tháng' },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-slate-50 p-1">
      {opts.map(o => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`h-9 px-3 text-sm rounded-md ${active ? 'bg-white shadow border' : 'text-slate-600 hover:bg-white/60'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectUser({
  value, onChange, users, placeholder = 'Tất cả',
}: { value: string; onChange: (v: string) => void; users: UserLite[]; placeholder?: string }) {
  return (
    <select className="h-10 w-full rounded-md border px-3 text-sm" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')).map(u => (
        <option key={String(u._id)} value={String(u._id)}>{u.fullName}</option>
      ))}
    </select>
  );
}

// Biểu đồ cột theo ngày
function TimeBar({ data, suffix = '' }: { data: Bucket[]; suffix?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  if (!data.length) return <div className="text-sm text-slate-500">Không có dữ liệu.</div>;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 py-2">
        {data.map(d => (
          <div key={d.key} className="flex flex-col items-center gap-1">
            <div className="flex h-36 w-6 items-end rounded bg-slate-100">
              <div className="w-full rounded bg-slate-800" style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
            <div className="text-[11px] text-slate-600">{d.key}</div>
            <div className="text-[11px] text-slate-900 tabular-nums">{Math.round(d.value * 100) / 100}{suffix}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
