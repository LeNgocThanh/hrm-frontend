'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Gift, UserPlus, UserMinus, DoorOpen } from 'lucide-react';

// dùng đúng helper fetch bạn đã có ở module room-meetings + users
import { api } from '@/lib/api/room-meetings';
import type { MeetingRoom } from '@/types/room-meetings';
import { getUsers } from '@/lib/api/users';
import { getUserAssignmentsByUser } from '@/lib/api/user-assignments';

type MeetingStatus = 'PENDING_APPROVAL'|'SCHEDULED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'|'REJECTED';
type Participant = { userId?: string; response?: string };
type Meeting = {
  _id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: MeetingStatus;
  roomId: string;
  participants?: Participant[];
};

type User = {
  _id: string;
  fullName?: string;
  email?: string;
  birthDay?: string | Date | null;
};

type Assignment = {
  isPrimary?: boolean;
  isActive?: boolean;
  timeIn?: string | Date | null;
  timeOut?: string | Date | null;
  positionId?: string | { _id: string };
};

const at = (h: number, m = 0, s = 0, ms = 0) => {
  const d = new Date();
  d.setHours(h, m, s, ms);
  return d;
};
const startOfToday = () => at(0, 0, 0, 0);
const endOfToday = () => at(23, 59, 59, 999);
const iso = (d: Date) => d.toISOString();

const sameDay = (d?: string | Date | null) => {
  if (!d) return false;
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return false;
  const a = startOfToday().getTime(), b = endOfToday().getTime();
  return x.getTime() >= a && x.getTime() <= b;
};

const overlaps = (s1: Date, e1: Date, s2: Date, e2: Date) => s1 < e2 && e1 > s2; // chạm mép không tính trùng

export default function HomeInsights() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assigns, setAssigns] = useState<Record<string, Assignment | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 1) Rooms + meetings hôm nay (lấy theo khoảng trong ngày – không lọc status ở server để FE xử lý)
        const [r, m] = await Promise.all([
          api<MeetingRoom[]>('/meeting-rooms'),
          api<Meeting[]>('/meetings', { query: { from: iso(startOfToday()), to: iso(endOfToday()) } }),
        ]);
        setRooms(r || []);
        setMeetings((m || []).filter(x => x.status !== 'CANCELLED' && x.status !== 'REJECTED'));

        // 2) Users + primary assignment (đủ để xác định vào/ra hôm nay)
        const us = await getUsers();
        setUsers(us || []);

        // Lấy assignment chính cho từng user (tránh nặng, chỉ fetch theo nhu cầu)
        const map: Record<string, Assignment | null> = {};
        for (const u of us || []) {
          try {
            const arr = await getUserAssignmentsByUser(u._id);
            const primary = (arr || []).find((a: Assignment) => a.isPrimary) || (arr || [])[0] || null;
            map[String(u._id)] = primary;
          } catch {
            map[String(u._id)] = null;
          }
        }
        setAssigns(map);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Nhóm lịch họp hôm nay theo phòng
  const meetingsByRoom = useMemo(() => {
    const s = startOfToday(), e = endOfToday();
    const groups = new Map<string, { room: MeetingRoom; items: Meeting[] }>();
    for (const room of rooms) groups.set(String(room._id), { room, items: [] });

    for (const m of meetings) {
      const ms = new Date(m.startAt), me = new Date(m.endAt);
      if (!overlaps(s, e, ms, me)) continue;
      const key = String(m.roomId);
      if (!groups.has(key)) continue;
      groups.get(key)!.items.push(m);
    }

    // sort mỗi phòng theo giờ bắt đầu
    for (const g of groups.values()) {
      g.items.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    }
    // chỉ trả các phòng có lịch hôm nay
    return Array.from(groups.values()).filter(g => g.items.length > 0)
      .sort((a, b) => a.room.name.localeCompare(b.room.name, 'vi'));
  }, [rooms, meetings]);

  // Người mới vào hôm nay / nghỉ hôm nay / sinh nhật hôm nay
  const { newcomers, leavers, birthdays } = useMemo(() => {
    const newcomers: User[] = [];
    const leavers: User[] = [];
    const birthdays: User[] = [];

    for (const u of users) {
      const a = assigns[String(u._id)];
      // mới vào: primary.isActive true (hoặc không có isActive nhưng có timeIn) và timeIn là hôm nay
      if (a?.timeIn && sameDay(a.timeIn)) newcomers.push(u);
      // nghỉ hôm nay: primary.isActive === false và timeOut là hôm nay
      if (a && a.isActive === false && a.timeOut && sameDay(a.timeOut)) leavers.push(u);
      // sinh nhật hôm nay (chỉ so ngày-tháng)
      if (u.birthDay) {
        const d = new Date(u.birthDay as any);
        const now = new Date();
        if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth()) birthdays.push(u);
      }
    }

    // sort theo tên cho dễ đọc
    const byName = (a: User, b: User) => (a.fullName || '').localeCompare(b.fullName || '', 'vi');
    return {
      newcomers: newcomers.sort(byName),
      leavers: leavers.sort(byName),
      birthdays: birthdays.sort(byName),
    };
  }, [users, assigns]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Tổng hợp hôm nay</h2>
        <div className="text-xs text-gray-500">{new Date().toLocaleDateString()}</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-700" />
          Đang tải dữ liệu…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lịch họp hôm nay theo phòng */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <CalendarDays className="h-4 w-4" /> Lịch họp hôm nay (theo phòng)
            </div>
            {meetingsByRoom.length === 0 ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
                Không có lịch họp nào trong hôm nay.
              </div>
            ) : (
              <div className="space-y-3">
                {meetingsByRoom.map(({ room, items }) => (
                  <div key={String(room._id)} className="rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
                      <div className="font-medium">{room.name}</div>
                      <div className="text-xs text-gray-500">{items.length} cuộc họp</div>
                    </div>
                    <ul className="divide-y">
                      {items.map((m) => (
                        <li key={m._id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="truncate">
                            <span className="font-medium">{m.title || '(Không tiêu đề)'}</span>
                            <span className="ml-2 text-gray-500">
                              {new Date(m.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(m.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="rounded-full border px-2 py-0.5 text-xs text-gray-600">
                            {m.status === 'IN_PROGRESS'
                              ? 'Đang diễn ra'
                              : m.status === 'SCHEDULED'
                              ? 'Đã lên lịch'
                              : m.status === 'COMPLETED'
                              ? 'Đã kết thúc'
                              : m.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Newcomers / Leavers / Birthdays today */}
          <div className="grid gap-4">
            <ListCard
              title="Người mới vào (hôm nay)"
              icon={<UserPlus className="h-4 w-4" />}
              items={newcomers.map((u) => u.fullName || u.email || '(Không tên)')}
              empty="Không có nhân sự mới."
            />
            <ListCard
              title="Nghỉ việc (hôm nay)"
              icon={<UserMinus className="h-4 w-4" />}
              items={leavers.map((u) => u.fullName || u.email || '(Không tên)')}
              empty="Không có nhân sự nghỉ."
              badge={<span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"><DoorOpen className="h-3 w-3" /> timeOut</span>}
            />
            <ListCard
              title="Sinh nhật hôm nay"
              icon={<Gift className="h-4 w-4" />}
              items={birthdays.map((u) => u.fullName || u.email || '(Không tên)')}
              empty="Không có sinh nhật hôm nay."
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ListCard({
  title,
  items,
  empty,
  icon,
  badge,
}: {
  title: string;
  items: string[];
  empty: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200">
      <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {icon} {title}
        </div>
        {badge}
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-3 text-sm text-gray-600">{empty}</div>
      ) : (
        <ul className="divide-y">
          {items.map((txt, i) => (
            <li key={i} className="px-3 py-2 text-sm">{txt}</li>
          ))}
        </ul>
      )}
    </div>
  );
}