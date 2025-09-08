'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/room-meetings';
import { fmt } from '@/lib/api/time';
import StatusPill from '@/components/roomMeeting/statusPill';
import {
  Meeting,
  MeetingStatus,
  MeetingRoom, 
} from '@/types/room-meetings';

import { User} from '@/types/index';

type Props = {
  meeting: Meeting;
  onClose: () => void;
  onChanged: () => void;
};

const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });

export default function MeetingDetails({ meeting, onClose, onChanged }: Props) {
  const router = useRouter();

  // Map tên phòng / user
  const { data: users } = useSWR<User[]>('/users', (p)=>fetcher(p), { revalidateOnFocus:false, dedupingInterval: 5*60_000 });
  const { data: rooms } = useSWR<MeetingRoom[]>('/meeting-rooms', (p)=>fetcher(p), { revalidateOnFocus:false, dedupingInterval: 5*60_000 });

  const userMap = useMemo(()=> new Map((users||[]).map(u=>[String(u._id), u.fullName])), [users]);
  const roomMap = useMemo(()=> new Map((rooms||[]).map(r=>[String(r._id), r.name])), [rooms]);

  const organizerName = userMap.get(String(meeting.organizerId)) || String(meeting.organizerId);
  const roomName = roomMap.get(String(meeting.roomId)) || String(meeting.roomId);

  const chairs = (meeting.participants||[]).filter(p=>p.role==='CHAIR');
  const chairNames = chairs.length
    ? chairs.map(p=> userMap.get(String(p.userId)) || `User#${String(p.userId).slice(-6)}`).join(', ')
    : '—';

  const participants = useMemo(() => (
    (meeting.participants||[]).map(p => ({
      id: String(p.userId),
      name: userMap.get(String(p.userId)) || `User#${String(p.userId).slice(-6)}`,
      role: p.role,
      response: p.response,
      note: p.note,
    }))
  ), [meeting.participants, userMap]);

  async function approve(decision: 'APPROVED'|'REJECTED') {
    try {
      await api(`/meetings/${meeting._id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      onChanged();
      onClose();
      router.refresh();
    } catch (e:any) {
      alert(e.message || 'Có lỗi xảy ra khi duyệt');
    }
  }

  // === Backdrop click to close ===
  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/20"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl overflow-auto rounded-l-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold">Chi tiết cuộc họp</h3>
          <button
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-sm hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>

        {/* Title & Status */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-base font-medium truncate">{meeting.title}</div>
          <StatusPill status={meeting.status} />
        </div>

        {/* Basics */}
        <div className="space-y-2 text-sm">
          {meeting.agenda && (<div><span className="font-medium">Agenda:</span> {meeting.agenda}</div>)}
          {meeting.note &&   (<div><span className="font-medium">Ghi chú:</span> {meeting.note}</div>)}
          <div><span className="font-medium">Thời gian:</span> {fmt(meeting.startAt)} → {fmt(meeting.endAt)}</div>
          <div><span className="font-medium">Phòng:</span> {roomName}</div>
          <div><span className="font-medium">Người tổ chức:</span> {organizerName}</div>
          <div><span className="font-medium">Chủ tọa (Chair):</span> {chairNames}</div>
        </div>

        {/* Participants */}
        <div className="mt-4">
          <div className="mb-2 text-sm font-medium">Người tham gia</div>
          {participants.length === 0 ? (
            <div className="text-sm text-slate-500">Không có người tham gia.</div>
          ) : (
            <ul className="divide-y rounded-md border">
              {participants.map(p => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate">{p.name}</div>
                    {p.note && <div className="text-xs text-slate-600">{p.note}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs">
                      <span className="rounded-full border px-2 py-0.5">{p.role}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">{p.response}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* External guests summary */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded border p-2">
            <div className="text-xs text-slate-500">Đoàn khách</div>
            <div className="text-sm">{meeting.externalHeadcount || 0} người</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-xs text-slate-500">Trạng thái</div>
            <div className="text-sm">{meeting.status.replaceAll('_',' ')}</div>
          </div>
        </div>

        {/* Hành động phê duyệt nếu cần */}
        {meeting.status === MeetingStatus.PENDING_APPROVAL && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={()=>approve('APPROVED')}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:opacity-90"
            >Duyệt</button>
            <button
              onClick={()=>approve('REJECTED')}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white hover:opacity-90"
            >Từ chối</button>
          </div>
        )}
      </div>
    </div>
  );
}
