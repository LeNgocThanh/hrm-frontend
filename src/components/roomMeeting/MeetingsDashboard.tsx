'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api/room-meetings';
import { ArrowLeft, ArrowRight, Users, Building2, CalendarDays, UserCircle2 } from 'lucide-react';

type MeetingStatus = 'PENDING_APPROVAL' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
type Participant = { userId?: string; response?: 'ACCEPTED' | 'DECLINED' | 'PENDING' | 'INVITED' | string };
type Meeting = {
  _id: string; title: string; startAt: string; endAt: string; status: MeetingStatus;
  roomId: string; participants?: Participant[]; externalHeadcount?: number;
};
type Room = { _id: string; name: string; capacity?: number };

const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });

// ==== date helpers (tuần bắt đầu thứ 2) ====
function atMidnight(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function weekStart(d = new Date()) { const x = atMidnight(d); const day = x.getDay(); x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); return x; }
function weekEnd(d = new Date()) { const s = weekStart(d); const x = new Date(s); x.setDate(x.getDate() + 6); x.setHours(23, 59, 59, 999); return x; }
function monthStart(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); }
function monthEnd(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
const iso = (d: Date) => d.toISOString();

function happened(m: Meeting) {
  const now = Date.now();
  const end = new Date(m.endAt).getTime();
  return end < now && m.status !== 'CANCELLED' && m.status !== 'REJECTED';
}
function countInternal(ps?: Participant[]) {
  if (!ps) return 0;
  return ps.filter(p => p.userId && p.response !== 'DECLINED').length;
}
function countGuests(n?: number) { return Math.max(0, Number(n || 0)); }

// ==== UI atoms ====
function Card({ icon, title, value, hint, loading }: { icon: React.ReactNode; title: string; value: number | string; hint?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-900/90 p-2 text-white">{icon}</div>
        <div className="text-xs text-slate-500">{title}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{loading ? '…' : value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  // value 0..100
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-slate-900/80 transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

// ==== Main ====
export default function MeetingsDashboard({ rooms }: { rooms: Room[] }) {
  type Range = 'week' | 'month';
  const [range, setRange] = useState<Range>('week');
  const [anchor, setAnchor] = useState<Date>(new Date()); // dịch theo tuần/tháng

  const { from, to, label } = useMemo(() => {
    if (range === 'week') {
      const s = weekStart(anchor); const e = weekEnd(anchor);
      return { from: s, to: e, label: `Tuần ${s.toLocaleDateString()} – ${e.toLocaleDateString()}` };
    }
    const s = monthStart(anchor); const e = monthEnd(anchor);
    const mm = s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { from: s, to: e, label: mm.charAt(0).toUpperCase() + mm.slice(1) };
  }, [range, anchor]);

  const shift = (dir: -1 | 1) => {
    setAnchor(prev => {
      const x = new Date(prev);
      if (range === 'week') x.setDate(x.getDate() + dir * 7);
      else x.setMonth(x.getMonth() + dir * 1);
      return x;
    });
  };

  const { data: meetings, isLoading, error, mutate } = useSWR<Meeting[]>(
    ['/meetings', iso(from), iso(to)],
    () => fetcher('/meetings', { from: iso(from), to: iso(to) }),
    { revalidateOnFocus: true, dedupingInterval: 20_000, refreshInterval: 60_000 }
  );

  // Tổng hợp
  const totals = useMemo(() => {
    const list = (meetings || []).filter(happened);
    const totalMeetings = list.length;
    const internal = list.reduce((s, m) => s + countInternal(m.participants), 0);
    const guests = list.reduce((s, m) => s + countGuests(m.externalHeadcount), 0);
    return { totalMeetings, internal, guests };
  }, [meetings]);

  const perRoom = useMemo(() => {
    const buckets = new Map<string, { room: Room; meetings: number; internal: number; guests: number; utilization: number }>();
    for (const r of rooms) buckets.set(String(r._id), { room: r, meetings: 0, internal: 0, guests: 0, utilization: 0 });

    const list = (meetings || []).filter(happened);
    for (const m of list) {
      const key = String(m.roomId);
      if (!buckets.has(key)) continue;
      const b = buckets.get(key)!;
      const intr = countInternal(m.participants);
      const gst = countGuests(m.externalHeadcount);
      b.meetings += 1;
      b.internal += intr;
      b.guests += gst;

      if (b.room.capacity && b.room.capacity > 0) {
        // tính utilization từng cuộc họp, rồi lấy trung bình (clip 0..100)
        const one = Math.min(100, Math.round(((intr + gst) / b.room.capacity) * 100));
        b.utilization += one;
      }
    }
    // bình quân utilization theo số meeting
    for (const b of buckets.values()) {
      if (b.meetings > 0 && b.room.capacity && b.room.capacity > 0) {
        b.utilization = Math.round(b.utilization / b.meetings);
      } else {
        b.utilization = 0;
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.room.name.localeCompare(b.room.name, 'vi'));
  }, [meetings, rooms]);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <header className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard họp</h1>
            <p className="text-sm text-slate-600">Phạm vi: <b>{label}</b></p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border bg-slate-50 p-1">
              <button
                className={`rounded-full px-3 py-1.5 text-sm ${range === 'week' ? 'bg-white shadow font-semibold' : 'text-slate-600 hover:bg-white'}`}
                onClick={() => setRange('week')}
              >Tuần</button>
              <button
                className={`rounded-full px-3 py-1.5 text-sm ${range === 'month' ? 'bg-white shadow font-semibold' : 'text-slate-600 hover:bg-white'}`}
                onClick={() => setRange('month')}
              >Tháng</button>
            </div>
            <div className="inline-flex items-center gap-1">
              <button onClick={() => shift(-1)} className="rounded-full border p-2 hover:bg-slate-50" title="Lùi">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button onClick={() => shift(1)} className="rounded-full border p-2 hover:bg-slate-50" title="Tiến">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ">
        <Card icon={<Building2 className="h-5 w-5 bg-blue-500" />} title="Số phòng họp" value={rooms.length} hint="Tổng số phòng" />
        <Card icon={<CalendarDays className="h-5 w-5 bg-blue-500" />} title="Cuộc họp đã diễn ra" value={isLoading ? '…' : totals.totalMeetings} hint={range === 'week' ? 'Tuần hiện tại' : 'Tháng hiện tại'} loading={isLoading} />
        <Card icon={<UserCircle2 className="h-5 w-5 bg-blue-500" />} title="Người tham gia (nội bộ)" value={isLoading ? '…' : totals.internal} loading={isLoading} />
        <Card icon={<Users className="h-5 w-5 bg-blue-500" />} title="Khách tham dự" value={isLoading ? '…' : totals.guests} loading={isLoading} />
      </section>

      {/* Bảng theo từng phòng */}
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Từng phòng</h2>
          <div className="text-xs text-slate-500">{rooms.length} phòng</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Phòng</th>
                <th className="px-4 py-2 font-medium">Đã diễn ra</th>
                <th className="px-4 py-2 font-medium">Nội bộ</th>
                <th className="px-4 py-2 font-medium">Khách</th>
                <th className="px-4 py-2 font-medium">Trung bình (số người họp/sức chứa)</th>
              </tr>
            </thead>
            <tbody>
              {perRoom.map(({ room, meetings, internal, guests, utilization }) => (
                <tr key={String(room._id)} className="border-t hover:bg-slate-50/60">
                  <td className="px-4 py-2">
                    <div className="font-medium">{room.name}</div>
                    <div className="text-xs text-slate-500">Sức chứa: {room.capacity ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2">{meetings}</td>
                  <td className="px-4 py-2">{internal}</td>
                  <td className="px-4 py-2">{guests}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Bar value={utilization} />
                      <span className="text-xs text-slate-500">{utilization}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {perRoom.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    {isLoading ? 'Đang tải…' : 'Chưa có dữ liệu trong phạm vi đã chọn.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer nhỏ: refresh */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2">
          <button onClick={() => mutate()} className="rounded-full border px-3 py-1.5 text-xs hover:bg-slate-50">Làm mới</button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Có lỗi khi tải dữ liệu. Vui lòng thử lại.
        </div>
      )}
    </div>
  );
}
