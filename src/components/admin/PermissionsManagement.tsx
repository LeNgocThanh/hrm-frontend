'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Permission, Module, Action } from '@/types/permission';

// interface Permission {
//   _id: string;
//   name: string;
//   description?: string;
//   module: string;
//   action: string;
//   code?: string;
// }


export default function PermissionsManagement() {
  const { apiCall } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    module: Module.User,
    action: Action.READ,
    code: 'User:read'
  });

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const data = await apiCall('/permissions');
      setPermissions(data);
    } catch (err) {
      setError('Không thể tải danh sách quyền hạn');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      formData.code = formData.module + ':' + formData.action;
      if (editingPermission) {
        await apiCall(`/permissions/${editingPermission._id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiCall('/permissions', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      await fetchPermissions();
      resetForm();
    } catch (err) {
      setError('Có lỗi xảy ra khi lưu quyền hạn');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', module: Module.User, action: Action.READ, code: 'User:read' });
    setEditingPermission(null);
    setShowCreateForm(false);
  };

  const handleEdit = (permission: Permission) => {
    setFormData({
      name: permission.name,
      description: permission.description || '',
      module: permission.module,
      action: permission.action,
      code: permission.code || ''
    });
    setEditingPermission(permission);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa quyền hạn này?')) {
      try {
        await apiCall(`/permissions/${id}`, {
          method: 'DELETE',
        });
        await fetchPermissions();
      } catch (err) {
        setError('Không thể xóa quyền hạn');
      }
    }
  };

  if (loading) return <div className="p-6">Đang tải...</div>;

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Danh sách quyền hạn</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {showCreateForm ? 'Ẩn form' : 'Thêm quyền hạn'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6 border">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            {editingPermission ? 'Sửa quyền hạn' : 'Tạo quyền hạn mới'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên quyền hạn
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  module
                </label>
                <select
  value={formData.module}
  onChange={(e) => setFormData({ ...formData, module: e.target.value as Module })}
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  required
>
  <option value="">Chọn tài nguyên...</option>
  {Object.values(Module).map((m) => (
    <option key={m} value={m}>
      {m}
    </option>
  ))}
</select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
  value={formData.action}
  onChange={(e) => setFormData({ ...formData, action: e.target.value as Action })}
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  required
>
  <option value="">Chọn hành động...</option>
  {Object.values(Action).map((m) => (
    <option key={m} value={m}>
      {m}
    </option>
  ))}
</select>
              </div>              
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {editingPermission ? 'Cập nhật' : 'Tạo mới'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên quyền hạn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>               
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {permissions.map((permission) => (
                <tr key={permission._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {permission.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {permission.module}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {permission.action}
                  </td>                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(permission)}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(permission._id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 
