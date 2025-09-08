'use client';
import React, { useEffect, useState, forwardRef } from 'react';
import { User } from '@/types/index';
import { UserAssignment } from '@/types/user-assignment';
import { Position } from '@/types/position';
import { Organization } from '@/types/organization';
import { getUsers } from '@/lib/api/users';
import { getUserAssignmentsByUser } from '@/lib/api/user-assignments';
import { getPositions } from '@/lib/api/positions';
import { getOrganizations } from '@/lib/api/organizations';
import UserAssignments from '@/components/admin/UserAssignments';
import UserProfileManagement from '@/components/admin/UserProfileManagement';
import UserDocumentManagement from '@/components/admin/UserDocumentManagement';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface UserReportRow {
  user: User;
  assignment: UserAssignment | null;
  positionName: string;
  organizationName: string;
  organizationLevel: number;
  positionLevel: number;
}

interface HasId {
  _id: string;
}

const CustomInput = forwardRef<HTMLInputElement, any>((props, ref) => (
  <input 
    {...props} 
    ref={ref} 
    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
  />
));

const UsersReport: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [rows, setRows] = useState<UserReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    positionId: '',
    organizationId: '',
    isPrimary: '',
    isActive: '',
    gender: '',
    search: '',
    birthDayFrom: '',
    birthDayTo: '',
    timeInFrom: '',
    timeInTo: '',
    timeOutFrom: '',
    timeOutTo: '',
  });
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);

  const handleViewDetail = (user: User) => {
    setViewingUser(user);
    setShowDetailView(true);
  };

  const closeDetailView = () => {
    setViewingUser(null);
    setShowDetailView(false);
  };

  const parseDate = (str: string) => {
    if (!str) return null;
    const [day, month, year] = str.split('/');
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  function isObjectWithId(obj: any): obj is HasId {
  return typeof obj === 'object' && obj !== null && '_id' in obj;
}

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, positionsData, organizationsData] = await Promise.all([
        getUsers(),
        getPositions(),
        getOrganizations()
      ]);

      let allAssignments: UserAssignment[] = [];
      for (const user of usersData) {
        const userAssignments = await getUserAssignmentsByUser(user._id);
        allAssignments.push(...userAssignments);
      }

      setUsers(usersData);
      setPositions(positionsData);
      setOrganizations(organizationsData);
      setAssignments(allAssignments);

      // Build rows with organization and position levels
      const rows: UserReportRow[] = allAssignments.map(assignment => {
        const userId = isObjectWithId(assignment.userId) ? assignment.userId._id : assignment.userId;
        const user = usersData.find(u => u._id === userId);
        if (!user) return null;

        const posId = isObjectWithId(assignment.positionId) ? assignment.positionId._id : assignment.positionId;
        const orgId = isObjectWithId(assignment.organizationId) ? assignment.organizationId._id : assignment.organizationId;
        
        const pos = positionsData.find(p => p._id === posId);
        const org = organizationsData.find(o => o._id === orgId || o.id === orgId);

        return {
          user,
          assignment,
          positionName: pos ? pos.name : '',
          organizationName: org ? org.name : '',
          organizationLevel: org ? org.level : 999,
          positionLevel: pos ? pos.level : 999,
        };
      }).filter(Boolean) as UserReportRow[];

      // Sort by organization level, position level, then fullName
      rows.sort((a, b) => {
        if (a.organizationLevel !== b.organizationLevel) {
          return a.organizationLevel - b.organizationLevel;
        }
        if (a.positionLevel !== b.positionLevel) {
          return a.positionLevel - b.positionLevel;
        }
        return a.user.fullName.localeCompare(b.user.fullName);
      });

      setRows(rows);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = rows.filter(row => {
    const { user, assignment } = row;
    
    if (filters.positionId && (!assignment || (isObjectWithId(assignment.positionId) ? assignment.positionId._id : assignment.positionId) !== filters.positionId)) return false;
    if (filters.organizationId && (!assignment || (isObjectWithId(assignment.organizationId) ? assignment.organizationId._id : assignment.organizationId) !== filters.organizationId)) return false;
    if (filters.isPrimary && (!assignment || String(assignment.isPrimary) !== filters.isPrimary)) return false;
    if (filters.isActive && (!assignment || String(assignment.isActive) !== filters.isActive)) return false;
    if (filters.gender && user.gender !== filters.gender) return false;
    
    if (filters.birthDayFrom && new Date(user.birthDay) < parseDate(filters.birthDayFrom)!) return false;
    if (filters.birthDayTo && new Date(user.birthDay) > parseDate(filters.birthDayTo)!) return false;
    if (filters.timeInFrom && (!assignment || !assignment.timeIn || new Date(assignment.timeIn) < parseDate(filters.timeInFrom)!)) return false;
    if (filters.timeInTo && (!assignment || !assignment.timeIn || new Date(assignment.timeIn) > parseDate(filters.timeInTo)!)) return false;
    if (filters.timeOutFrom && (!assignment || !assignment.timeOut || new Date(assignment.timeOut) < parseDate(filters.timeOutFrom)!)) return false;
    if (filters.timeOutTo && (!assignment || !assignment.timeOut || new Date(assignment.timeOut) > parseDate(filters.timeOutTo)!)) return false;
    
    const search = filters.search.toLowerCase();
    if (search) {
      const match =
        (user.fullName || '').toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search) ||
        (user.phone || '').toLowerCase().includes(search) ||
        (user.birthDay || '').toLowerCase().includes(search) ||
        (assignment && assignment.timeIn && String(assignment.timeIn).toLowerCase().includes(search)) ||
        (assignment && assignment.timeOut && String(assignment.timeOut).toLowerCase().includes(search));
      if (!match) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setFilters({
      positionId: '',
      organizationId: '',
      isPrimary: '',
      isActive: '',
      gender: '',
      search: '',
      birthDayFrom: '',
      birthDayTo: '',
      timeInFrom: '',
      timeInTo: '',
      timeOutFrom: '',
      timeOutTo: '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Báo cáo nhân viên</h1>
          <p className="mt-2 text-gray-600">
            Xem và lọc thông tin nhân viên theo tổ chức và chức vụ
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Bộ lọc</h2>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chức vụ</label>
              <select
                value={filters.positionId}
                onChange={e => setFilters(f => ({ ...f, positionId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value=''>Tất cả chức vụ</option>
                {positions.map((p: Position) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tổ chức</label>
              <select
                value={filters.organizationId}
                onChange={e => setFilters(f => ({ ...f, organizationId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value=''>Tất cả tổ chức</option>
                {organizations.map((o: Organization) => (
                  <option key={o._id || o.id} value={o._id || o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vai trò</label>
              <select
                value={filters.isPrimary}
                onChange={e => setFilters(f => ({ ...f, isPrimary: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value=''>Tất cả</option>
                <option value='true'>Chính</option>
                <option value='false'>Phụ</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
              <select
                value={filters.isActive}
                onChange={e => setFilters(f => ({ ...f, isActive: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value=''>Tất cả</option>
                <option value='true'>Đang hoạt động</option>
                <option value='false'>Ngừng hoạt động</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Giới tính</label>
              <select
                value={filters.gender}
                onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value=''>Tất cả</option>
                <option value='Nam'>Nam</option>
                <option value='Nữ'>Nữ</option>             
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tìm kiếm</label>
              <input
                type='text'
                placeholder='Tìm theo tên, email, số điện thoại...'
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Date filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sinh từ ngày</label>
              <DatePicker
                selected={parseDate(filters.birthDayFrom)}
                onChange={date => setFilters(f => ({ ...f, birthDayFrom: formatDate(date) }))}
                dateFormat="dd/MM/yyyy"
                placeholderText="Chọn ngày"
                isClearable
                customInput={<CustomInput />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sinh đến ngày</label>
              <DatePicker
                selected={parseDate(filters.birthDayTo)}
                onChange={date => setFilters(f => ({ ...f, birthDayTo: formatDate(date) }))}
                dateFormat="dd/MM/yyyy"
                placeholderText="Chọn ngày"
                isClearable
                customInput={<CustomInput />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vào làm từ</label>
              <DatePicker
                selected={parseDate(filters.timeInFrom)}
                onChange={date => setFilters(f => ({ ...f, timeInFrom: formatDate(date) }))}
                dateFormat="dd/MM/yyyy"
                placeholderText="Chọn ngày"
                isClearable
                customInput={<CustomInput />}
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Kết quả ({filteredRows.length} nhân viên)
              </h3>
              <div className="text-sm text-gray-500">
                Sắp xếp theo: Cấp tổ chức → Cấp chức vụ → Tên
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nhân viên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Liên hệ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thông tin cá nhân
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tổ chức & Chức vụ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thời gian
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
                {filteredRows.map(({ user, assignment, positionName, organizationName, organizationLevel, positionLevel }, idx) => (
                  <tr key={user._id + idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {user.fullName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{user.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{user.gender || '-'}</div>
                      <div className="text-xs text-gray-500">
                        {user.birthDay ? new Date(user.birthDay).toLocaleDateString('vi-VN') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{organizationName}</div>
                      <div className="text-sm text-gray-500">{positionName}</div>
                      <div className="text-xs text-gray-400">
                        Cấp tổ chức: {organizationLevel} • Cấp chức vụ: {positionLevel}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        Vào: {assignment && assignment.timeIn ? new Date(assignment.timeIn).toLocaleDateString('vi-VN') : '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Ra: {assignment && assignment.timeOut ? new Date(assignment.timeOut).toLocaleDateString('vi-VN') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          assignment && assignment.isPrimary 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment && assignment.isPrimary ? 'Chính' : 'Phụ'}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          assignment && assignment.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {assignment && assignment.isActive ? 'Hoạt động' : 'Ngừng'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewDetail(user)}
                        className="text-blue-600 hover:text-blue-900 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg"
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-2">📊</div>
              <p className="text-gray-500 text-lg">Không tìm thấy dữ liệu phù hợp</p>
              <p className="text-gray-400 text-sm mt-1">Thử điều chỉnh bộ lọc để xem kết quả khác</p>
            </div>
          )}
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
                        <p className="text-lg font-semibold text-gray-900 mt-1">{viewingUser.fullName}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900 mt-1">{viewingUser.email}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="text-sm font-medium text-gray-500">Số điện thoại</label>
                        <p className="text-gray-900 mt-1">{viewingUser.phone || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="text-sm font-medium text-gray-500">Ngày sinh</label>
                        <p className="text-gray-900 mt-1">
                          {viewingUser.birthDay ? new Date(viewingUser.birthDay).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="text-sm font-medium text-gray-500">Giới tính</label>
                        <p className="text-gray-900 mt-1">{viewingUser.gender || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="text-sm font-medium text-gray-500">Trạng thái</label>
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full mt-1 ${
                          viewingUser.employeeStatus === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : viewingUser.employeeStatus === 'inactive'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {viewingUser.employeeStatus === 'active' ? 'Đang làm việc' : 
                           viewingUser.employeeStatus === 'inactive' ? 'Tạm nghỉ' : 'Đã nghỉ việc'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {viewingUser.details && (
                    <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Chi tiết</label>
                      <p className="text-gray-900 mt-1">{viewingUser.details}</p>
                    </div>
                  )}
                  
                  {viewingUser.avatarUrl && (
                    <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
                      <label className="text-sm font-medium text-gray-500">Avatar</label>
                      <div className="mt-2">
                        <img 
                          src={viewingUser.avatarUrl} 
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
              <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end">
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
    </div>
  );
};

export default UsersReport; 
