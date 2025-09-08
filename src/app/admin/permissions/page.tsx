import PermissionsManagement from '@/components/admin/PermissionsManagement';
import AdminLayout from '@/components/layout/AdminLayout';
import ProtectedRoute from '@/context/ProtectedRoute';

export default function PermissionsPage() {
  return (
    <AdminLayout
      title="Quản lý quyền hạn"
      description="Tạo và quản lý các quyền hạn trong hệ thống"
    >
      <ProtectedRoute requiredRoles={['All:manage']}>
        <PermissionsManagement />
      </ProtectedRoute>
    </AdminLayout>
  );
}
