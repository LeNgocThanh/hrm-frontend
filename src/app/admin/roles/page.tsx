import RolesManagement from '@/components/admin/RolesManagement';
import AdminLayout from '@/components/layout/AdminLayout';
import ProtectedRoute from '@/context/ProtectedRoute';

export default function RolesPage() {
  return (
    <AdminLayout 
      title="Quản lý vai trò" 
      description="Tạo và quản lý các vai trò, phân quyền trong hệ thống"
    >
       <ProtectedRoute requiredRoles={['All:manage']}>
      <RolesManagement />
      </ProtectedRoute>
    </AdminLayout>
  );
} 
