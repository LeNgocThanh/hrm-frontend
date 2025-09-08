'use client';

import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api/room-meetings';
import { overlaps } from '@/lib/api/time';
import { Meeting, MeetingRoom, MeetingStatus } from '@/types/room-meetings';
import { Organization } from '@/types/organization';
import { User } from '@/types/index';
import StatusPill from '@/components/roomMeeting/statusPill';
import RegistrationDetails from './registration-details';

type Props = { rooms: MeetingRoom[]; orgs: Organization[]; users: User[] };
const fetcher = (p: string, q?: Record<string, any>) => api(p, { query: q });

export default function ClientRegistration({ rooms, orgs, users }: Props) {
  // ====== Bộ lọc ======
  const [roomId, setRoomId] = useState<string>('');
  const [organizerId, setOrganizerId] = useState<string>('');
  const [chairId, setChairId] = useState<string>('');
  const [q, setQ] = useState('');
  // Khoảng thời gian: mặc định hôm nay → +30 ngày
  const anchorRef = useRef(new Date());
  const defaultFrom = useMemo(() => {
    const d = new Date(anchorRef.current); d.setHours(0,0,0,0); return d.toISOString();
  }, []);
  const defaultTo = useMemo(() => {
    const d = new Date(anchorRef.current); d.setDate(d.getDate()+30); d.setHours(23,59,59,999); return d.toISOString();
  }, []);
  const [from, setFrom] = useState<string>(defaultFrom.slice(0,10));
  const [to, setTo] = useState<string>(defaultTo.slice(0,10));

  // ====== Data ======
  const { data: pending } = useSWR<Meeting[]>(
    ['/meetings', 'pending', from, to],
    ([, , f, t]: [string, string, Date, Date]) => fetcher('/meetings', { from: f.toISOString(), to: t.toISOString(), status: MeetingStatus.PENDING_APPROVAL }),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  const { data: scheduled } = useSWR<Meeting[]>(
    ['/meetings', 'scheduled', from, to],
    ([, , f, t]: [string, string, Date, Date]) => fetcher('/meetings', { from: f.toISOString(), to: t.toISOString(), status: MeetingStatus.SCHEDULED }),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const roomMap = useMemo(() => new Map(rooms.map(r => [r._id, r])), [rooms]);
  const orgMap  = useMemo(() => new Map(orgs.map(o => [o._id, o])), [orgs]);
  const userMap = useMemo(() => new Map(users.map(u => [u._id, u])), [users]);
  const scheduledByRoom = useMemo(() => {
    const m = new Map<string, Meeting[]>();
    (scheduled||[]).forEach(me => {
      const key = String(me.roomId);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(me);
    });
    return m;
  }, [scheduled]);

  // ====== Lọc ở client theo các trường ======
  const filtered = useMemo(() => {
    const list = (pending || []).filter(m => {
      if (roomId && String(m.roomId) !== roomId) return false;
      if (organizerId && String(m.organizerId) !== organizerId) return false;
      if (chairId) {
        const hasChair = (m.participants||[]).some(p => p.role === 'CHAIR' && String(p.userId) === chairId);
        if (!hasChair) return false;
      }
      const s = new Date(m.startAt).getTime();
      const e = new Date(m.endAt).getTime();
      const f = new Date(from+'T00:00:00').getTime();
      const t = new Date(to  +'T23:59:59').getTime();
      if (!(e > f && s < t)) return false;

      if (q.trim()) {
        const QQ = q.trim().toLowerCase();
        const hitText =
          (m.title||'').toLowerCase().includes(QQ) ||
          (m.agenda||'').toLowerCase().includes(QQ) ||
          (m.note||'').toLowerCase().includes(QQ);
        if (!hitText) return false;
      }
      return true;
    }).map(m => {
      // tính conflict với meetings đã approve cùng phòng
      const others = scheduledByRoom.get(String(m.roomId)) || [];
      const s = new Date(m.startAt), e = new Date(m.endAt);
      const conflicts = others.filter(o => overlaps(s, e, new Date(o.startAt), new Date(o.endAt)));
      return { m, conflicts };
    });
    return list.sort((a,b) => +new Date(a.m.startAt) - +new Date(b.m.startAt));
  }, [pending, roomId, organizerId, chairId, from, to, q, scheduledByRoom]);

  // ====== UI ======
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Đăng ký chờ duyệt</h1>

      {/* Bộ lọc */}
      <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
        <label className="grid gap-1">
          <span className="text-xs text-slate-600">Phòng</span>
          <select className="rounded border px-2 py-1.5 text-sm" value={roomId} onChange={e=>setRoomId(e.target.value)}>
            <option value="">Tất cả</option>
            {rooms.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-slate-600">Organizer</span>
          <select className="rounded border px-2 py-1.5 text-sm" value={organizerId} onChange={e=>setOrganizerId(e.target.value)}>
            <option value="">Tất cả</option>
            {users.slice().sort((a,b)=>a.fullName.localeCompare(b.fullName,'vi')).map(u=>(
              <option key={u._id} value={u._id}>{u.fullName}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-slate-600">Chair</span>
          <select className="rounded border px-2 py-1.5 text-sm" value={chairId} onChange={e=>setChairId(e.target.value)}>
            <option value="">Tất cả</option>
            {users.slice().sort((a,b)=>a.fullName.localeCompare(b.fullName,'vi')).map(u=>(
              <option key={u._id} value={u._id}>{u.fullName}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-slate-600">Từ ngày</span>
          <input type="date" className="rounded border px-2 py-1.5 text-sm" value={from} onChange={e=>setFrom(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-slate-600">Đến ngày</span>
          <input type="date" className="rounded border px-2 py-1.5 text-sm" value={to} onChange={e=>setTo(e.target.value)} />
        </label>
        <label className="grid gap-1 lg:col-span-2">
          <span className="text-xs text-slate-600">Tìm kiếm</span>
          <input
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Tiêu đề, agenda, note…"
            value={q}
            onChange={e=>setQ(e.target.value)}
          />
        </label>
      </div>

      {/* Danh sách */}
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-slate-500">Không có đăng ký phù hợp.</div>
        ) : filtered.map(({ m, conflicts }) => {
          const room = roomMap.get(String(m.roomId));
          const orgOwner = room ? orgMap.get(String(room.organizationId)) : undefined;
          const organizer = userMap.get(String(m.organizerId));
          const chairNames = (m.participants||[])
            .filter(p => p.role==='CHAIR')
            .map(p => userMap.get(String(p.userId))?.fullName || `User#${String(p.userId).slice(-6)}`)
            .join(', ') || '—';

          return (
            <RegistrationItem
              key={m._id}
              meeting={m}
              roomName={room?.name || 'Phòng ?'}
              orgOwnerName={orgOwner?.name || '—'}
              organizerName={organizer?.fullName || String(m.organizerId)}
              chairNames={chairNames}
              conflicts={conflicts}
              usersMap={userMap}
              roomsMap={roomMap}
              orgsMap={orgMap}
            />
          );
        })}
      </div>
    </div>
  );
}

function RegistrationItem({
  meeting, roomName, orgOwnerName, organizerName, chairNames, conflicts,
  usersMap, roomsMap, orgsMap
}: {
  meeting: Meeting;
  roomName: string;
  orgOwnerName: string;
  organizerName: string;
  chairNames: string;
  conflicts: Meeting[];
  usersMap: Map<string, User>;
  roomsMap: Map<string, MeetingRoom>;
  orgsMap: Map<string, Organization>;
}) {
  const [open, setOpen] = useState(false);
  const inPast = new Date(meeting.startAt).getTime() <= Date.now();

  return (
    <>
      <button
        onClick={()=>setOpen(true)}
        className="flex w-full items-start justify-between gap-4 rounded-xl border bg-white p-4 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="font-semibold truncate">{meeting.title}</div>
          <div className="text-xs text-slate-600">
            {roomName} · Chủ quản: {orgOwnerName} · {new Date(meeting.startAt).toLocaleString()} → {new Date(meeting.endAt).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-600">Organizer: {organizerName} · Chair: {chairNames}</div>
          {conflicts.length > 0 ? (
            <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Cảnh báo trùng với {conflicts.length} cuộc họp đã approve.
            </div>
          ) : null}
          {inPast && (
            <div className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">
              Đăng ký không hợp lệ: thời điểm bắt đầu không ở tương lai.
            </div>
          )}
        </div>
        <StatusPill status={MeetingStatus.PENDING_APPROVAL} />
      </button>

      {open && (
        <RegistrationDetails
          meeting={meeting}
          onClose={()=>setOpen(false)}
          usersMap={usersMap}
          roomsMap={roomsMap}
          orgsMap={orgsMap}
          hasConflicts={conflicts.length > 0}
          disableApprove={inPast}
        />
      )}
    </>
  );
}
