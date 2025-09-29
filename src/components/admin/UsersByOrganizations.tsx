'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { User, CreateUserData, UpdateUserData } from '../../types';
import { getUserAssignmentsByUser } from '@/lib/api/user-assignments';
import { getPositions } from '@/lib/api/positions';
import { Position } from '@/types/position';
import { UserAssignment } from '@/types/user-assignment';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import UserAssignments from './UserAssignments';

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
  users: User[];
}

interface UserWithPosition extends User {
  positionLevel?: number;
}

export default function UsersByOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [userAssignments, setUserAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // User form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateUserData>({
    fullName: '',
    birthDay: '',
    gender: '',
    details: '',
    email: '',
    phone: '',
    avatarUrl: '',
    employeeStatus: 'active'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [orgsData, usersData, positionsData] = await Promise.all([
        apiClient.get<Organization[]>('/organizations'),
        apiClient.getUsers(),
        getPositions()
      ]);

      setOrganizations(orgsData);
      setAllUsers(usersData as User[]);
      setPositions(positionsData);

      // Fetch all user assignments
      const allAssignments: UserAssignment[] = [];
      for (const user of usersData as User[]) {
        try {
          const assignments = await getUserAssignmentsByUser(user._id);
          allAssignments.push(...assignments);
        } catch (err) {
          console.error(`Error fetching assignments for user ${user._id}:`, err);
        }
      }
      setUserAssignments(allAssignments);

      buildTreeWithUsers(orgsData, usersData as User[], allAssignments, positionsData);
    } catch (err) {
      setError('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const buildTreeWithUsers = (
    orgs: Organization[],
    users: User[],
    assignments: UserAssignment[],
    positions: Position[]
  ) => {
    const orgMap = new Map<string, TreeNode>();

    // Tạo tất cả nodes
    orgs.forEach(org => {
      orgMap.set(org._id, { ...org, children: [], users: [] });
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

    // Gán users vào các organization nodes
    assignments.forEach(assignment => {
      const orgId = typeof assignment.organizationId === 'object'
        ? (assignment.organizationId as any)._id
        : assignment.organizationId;
      const userId = typeof assignment.userId === 'object'
        ? (assignment.userId as any)._id
        : assignment.userId;

      const orgNode = orgMap.get(orgId);
      const user = users.find(u => u._id === userId);

      if (orgNode && user && !orgNode.users.find(u => u._id === user._id)) {
        // Get position level for sorting
        const positionId = typeof assignment.positionId === 'object'
          ? (assignment.positionId as any)._id
          : assignment.positionId;
        const position = positions.find(p => p._id === positionId);

        const userWithPosition: UserWithPosition = {
          ...user,
          positionLevel: position?.level || 999
        };

        orgNode.users.push(userWithPosition);
      }
    });

    // Sort users in each organization
    orgMap.forEach(node => {
      node.users.sort((a: UserWithPosition, b: UserWithPosition) => {
        // Sort by position level first, then by fullName
        if (a.positionLevel !== b.positionLevel) {
          return (a.positionLevel || 999) - (b.positionLevel || 999);
        }
        return a.fullName.localeCompare(b.fullName);
      });
    });

    // Lấy root nodes
    const roots = Array.from(orgMap.values()).filter(org => !org.parent);
    setTreeData(roots);
  };

  const normalizeEmptyToNull = (data: any) => {
    const normalized = { ...data };
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === '') {
        normalized[key] = null;
      }
    });
    return normalized;
  };

  const handleInputChange = (field: keyof CreateUserData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedData = normalizeEmptyToNull(formData);
      const newUser = await apiClient.createUser(normalizedData);
      await fetchData();
      setCreatedUserId((newUser as User)._id);
      setEditingUser(newUser as User);
      setError(null);
    } catch (err) {
      setError('Failed to create user');
      console.error('Error creating user:', err);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData: UpdateUserData = { ...formData };
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof UpdateUserData] === '') {
          delete updateData[key as keyof UpdateUserData];
        }
      });
      const normalizedData = normalizeEmptyToNull(updateData);
      await apiClient.updateUser(editingUser._id, normalizedData);
      await fetchData();
      setCreatedUserId(editingUser._id);
      setError(null);
    } catch (err) {
      setError('Failed to update user');
      console.error('Error updating user:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await apiClient.deleteUser(id);
      await fetchData();
      setError(null);
    } catch (err) {
      setError('Failed to delete user');
      console.error('Error deleting user:', err);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      birthDay: user.birthDay ? user.birthDay.slice(0, 10) : '',
      gender: user.gender || '',
      details: user.details || '',
      email: user.email,
      phone: user.phone || '',
      avatarUrl: user.avatarUrl || '',
      employeeStatus: user.employeeStatus
    });
    setShowCreateForm(true);
    setCreatedUserId(user._id);
  };

  const handleAddUser = (orgId: string) => {
    setSelectedOrgId(orgId);
    setEditingUser(null);
    setFormData({
      fullName: '',
      birthDay: '',
      gender: '',
      details: '',
      email: '',
      phone: '',
      avatarUrl: '',
      employeeStatus: 'active'
    });
    setShowCreateForm(true);
    setCreatedUserId(null);
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      birthDay: '',
      gender: '',
      details: '',
      email: '',
      phone: '',
      avatarUrl: '',
      employeeStatus: 'active'
    });
    setEditingUser(null);
    setShowCreateForm(false);
    setSelectedOrgId('');
    setCreatedUserId(null);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getPositionName = (userId: string, orgId: string) => {
    const assignment = userAssignments.find(a => {
      const assignmentUserId = typeof a.userId === 'object' ? (a.userId as any)._id : a.userId;
      const assignmentOrgId = typeof a.organizationId === 'object' ? (a.organizationId as any)._id : a.organizationId;
      return assignmentUserId === userId && assignmentOrgId === orgId;
    });

    if (assignment) {
      const positionId = typeof assignment.positionId === 'object' ? (assignment.positionId as any)._id : assignment.positionId;
      const position = positions.find(p => p._id === positionId);
      return position?.name || 'N/A';
    }
    return 'N/A';
  };

  const renderTreeNode = (node: TreeNode, level = 0) => (
    <div key={node._id} className="mb-4">
      <div
        className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm"
        style={{ marginLeft: level * 20 }}
      >
        {(node.children.length > 0 || node.users.length > 0) && (
          <button
            onClick={() => toggleExpand(node._id)}
            className="mr-2 text-blue-600 hover:text-blue-800"
          >
            {expanded[node._id] ? '📂' : '📁'}
          </button>
        )}

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">{node.name}</h4>
              {node.description && (
                <p className="text-sm text-blue-700">{node.description}</p>
              )}
              <span className="text-xs text-blue-500">
                Cấp {node.level} • {node.users.length} nhân viên
              </span>
            </div>

            <button
              onClick={() => handleAddUser(node._id)}
              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
              title="Thêm nhân viên"
            >
              + Thêm nhân viên
            </button>
          </div>
        </div>
      </div>

      {expanded[node._id] && (
        <div className="mt-2" style={{ marginLeft: (level + 1) * 20 }}>
          {/* Users list */}
          {node.users.length > 0 && (
            <div className="mb-4">
              <div className="space-y-2">
                {node.users.map(user => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h5 className="font-medium text-gray-900">{user.fullName}</h5>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">{getPositionName(user._id, node._id)}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.phone && <span>📞 {user.phone}</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.birthDay && <span>🎂 {formatDate(user.birthDay)}</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.gender && <span>{user.gender}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${user.employeeStatus === 'active'
                        ? 'bg-green-100 text-green-800'
                        : user.employeeStatus === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {user.employeeStatus}
                      </span>

                      <button
                        onClick={() => handleEdit(user)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Sửa
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Child organizations */}
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
        <h2 className="text-2xl font-semibold text-gray-800">Nhân viên theo tổ chức</h2>
      </div>

      {showCreateForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6 border">
          <h3 className="text-lg font-medium mb-4 text-gray-800">
            {editingUser ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
            {selectedOrgId && (
              <span className="text-sm text-gray-600 ml-2">
                (vào {organizations.find(o => o._id === selectedOrgId)?.name})
              </span>
            )}
          </h3>
          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Tên đầy đủ"
                value={formData.fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('fullName', e.target.value)}
                required
              />
              <Input
                label="Ngày sinh"
                type="date"
                value={formData.birthDay}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('birthDay', e.target.value)}
              />
              <Select
                label="Giới tính"
                value={formData.gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('gender', e.target.value)}
                options={[
                  { value: '', label: '-- Chọn giới tính --' },
                  { value: 'Nam', label: 'Nam' },
                  { value: 'Nữ', label: 'Nữ' }
                ]}
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
              />
              <Input
                label="Số điện thoại"
                value={formData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('phone', e.target.value)}
              />
              <Select
                label="Trạng thái"
                value={formData.employeeStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('employeeStatus', e.target.value)}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'terminated', label: 'Terminated' }
                ]}
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chi tiết
              </label>
              <textarea
                value={formData.details}
                onChange={(e) => handleInputChange('details', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                {editingUser ? 'Cập nhật' : 'Tạo mới'}
              </Button>
              <Button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-700"
              >
                Hủy
              </Button>
            </div>
          </form>

          {/* UserAssignments component */}
          {(editingUser?._id || createdUserId) && (
            <div className="mt-8">
              <UserAssignments userId={editingUser?._id || createdUserId!} />
            </div>
          )}
        </div>
      )}

      {/* Organization Tree with Users */}
      <div className="space-y-2">
        {treeData.length === 0 ? (
          <p className="text-gray-500">Chưa có tổ chức nào</p>
        ) : (
          treeData.map(node => renderTreeNode(node))
        )}
      </div>
    </div>
  );
}