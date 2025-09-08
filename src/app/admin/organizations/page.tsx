import OrganizationsManagement from '@/components/admin/OrganizationsManagement';
import AdminLayout from '@/components/layout/AdminLayout';

export default function OrganizationsPage() {
  return (
    <AdminLayout 
      title="Quản lý tổ chức" 
      description="Quản lý cơ cấu tổ chức, phòng ban trong công ty"
    >
      <OrganizationsManagement />
    </AdminLayout>
  );
} 
