import { api } from '@/lib/api/room-meetings';
import { MeetingRoom } from '@/types/room-meetings';
import MeetingsDashboard from '@/components/roomMeeting/MeetingsDashboard';

export const metadata = { title: 'Dashboard họp' };

export default async function MeetingsDashboardPage() {
  const rooms = await api<MeetingRoom[]>('/meeting-rooms');
  return <MeetingsDashboard rooms={rooms} />;
}
