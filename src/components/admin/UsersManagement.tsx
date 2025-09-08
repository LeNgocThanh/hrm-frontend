'use client';

import React, { useState, useEffect } from 'react';
import { User, CreateUserData, UpdateUserData } from '../../types';
import { apiClient } from '../../lib/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import UserAssignments from './UserAssignments';
import UserProfileManagement from './UserProfileManagement';
import UserDocumentManagement from './UserDocumentManagement';

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [showUserDocuments, setShowUserDocuments] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  
  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<'fullName' | 'birthDay' | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const [showUserAssignments, setShowUserAssignments] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const userInfo = sessionStorage.getItem('userInfo');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [users, searchTerm, genderFilter, statusFilter, sortField, sortDirection]);

  const applyFiltersAndSort = () => {
    let filtered = [...users];

    // Search by fullName
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by gender
    if (genderFilter) {
      filtered = filtered.filter(user => user.gender === genderFilter);
    }

    // Filter by employee status
    if (statusFilter) {
      filtered = filtered.filter(user => user.employeeStatus === statusFilter);
    }

    // Sort
    if (sortField) {
  filtered.sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    let comparisonValueA;
    let comparisonValueB;

    if (sortField === 'birthDay') {
      comparisonValueA = aValue ? new Date(aValue).getTime() : 0;
      comparisonValueB = bValue ? new Date(bValue).getTime() : 0;
    } else {
      comparisonValueA = aValue?.toLowerCase() || '';
      comparisonValueB = bValue?.toLowerCase() || '';
    }

    if (sortDirection === 'asc') {
      if (typeof comparisonValueA === 'string' && typeof comparisonValueB === 'string') {
        return comparisonValueA.localeCompare(comparisonValueB);
      }
      return comparisonValueA > comparisonValueB ? 1 : -1;
    } else {
      if (typeof comparisonValueA === 'string' && typeof comparisonValueB === 'string') {
        return comparisonValueB.localeCompare(comparisonValueA);
      }
      return comparisonValueA < comparisonValueB ? 1 : -1;
    }
  });
}

    setFilteredUsers(filtered);
  };

  const handleSort = (field: 'fullName' | 'birthDay') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUsers();
      setUsers(data as User[]);
      setError(null);
    } catch (err) {
      
      setError('Không thể lấy dữ liệu nhân sự');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateUserData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    setCreatedUserId(null);
  };

  function normalizeEmptyToNull<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const key in obj) {
    if (obj[key] === "") {
      result[key] = null;
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedData = normalizeEmptyToNull(formData);
      const newUser = await apiClient.createUser(normalizedData);
      await fetchUsers();
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
      await fetchUsers();
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
      await fetchUsers();
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

  const handleViewDetail = (user: User) => {
    setViewingUser(user);
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
    setShowDetailView(true);
    setCreatedUserId(user._id);
  };

  const closeDetailView = () => {
    setViewingUser(null);
    setShowDetailView(false);
    setCreatedUserId(null);
  };

  function hasAllManagePermission(userInfo: { scopedPermissions: { permissions: any; }; }) {
  // Sử dụng optional chaining (?.) để tránh lỗi nếu các thuộc tính không tồn tại
  const permissions = userInfo?.scopedPermissions?.permissions;

  // Kiểm tra nếu permissions là một mảng và chứa "All:manage"
  if (Array.isArray(permissions)) {
    return permissions.includes("All:manage");
  }

  // Trả về false nếu permissions không phải là mảng hoặc không tồn tại
  return false;
}

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">Danh sách nhân sự</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {showCreateForm ? 'Ẩn form' : editingUser !== null ? 'Tiếp tục thêm, Sửa người dùng' : 'Thêm mới người dùng'}
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tìm kiếm theo tên
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên để tìm kiếm..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lọc theo giới tính
            </label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lọc theo trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setGenderFilter('');
                setStatusFilter('');
                setSortField('');
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6 border">
          {/* Toggle View/Edit Mode */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-800">
              {editingUser ? 'Thông tin người dùng' : 'Tạo người dùng mới'}
            </h3>
            {editingUser && (
              <button
                type="button"
                onClick={() => setViewMode(!viewMode)}
                className="px-4 py-2 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
              >
                {viewMode ? 'Chế độ sửa' : 'Chế độ xem'}
              </button>
            )}
          </div>

          {viewMode && editingUser ? (
            /* View Mode */
            <div className="space-y-6">
              {/* Basic Information Card */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-3">
                    👤
                  </span>
                  Thông tin cơ bản
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Họ và tên</label>
                      <p className="text-lg font-semibold text-gray-900">{formData.fullName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900">{formData.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Số điện thoại</label>
                      <p className="text-gray-900">{formData.phone || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Ngày sinh</label>
                      <p className="text-gray-900">
                        {formData.birthDay ? new Date(formData.birthDay).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Giới tính</label>
                      <p className="text-gray-900">{formData.gender || 'Chưa cập nhật'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Trạng thái</label>
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                        formData.employeeStatus === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : formData.employeeStatus === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {formData.employeeStatus === 'active' ? 'Đang làm việc' : 
                         formData.employeeStatus === 'inactive' ? 'Tạm nghỉ' : 'Đã nghỉ việc'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information Card */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3">
                    📝
                  </span>
                  Thông tin bổ sung
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Chi tiết</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                      {formData.details || 'Chưa có thông tin chi tiết'}
                    </p>
                  </div>
                  {formData.avatarUrl && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Avatar</label>
                      <div className="mt-2">
                        <img 
                          src={formData.avatarUrl} 
                          alt="Avatar" 
                          className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  onClick={() => setViewMode(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Chỉnh sửa thông tin
                </Button>
                <Button 
                  type="button" 
                  onClick={resetForm}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Đóng
                </Button>
              </div>
            </div>
          ) : (
            /* Edit Mode - Original Form */
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={formData.fullName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('fullName', e.target.value)}
                  required
                />
                <Input
                  label="Ngày sinh"
                  type="date"
                  value={formData.birthDay}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('birthDay', e.target.value)}
                  required
                />
                <Select
                  label="Giới tính"
                  value={formData.gender}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('gender', e.target.value)}
                  options={[
                    { value: '', label: 'Chọn giới tính' },
                    { value: 'Nam', label: 'Nam' },
                    { value: 'Nữ', label: 'Nữ' }
                  ]}
                  required
                />
                <Input
                  label="Chi tiết"
                  value={formData.details}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('details', e.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
                />
                <Input
                  label="Phone"
                  value={formData.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('phone', e.target.value)}
                />              
                <Input
                  label="Avatar URL"
                  value={formData.avatarUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('avatarUrl', e.target.value)}
                />
                <Select
                  label="Employee Status"
                  value={formData.employeeStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInputChange('employeeStatus', e.target.value)}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'terminated', label: 'Terminated' }
                  ]}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {editingUser ? 'Sửa' : 'Tạo mới'}
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
          )}
          {/* Hiển thị UserAssignments và UserProfileManagement nếu đã có userId */}
          {(editingUser?._id || createdUserId) && (
            <div className="mt-8 space-y-6">
              {/* UserAssignments Section */}
              <div className="border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                  <h4 className="text-lg font-medium text-gray-800">Phân công công việc</h4>
                  <button
                    onClick={() => setShowUserAssignments(!showUserAssignments)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    {showUserAssignments ? 'Ẩn' : 'Hiển thị'}
                  </button>
                </div>
                {showUserAssignments && (
                  <div className="p-4">
                    <UserAssignments userId={editingUser?._id || createdUserId!} />
                  </div>
                )}
              </div>

              {/* UserProfileManagement Section */}
              <div className="border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                  <h4 className="text-lg font-medium text-gray-800">Hồ sơ cá nhân</h4>
                  <button
                    onClick={() => setShowUserProfile(!showUserProfile)}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    {showUserProfile ? 'Ẩn' : 'Hiển thị'}
                  </button>
                </div>
                {showUserProfile && (
                  <div className="p-4">
                    <UserProfileManagement userId={editingUser?._id || createdUserId!} />
                  </div>
                )}
              </div>

              {/* UserDocumentManagement Section */}
              <div className="border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                  <h4 className="text-lg font-medium text-gray-800">Quản lý tài liệu</h4>
                  <button
                    onClick={() => setShowUserDocuments(!showUserDocuments)}
                    className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                  >
                    {showUserDocuments ? 'Ẩn' : 'Hiển thị'}
                  </button>
                </div>
                {showUserDocuments && (
                  <div className="p-4">
                    <UserDocumentManagement userId={editingUser?._id || createdUserId!} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('fullName')}
                >
                  <div className="flex items-center">
                    Tên đầy đủ
                    {sortField === 'fullName' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số điện thoại
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('birthDay')}
                >
                  <div className="flex items-center">
                    Ngày sinh
                    {sortField === 'birthDay' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giới tính
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
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.birthDay)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.gender || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.employeeStatus === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : user.employeeStatus === 'inactive'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.employeeStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewDetail(user)}
                      className="text-green-600 hover:text-green-900 transition-colors"
                    >
                      Xem
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Không tìm thấy người dùng nào
            </div>
          )}
        </div>
      </div>

      {/* Detail View Modal */}
      {showDetailView && viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">
                Chi tiết thông tin - {viewingUser.fullName}
              </h2>
              <button
                onClick={closeDetailView}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Basic Information */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
                  <span className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-3 text-lg">
                    👤
                  </span>
                  Thông tin cơ bản
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Họ và tên</label>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{formData.fullName}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900 mt-1">{formData.email}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Số điện thoại</label>
                      <p className="text-gray-900 mt-1">{formData.phone || 'Chưa cập nhật'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Ngày sinh</label>
                      <p className="text-gray-900 mt-1">
                        {formData.birthDay ? new Date(formData.birthDay).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Giới tính</label>
                      <p className="text-gray-900 mt-1">{formData.gender || 'Chưa cập nhật'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Trạng thái</label>
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full mt-1 ${
                        formData.employeeStatus === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : formData.employeeStatus === 'inactive'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {formData.employeeStatus === 'active' ? 'Đang làm việc' : 
                         formData.employeeStatus === 'inactive' ? 'Tạm nghỉ' : 'Đã nghỉ việc'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {formData.details && (
                  <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
                    <label className="text-sm font-medium text-gray-500">Chi tiết</label>
                    <p className="text-gray-900 mt-1">{formData.details}</p>
                  </div>
                )}
                
                {formData.avatarUrl && (
                  <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
                    <label className="text-sm font-medium text-gray-500">Avatar</label>
                    <div className="mt-2">
                      <img 
                        src={formData.avatarUrl} 
                        alt="Avatar" 
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 shadow-md"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* User Assignments */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                <h3 className="text-xl font-semibold text-purple-800 mb-4 flex items-center">
                  <span className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mr-3 text-lg">
                    💼
                  </span>
                  Phân công công việc
                </h3>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <UserAssignments userId={viewingUser._id} viewMode={true} />
                </div>
              </div>

              {/* User Profile */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-4 flex items-center">
                  <span className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 text-lg">
                    📋
                  </span>
                  Hồ sơ cá nhân
                </h3>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <UserProfileManagement userId={viewingUser._id} viewMode={true} />
                </div>
              </div>

              {/* User Documents */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-lg border border-orange-200">
                <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center">
                  <span className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mr-3 text-lg">
                    📁
                  </span>
                  Quản lý tài liệu
                </h3>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <UserDocumentManagement userId={viewingUser._id} viewMode={true} />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  closeDetailView();
                  handleEdit(viewingUser);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Chỉnh sửa
              </button>
              <button
                onClick={closeDetailView}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 




































