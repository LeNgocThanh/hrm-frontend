'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api/room-meetings';

type Notif = {
  _id: string;
  meetingId?: string;
  type?: string;
  title: string;
  message?: string;
  createdAt: string;
  status?: string; // normalize về 'UNREAD' | 'READ'
};
type ParticipantMini = { userId?: string; response?: 'ACCEPTED' | 'DECLINED' | 'PENDING' | 'INVITED' | string };
type BasicMeeting = {
  _id: string;
  title: string;
  startAt: string;
  endAt: string;
  roomId: string;
  organizerId: string;
  participants?: ParticipantMini[];
};

const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Bell() {
  const [open, setOpen] = useState(false);
  const [dateStr, setDateStr] = useState(() => todayStr());

  // Poll “mềm”
  const baseOpts = { revalidateOnFocus: true, revalidateOnReconnect: true, dedupingInterval: 20_000 };
  const interval = open ? 15_000 : 60_000;

  // 1) RSVP pending (to-do nhanh)
  const { data: pendingRsvp, mutate: mutPending } = useSWR<BasicMeeting[]>(
    ['/meetings/me/pending-rsvp'],
    () => fetcher('/meetings/me/pending-rsvp'),
    { ...baseOpts, refreshInterval: interval }
  );

  // 2) Notifications trong ngày (ANY) – client tách UNREAD/READ
  const { data: dayNotifsRaw, mutate: mutDay } = useSWR<Notif[]>(
    ['/notifications/day', dateStr],
    () => fetcher('/notifications/day', { date: dateStr, status: 'ANY', onlyMeeting: 1, limit: 200 }),
    { ...baseOpts, refreshInterval: interval }
  );

  // normalize status
  const dayNotifs = useMemo(
    () => (dayNotifsRaw || []).map(n => ({ ...n, status: (n.status || 'UNREAD').toString().toUpperCase() as 'UNREAD' | 'READ' })),
    [dayNotifsRaw]
  );
  const unread = useMemo(() => dayNotifs.filter(n => n.status === 'UNREAD'), [dayNotifs]);
  const read = useMemo(() => dayNotifs.filter(n => n.status === 'READ'), [dayNotifs]);

  // 3) System unread (tuỳ chọn giữ)
  const { data: sysNotifs, mutate: mutSys } = useSWR<Notif[]>(
    ['/notifications', 'UNREAD', 50],
    () => fetcher('/notifications', { status: 'UNREAD', limit: 50 }),
    { ...baseOpts, refreshInterval: interval }
  );

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    mutDay(); // item chuyển từ unread -> read, không biến mất
    mutSys();
  }
  async function markAllReadSystem() {
    await api('/notifications/read-all', { method: 'PATCH' });
    mutSys();
    mutDay();
  }
  async function rsvp(meetingId: string, response: 'ACCEPTED' | 'DECLINED') {
    await api(`/meetings/${meetingId}/rsvp`, { method: 'POST', body: JSON.stringify({ response }) });
    mutPending();
  }

  // Badge = số RSVP pending
  const pendingCount = pendingRsvp?.length ?? 0;
  const unreadDayCount = unread.length;
  const sysUnreadCount = sysNotifs?.length ?? 0;

  // Có cảnh báo “!” khi: có RSVP pending hoặc có noti chưa đọc (trong ngày hoặc hệ thống)
  const hasAlert = pendingCount > 0 || unreadDayCount > 0 || sysUnreadCount > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative rounded-full border px-3 py-1.5 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400`}
        title="Thông báo"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {/* Icon chuông */}
        <span className="inline-block">🔔</span>

        {/* Badge số (RSVP pending) */}
        {pendingCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] leading-4 text-white shadow">
            {pendingCount}
          </span>
        )}

        {/* Dấu chấm than + ping khi có alert (không đụng badge) */}
        {hasAlert && (
          <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="absolute -z-10 inline-flex h-5 w-5 animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-extrabold text-white shadow">
              !
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Bảng thông báo"
          className="absolute right-0 z-40 mt-2 w-[30rem] max-w-[90vw] overflow-hidden rounded-xl border bg-white shadow-lg"
        >
          {/* RSVP PENDING */}
          {pendingRsvp && pendingRsvp.length > 0 && (
            <>
              <div className="border-b bg-slate-50 px-3 py-2 text-xs font-medium">Cần xác nhận</div>
              <div className="max-h-56 overflow-auto">
                {pendingRsvp.map(m => {
                  const me = (m.participants || []).find(p => p && p.response);
                  const tag = me?.response === 'INVITED' ? 'INVITED'
                    : me?.response === 'PENDING' ? 'PENDING'
                      : undefined;
                  return (
                    <div key={m._id} className="border-b px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium">{m.title}</div>
                        {tag && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{tag}</span>}
                      </div>
                      <div className="text-xs text-slate-600">
                        {new Date(m.startAt).toLocaleString()} → {new Date(m.endAt).toLocaleString()}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => rsvp(m._id, 'ACCEPTED')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white shadow hover:opacity-90">Tham gia</button>
                        <button onClick={() => rsvp(m._id, 'DECLINED')} className="rounded bg-rose-600 px-2 py-1 text-xs text-white shadow hover:opacity-90">Từ chối</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* NOTIFICATIONS TRONG NGÀY */}
          <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
            <div className="text-xs font-medium">Thông báo trong ngày (cuộc họp)</div>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
              title="Chọn ngày để xem"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {(!dayNotifs || dayNotifs.length === 0) && (
              <div className="px-3 py-2 text-sm text-slate-500">Không có thông báo trong ngày.</div>
            )}

            {/* UNREAD: nổi bật (đậm + nền + chấm xanh) */}
            {unread.length > 0 && (
              <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-slate-500">Các tin Chưa đọc</div>
            )}
            {unread.map(n => (
              <div key={n._id} className="relative border-b bg-slate-50 px-3 py-2">
                <span className="absolute left-1 top-3 h-2 w-2 rounded-full bg-blue-600" />
                <div className="ml-3 truncate text-sm font-semibold">{n.title}</div>
                {n.message && <div className="ml-3 text-xs font-medium text-slate-800">{n.message}</div>}
                <div className="ml-3 mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                  <button onClick={() => markRead(n._id)} className="underline">Đã đọc</button>
                </div>
              </div>
            ))}

            {/* READ: nhạt, xuống dưới */}
            {read.length > 0 && (
              <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-slate-500">Các tin Đã đọc</div>
            )}
            {read.map(n => (
              <div key={n._id} className="border-b px-3 py-2">
                <div className="truncate text-sm">{n.title}</div>
                {n.message && <div className="text-xs text-slate-600">{n.message}</div>}
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* SYSTEM UNREAD (tuỳ chọn) */}
          {/* <div className="border-b bg-slate-50 px-3 py-2 text-xs font-medium">
            Thông báo hệ thống (chưa đọc)
            {sysNotifs && sysNotifs.length > 0 && (
              <button onClick={markAllReadSystem} className="float-right text-xs underline">Đánh dấu đã đọc tất cả</button>
            )}
          </div> */}
          {/* <div className="max-h-64 overflow-auto">
            {!sysNotifs || sysNotifs.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">Không có thông báo.</div>
            ) : sysNotifs.map(n => (
              <div key={n._id} className="border-b px-3 py-2">
                <div className="text-sm font-medium">{n.title}</div>
                {n.message && <div className="text-xs text-slate-600">{n.message}</div>}
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                  <button onClick={()=>markRead(n._id)} className="underline">Đã đọc</button>
                </div>
              </div>
            ))}
          </div> */}
        </div>
      )}
    </div>
  );
}
