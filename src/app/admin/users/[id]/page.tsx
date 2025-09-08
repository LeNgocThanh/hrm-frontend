'use client';
import { useParams } from 'next/navigation';
import UserAssignments from '@/components/admin/UserAssignments';

export default function UserDetailPage() {
  const params = useParams();
  const userId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2>Chi tiết User: {userId}</h2>
      {/* Có thể hiển thị thêm thông tin user ở đây */}
      <UserAssignments userId={userId} />
    </div>
  );
} 