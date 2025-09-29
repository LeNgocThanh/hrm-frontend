'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Organization {
  isActive: boolean;
  _id: string;
  name: string;
  description?: string;
  path?: string;
  parent?: string;
  level: number;
  createdAt: string;
}

interface TreeNode extends Organization {
  children: TreeNode[];
}

export default function OrganizationsManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent: '',
    path: '',
    level: 1,
    isActive: true
  });
  const { apiCall } = useAuth();

  useEffect(() => {

    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      //const result = await apiCall('/auth/profile');
      const data = await apiClient.get<Organization[]>('/organizations');
      setOrganizations(data);
      buildTree(data);
    } catch (err) {      
      setError('Không thể tải danh sách tổ chức');
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (orgs: Organization[]) => {
    const orgMap = new Map<string, TreeNode>();

    // Tạo tất cả nodes
    orgs.forEach(org => {
      orgMap.set(org._id, { ...org, children: [] });
    });

    // Xây dựng quan hệ cha-con
    orgs.forEach(org => {
      if (org.parent && orgMap.has(org.parent)) {
        const parentNode = orgMap.get(org.parent);
        const childNode = orgMap.get(org._id);
        if (parentNode && childNode) {
          parentNode.children.push(childNode);
        }
      }
    });

    // Lấy root nodes
    const roots = Array.from(orgMap.values()).filter(org => !org.parent);
    setTreeData(roots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let submitData = { ...formData };

      // Calculate path and level based on parent
      if (formData.parent) {
        const parentOrg = organizations.find(org => org._id === formData.parent);
        if (parentOrg) {
          submitData.path = (parentOrg.path || '') + '/' + parentOrg._id;
          submitData.level = parentOrg.level + 1;
          submitData.parent = parentOrg._id;
        }
      } else {
        submitData.path = '';
        submitData.level = 1;
      }

      if (editingOrg) {
        await apiClient.put(`/organizations/${editingOrg._id}`, submitData);
      } else {
        await apiClient.post('/organizations', submitData);
      }
      await fetchOrganizations();
      resetForm();
    } catch (err) {      
      setError('Có lỗi xảy ra khi lưu tổ chức');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', parent: '', path: '', level: 1, isActive: true });
    setEditingOrg(null);
    setShowCreateForm(false);
    setSelectedParent('');
  };

  const handleEdit = (org: Organization) => {
    setFormData({
      name: org.name,
      description: org.description || '',
      parent: org.parent || '',
      path: org.path || '',
      level: org.level,
      isActive: org.isActive
    });
    setEditingOrg(org);
    setShowCreateForm(true);
  };

  const handleAddChild = (parentId: string) => {
    // setSelectedParent(parentId);
    setFormData({
      name: '',
      description: '',
      parent: parentId,
      path: '',
      level: 1,
      isActive: true
    });
    setEditingOrg(null);
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa tổ chức này?')) {
      try {
        await apiClient.delete(`/organizations/${id}`);
        await fetchOrganizations();
      } catch (err) {
        setError('Không thể xóa tổ chức');
      }
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTreeNode = (node: TreeNode, level = 0) => (
    <div key={node._id} className="mb-2">
      <div
        className="flex items-center p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
        style={{ marginLeft: level * 20 }}
      >
        {node.children.length > 0 && (
          <button
            onClick={() => toggleExpand(node._id)}
            className="mr-2 text-gray-500 hover:text-gray-700"
          >
            {expanded[node._id] ? '📂' : '📁'}
          </button>
        )}

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">{node.name}</h4>
              {node.description && (
                <p className="text-sm text-gray-500">{node.description}</p>
              )}
              <span className="text-xs text-gray-400">Cấp {node.level}</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full ${node.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {node.isActive ? 'Hoạt động' : 'Không hoạt động'}
              </span>

              <button
                onClick={() => handleAddChild(node._id)}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Thêm con"
              >
                + Con
              </button>

              <button
                onClick={() => handleEdit(node)}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                title="Sửa"
              >
                Sửa
              </button>

              <button
                onClick={() => handleDelete(node._id)}
                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                title="Xóa"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      </div>

      {node.children.length > 0 && expanded[node._id] && (
        <div className="mt-2">
          {node.children.map(child => renderTreeNode(child, level + 1))}
        </div>
      )}
    </div>
  );

  if (loading) return <div className="p-6">Đang tải...</div>;

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Quản lý tổ chức</h2>
        <div className="space-x-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {showCreateForm ? 'Ẩn form' : 'Thêm tổ chức'}
          </button>
          <button
            onClick={() => setShowTableView(!showTableView)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {showTableView ? 'Ẩn bảng' : 'Xem bảng'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6 border">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            {editingOrg ? 'Sửa tổ chức' : selectedParent ? 'Thêm tổ chức con' : 'Tạo tổ chức mới'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên tổ chức
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
                Mô tả
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            {!selectedParent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tổ chức cha
                </label>
                <select
                  value={formData.parent}
                  onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn tổ chức cha --</option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={formData.isActive.toString()}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Hoạt động</option>
                <option value="false">Không hoạt động</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {editingOrg ? 'Cập nhật' : 'Tạo mới'}
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

      {/* Tree View */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-4 text-gray-800">Cơ cấu tổ chức</h3>
        <div className="space-y-2">
          {treeData.length === 0 ? (
            <p className="text-gray-500">Chưa có tổ chức nào</p>
          ) : (
            treeData.map(node => renderTreeNode(node))
          )}
        </div>
      </div>

      {/* Table View - Collapsible */}
      {showTableView && (
        <div className="bg-white rounded-lg overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tên tổ chức
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mô tả
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cấp độ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => (
                  <tr key={org._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {org.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {org.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Cấp {org.level}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${org.isActive === true
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {org.isActive === true ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(org)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(org._id)}
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
      )}
    </div>
  );
} 
