'use client';
import { MeetingStatus } from '@/types/room-meetings';

export default function StatusPill({ status }: { status: MeetingStatus }) {
  const map: Record<MeetingStatus, string> = {
    PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
    SCHEDULED:        'bg-blue-100 text-blue-800',
    IN_PROGRESS:      'bg-indigo-100 text-indigo-800',
    COMPLETED:        'bg-emerald-100 text-emerald-800',
    REJECTED:         'bg-rose-100 text-rose-800',
    CANCELLED:        'bg-gray-200 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {status.replaceAll('_',' ')}
    </span>
  );
}
