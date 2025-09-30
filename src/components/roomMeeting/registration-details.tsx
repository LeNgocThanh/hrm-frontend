'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Meeting, MeetingRoom, MeetingStatus } from '@/types/room-meetings';
import { Organization } from '@/types/organization';
import { User } from '@/types/index';
import StatusPill from '@/components/roomMeeting/statusPill';
import { api } from '@/lib/api/room-meetings';

export default function RegistrationDetails({
  meeting, onClose, usersMap, roomsMap, orgsMap, hasConflicts, disableApprove
}: {
  meeting: Meeting;
  onClose: () => void;
  usersMap: Map<string, User>;
  roomsMap: Map<string, MeetingRoom>;
  orgsMap: Map<string, Organization>;
  hasConflicts?: boolean;
  disableApprove?: boolean;
}) {
  const router = useRouter();

  const room = roomsMap.get(String(meeting.roomId));
  const roomOwner = room ? orgsMap.get(String(room.organizationId)) : undefined;
  const organizer = usersMap.get(String(meeting.organizerId));

  const chairs = (meeting.participants || []).filter(p => p.role === 'CHAIR');
  const chairNames = chairs.length
    ? chairs.map(p => usersMap.get(String(p.userId))?.fullName || `User#${String(p.userId).slice(-6)}`).join(', ')
    : '—';

  const participants = useMemo(() => (
    (meeting.participants || []).map(p => ({
      id: String(p.userId),
      name: usersMap.get(String(p.userId))?.fullName || `User#${String(p.userId).slice(-6)}`,
      role: p.role,
      response: p.response,
      note: p.note,
    }))
  ), [meeting.participants, usersMap]);

  async function approve(decision: 'APPROVED' | 'REJECTED') {
    if (decision === 'APPROVED' && disableApprove) return;
    try {
      await api(`/meetings/${meeting._id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
        credentials: 'include'
      });
      router.refresh();
      onClose();
    } catch (e: any) {
      alert(e.message || 'Có lỗi xảy ra khi duyệt');
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/20">
      <div className="h-full w-full max-w-xl overflow-auto rounded-l-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold">Chi tiết đăng ký</h3>
          <button onClick={onClose} className="rounded-md border px-2 py-1 text-sm hover:bg-slate-100">Đóng</button>
        </div>

        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-base font-medium">{meeting.title}</div>
            <div className="text-xs text-slate-600">
              {room?.name || 'Phòng ?'} · Chủ quản: {roomOwner?.name || '—'}
            </div>
          </div>
          <StatusPill status={meeting.status} />
        </div>

        {/* Basics */}
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Thời gian:</span> {new Date(meeting.startAt).toLocaleString()} → {new Date(meeting.endAt).toLocaleString()}</div>
          <div><span className="font-medium">Người tổ chức:</span> {organizer?.fullName || String(meeting.organizerId)}</div>
          <div><span className="font-medium">Chủ tọa (Chair):</span> {chairNames}</div>
          {meeting.agenda && <div><span className="font-medium">Agenda:</span> {meeting.agenda}</div>}
          {meeting.note && <div><span className="font-medium">Ghi chú:</span> {meeting.note}</div>}
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
                    <div className="text-xs"><span className="rounded-full border px-2 py-0.5">{p.role}</span></div>
                    <div className="mt-1 text-[11px] text-slate-500">{p.response}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Warnings */}
        <div className="mt-4 space-y-2 text-xs">
          {disableApprove && (
            <div className="rounded border border-rose-300 bg-rose-50 p-2 text-rose-800">
              Đăng ký không hợp lệ: thời điểm bắt đầu không ở tương lai.
            </div>
          )}
          {hasConflicts && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
              Lưu ý: thời gian trùng với lịch đã duyệt khác trong phòng này.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => approve('APPROVED')}
            disabled={!!disableApprove}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
            title={disableApprove ? 'Không thể duyệt cuộc họp quá khứ' : 'Phê duyệt'}
          >
            Duyệt
          </button>
          <button
            onClick={() => approve('REJECTED')}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
