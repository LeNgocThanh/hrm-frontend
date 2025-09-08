'use client';

import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api/room-meetings';
import { fmt } from '@/lib/api/time';
import {
  Meeting,
  MeetingRoom,
  MeetingStatus,
} from '@/types/room-meetings';
import { Organization } from '@/types/organization';
import { User } from '@/types/index';
import StatusPill from '@/components/roomMeeting/statusPill';
import MeetingDetails from './meeting-details';

type Props = { rooms: MeetingRoom[] };
function fmtDateShort(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const wd = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - wd);
  return x;
}
function endOfWeek(d: Date)   { const x = startOfWeek(d); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999); return x; }
function startOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); }
function endOfMonth(d: Date)  { return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); }

function rangeFor(anchor: Date, view: 'day'|'week'|'month') {
  if (view === 'day')   return { from: startOfDay(anchor),   to: endOfDay(anchor) };
  if (view === 'week')  return { from: startOfWeek(anchor),  to: endOfWeek(anchor) };
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });

export default function Client({ rooms }: Props) {
  // ==== Tab phòng + cửa sổ thời gian ====
  const [activeRoomId, setActiveRoomId] = useState<string>(rooms[0]?._id || '');
  const [view, setView] = useState<'day'|'week'|'month'>('day');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0,10));
  const anchor = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr]);
  const { from, to, fromDate, toDate } = useMemo(() => {
  const r = rangeFor(anchor, view);
  return {
    from: r.from.toISOString(),
    to:   r.to.toISOString(),
    fromDate: r.from,
    toDate:   r.to,
  };
}, [anchor, view]);

  // ==== Data ====
  const swrOpts = { revalidateOnFocus: false, dedupingInterval: 30_000 };
  const { data: meetings, isLoading, mutate } = useSWR<Meeting[]>(
    activeRoomId ? ['/meetings', activeRoomId, from, to] : null,
    ([, roomId, f, t]) => fetcher('/meetings', { roomId, from: f, to: t }),
    swrOpts
  );
  const { data: users } = useSWR<User[]>('/users', (p) => fetcher(p), swrOpts);
  const { data: orgs }  = useSWR<Organization[]>('/organizations', (p) => fetcher(p), swrOpts);

  const userMap = useMemo(() => new Map((users||[]).map(u => [String(u._id), u])), [users]);
  const orgMap  = useMemo(() => new Map((orgs ||[]).map(o => [String(o._id), o])), [orgs]);

  // ==== Bộ lọc nâng cao (đẹp hơn, participants chỉ 1 người) ====
  const [orgId, setOrgId] = useState<string>('');            // meeting.organizationId (đơn vị ĐẶT)
  const [organizerId, setOrganizerId] = useState<string>(''); // meeting.organizerId
  const [chairId, setChairId] = useState<string>('');        // participant role=CHAIR
  const [participantId, setParticipantId] = useState<string>(''); // ANY 1 người (REQUIRED/OPTIONAL)
  const [externalOnly, setExternalOnly] = useState<boolean>(false);
  const [statusSet, setStatusSet] = useState<Set<MeetingStatus>>(
    () => new Set<MeetingStatus>([MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS])
  );

  function shift(delta: number) {
    const d = new Date(anchor);
    if (view === 'day')   d.setDate(d.getDate() + delta);
    if (view === 'week')  d.setDate(d.getDate() + delta*7);
    if (view === 'month') d.setMonth(d.getMonth() + delta);
    setDateStr(d.toISOString().slice(0,10));
  }

  function handShowSearch() {
    setShowSearch(!showSearch);
  }

  function toggleStatus(st: MeetingStatus) {
    setStatusSet(prev => {
      const next = new Set(prev);
      next.has(st) ? next.delete(st) : next.add(st);
      return next;
    });
  }

  function clearFilters() {
    setOrgId('');
    setOrganizerId('');
    setChairId('');
    setParticipantId('');
    setExternalOnly(false);
    setStatusSet(new Set<MeetingStatus>([MeetingStatus.SCHEDULED, MeetingStatus.IN_PROGRESS]));
    setSearch('');
  }

  const filtered = useMemo(() => {
    const list = (meetings || []).slice().sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
    const q = search.trim().toLowerCase();

    return list.filter(m => {
      // Status (mặc định: SCHEDULED + IN_PROGRESS)
      if (!statusSet.has(m.status)) return false;

      // Organization đặt (booking org)
      if (orgId && String(m.organizationId) !== orgId) return false;

      // Organizer
      if (organizerId && String(m.organizerId) !== organizerId) return false;

      // Chair
      if (chairId) {
        const hasChair = (m.participants||[]).some(p => p.role === 'CHAIR' && String(p.userId) === chairId);
        if (!hasChair) return false;
      }

      // Participant (ANY 1 người, chỉ xét REQUIRED/OPTIONAL)
      if (participantId) {
        const anyHit = (m.participants||[]).some(p =>
          (p.role === 'REQUIRED' || p.role === 'OPTIONAL') && String(p.userId) === participantId
        );
        if (!anyHit) return false;
      }

      // Đoàn khách
      if (externalOnly && !(m.externalHeadcount && m.externalHeadcount > 0)) return false;

      // Search
      if (q) {
        const hit = (m.title||'').toLowerCase().includes(q)
          || (m.agenda||'').toLowerCase().includes(q)
          || (m.note||'').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [meetings, statusSet, orgId, organizerId, chairId, participantId, externalOnly, search]);

  const activeRoom = rooms.find(r => r._id === activeRoomId);

  // ==== UI ====
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Phòng họp</h1>

      {/* Tabs Phòng */}
      <div className="overflow-auto">
        <div className="inline-flex gap-2 rounded-lg border bg-white p-1">
          {rooms.map(r => (
            <button
              key={r._id}
              onClick={()=>setActiveRoomId(r._id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${activeRoomId===r._id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
              title={`${r.name} · ${r.location || '—'} · ${r.capacity} chỗ`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar: Day/Week/Month + thời điểm + search */}
      {/* Toolbar: Day/Week/Month + thời điểm + search */}
<div className="flex flex-wrap items-center gap-3">
  {/* Segmented control */}
  <div className="inline-flex rounded-lg border bg-white p-0.5">
    <button
      onClick={()=>setView('day')}
      className={`px-3 py-1.5 text-sm rounded-md ${view==='day' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
    >
      Ngày
    </button>
    <button
      onClick={()=>setView('week')}
      className={`px-3 py-1.5 text-sm rounded-md ${view==='week' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
    >
      Tuần
    </button>
    <button
      onClick={()=>setView('month')}
      className={`px-3 py-1.5 text-sm rounded-md ${view==='month' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
    >
      Tháng
    </button>
  </div>

  {/* Điều khiển mốc thời gian */}
  <div className="inline-flex items-center gap-2 rounded-lg border bg-white p-1">
    <button
      onClick={()=>shift(-1)}
      className="rounded-md border px-2 py-1.5 text-sm hover:bg-slate-100"
      title="Lùi 1 đơn vị"
    >
      ‹
    </button>

    {view === 'day' ? (
      // Ngày: input date
      <input
        type="date"
        value={dateStr}
        onChange={(e)=>setDateStr(e.target.value)}
        className="rounded-md border px-2 py-1.5 text-sm"
      />
    ) : (
      // Tuần / Tháng: hiển thị range đã tính
      <div className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium">
        {fmtDateShort(fromDate)} — {fmtDateShort(toDate)}
      </div>
    )}

    <button
      onClick={()=>shift(+1)}
      className="rounded-md border px-2 py-1.5 text-sm hover:bg-slate-100"
      title="Tiến 1 đơn vị"
    >
      ›
    </button>
  </div>

  {/* Ô search giữ nguyên */}
  <input
    value={search}
    onChange={e=>setSearch(e.target.value)}
    placeholder="Tìm tiêu đề/agenda/note…"
    className="ml-auto rounded border px-3 py-1.5 text-sm"
  />
   <button
      onClick={()=>handShowSearch()}
      className={`px-3 py-1.5 text-sm rounded-md border ${showSearch ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
    >
     {showSearch ? 'Ẩn tìm kiếm nâng cao' : 'Hiện tìm kiếm nâng cao'}
    </button>
</div>


      {/* == Filter Card (đẹp hơn, sticky) == */}
      {showSearch ? (
      <div className="sticky top-2 z-10">
        <div className="rounded-2xl border bg-white/95 backdrop-blur p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <Field label="Đơn vị tổ chức">
              <select className="w-full rounded-md border px-2 py-2 text-sm" value={orgId} onChange={e=>setOrgId(e.target.value)}>
                <option value="">Tất cả</option>
                {(orgs||[]).map(o => <option key={String(o._id)} value={String(o._id)}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Người tổ chức">
              <SelectUser value={organizerId} onChange={setOrganizerId} users={users||[]} />
            </Field>
            <Field label="Chủ tọa">
              <SelectUser value={chairId} onChange={setChairId} users={users||[]} />
            </Field>
            <Field label="Người tham gia">
              {/* single select thay vì multi */}
              <SelectUser value={participantId} onChange={setParticipantId} users={users||[]} placeholder="Tất cả" />
            </Field>
            <Field label="Khách">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={externalOnly}
                  onChange={e=>setExternalOnly(e.target.checked)}
                />
                <span className="text-sm">Có khách</span>
              </label>
            </Field>
            <Field label="Trạng thái" className="lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  MeetingStatus.PENDING_APPROVAL,
                  MeetingStatus.SCHEDULED,
                  MeetingStatus.IN_PROGRESS,
                  MeetingStatus.COMPLETED,
                  MeetingStatus.CANCELLED,
                  MeetingStatus.REJECTED,
                ].map(st => (
                  <button
                    type="button"
                    key={st}
                    onClick={()=>toggleStatus(st)}
                    className={`rounded-full border px-3 py-1 text-xs ${statusSet.has(st) ? 'bg-slate-900 text-white border-slate-900' : 'hover:bg-slate-100'}`}
                    title={st}
                  >
                    {st.replaceAll('_',' ')}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Mặc định bật: <b>SCHEDULED</b> và <b>IN_PROGRESS</b>.</div>
            </Field>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {Array.isArray(meetings) ? `${filtered.length}/${meetings.length} kết quả` : '—'}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        </div>
      </div> ) : (<></>)}

      {/* Danh sách meeting */}
      <section className="grid gap-3">
        {isLoading && <div className="text-sm text-slate-500">Đang tải…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="text-sm text-slate-500">
            Không có cuộc họp nào trong khoảng thời gian & bộ lọc đã chọn.
          </div>
        )}
        {!isLoading && filtered.map(m => (
          <MeetingRow key={String(m._id)} meeting={m} onChanged={() => mutate()} />
        ))}
      </section>

      {/* Thông tin phòng đang chọn */}
      {activeRoom && (
        <div className="text-xs text-slate-600">
          {activeRoom.name} · {activeRoom.location || '—'} · {activeRoom.capacity} chỗ · {activeRoom.requiresApproval ? 'Cần duyệt' : 'Tự động đặt'}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SelectUser({
  value, onChange, users, placeholder = 'Tất cả',
}: { value: string; onChange: (v: string)=>void; users: User[]; placeholder?: string }) {
  return (
    <select
      className="w-full rounded-md border px-2 py-2 text-sm"
      value={value}
      onChange={e=>onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {users
        .slice()
        .sort((a,b)=>a.fullName.localeCompare(b.fullName, 'vi'))
        .map(u => (
          <option key={String(u._id)} value={String(u._id)}>
            {u.fullName}
          </option>
        ))}
    </select>
  );
}

function MeetingRow({ meeting, onChanged }: { meeting: Meeting; onChanged: ()=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={()=>setOpen(true)}
        className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="truncate font-medium">{meeting.title}</div>
          <div className="text-xs text-slate-600">
            {fmt(meeting.startAt)} → {fmt(meeting.endAt)}
          </div>
        </div>
        <StatusPill status={meeting.status} />
      </button>

      {open && (
        <MeetingDetails meeting={meeting} onClose={()=>setOpen(false)} onChanged={onChanged} />
      )}
    </>
  );
}
