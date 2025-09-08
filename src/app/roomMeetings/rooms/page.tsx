import { api } from '@/lib/api/room-meetings';
import { MeetingRoom } from '@/types/room-meetings';
import Client from '../../../components/roomMeeting/client';

export const metadata = { title: 'Phòng họp' };

export default async function RoomsTabbedPage() {
  const rooms = await api<MeetingRoom[]>('/meeting-rooms');
  return <Client rooms={rooms} />;
}
