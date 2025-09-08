import UsersByOrganizations from '@/components/admin/UsersByOrganizations';
import AdminLayout from '@/components/layout/AdminLayout';

export default function UsersByOrganizationsPage() {
  return (
    <AdminLayout 
      title="Nhân viên theo tổ chức" 
      description="Xem và quản lý nhân viên theo cơ cấu tổ chức"
    >
      <UsersByOrganizations />
    </AdminLayout>
  );
}