import UsersManagement from '@/components/admin/UsersManagement';
import AdminLayout from '@/components/layout/AdminLayout';

export default function UsersPage() {
  return (
    <AdminLayout 
      title="Quản lý nhân sự" 
      description="Thêm, sửa, xóa và quản lý thông tin nhân viên trong hệ thống"
    >
      <UsersManagement />
    </AdminLayout>
  );
} 
