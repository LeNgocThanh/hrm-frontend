'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { userAccountApi } from '@/lib/api/userAccount';
import { UserAccount, CreateUserAccountDto, UpdateUserAccountDto, UserAccountResponse, User } from '@/types/userAccount';

export default function UserAccountForm() {
  const NESTJS_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'; // Đảm bảo URL này chính xác

  // State để lấy và chọn dữ liệu người dùng
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // State cho form tài khoản người dùng
  const [accountForm, setAccountForm] = useState<Partial<CreateUserAccountDto & UpdateUserAccountDto>>({
    username: '',
    password: '',
    status: 'active', // Mặc định là 'active'
  });

  // State cho tài khoản hiện có
  const [existingAccount, setExistingAccount] = useState<UserAccountResponse | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // State cho trạng thái xử lý
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  // Lấy danh sách người dùng khi component được mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await fetch(`${NESTJS_API_BASE_URL}/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
            'Content-Type': 'application/json',
          }
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        const data: User[] = await response.json();
        setUsers(data);
        if (data.length > 0) {
          setSelectedUserId(data[0]._id); // Chọn người dùng đầu tiên theo mặc định
        }
        setUsersError(null);
      } catch (err: any) {
        setUsersError(`Failed to fetch users: ${err.message}`);
        console.error('Lỗi khi lấy người dùng:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Lấy tài khoản người dùng khi selectedUserId thay đổi
  useEffect(() => {
    const fetchUserAccount = async (userId: string) => {
      setStatusMessage('Đang tải thông tin tài khoản...');
      setIsSuccess(null);
      try {
        const account = await userAccountApi.getUserAccountByUserId(userId);
        if (account) {
          setExistingAccount(account);
          setAccountForm({
            username: account.username,
            status: account.status,
            // Không điền mật khẩu vào form khi chỉnh sửa vì lý do bảo mật
          });
          setIsEditing(true);
          setStatusMessage('Đã tải thông tin tài khoản hiện có.');
          setIsSuccess(true);
        } else {
          // Không có tài khoản tồn tại, chuẩn bị tạo mới
          setExistingAccount(null);
          setAccountForm({
            username: '',
            password: '',
            status: 'active',
          });
          setIsEditing(false);
          setStatusMessage('Không tìm thấy tài khoản hiện có. Bạn có thể tạo tài khoản mới.');
          setIsSuccess(null);
        }
      } catch (error: any) {
        console.error('Lỗi khi lấy tài khoản người dùng:', error);
        setExistingAccount(null);
        setAccountForm({
          username: '',
          password: '',
          status: 'active',
        });
        setIsEditing(false);
        setStatusMessage(`Lỗi khi tải tài khoản: ${error.message}`);
        setIsSuccess(false);
      }
    };

    if (selectedUserId) {
      fetchUserAccount(selectedUserId);
    } else {
      // Reset form if no user is selected
      setExistingAccount(null);
      setAccountForm({
        username: '',
        password: '',
        status: 'active',
      });
      setIsEditing(false);
      setStatusMessage('');
      setIsSuccess(null);
    }
  }, [selectedUserId]);

  const handleInputChange = (field: keyof (CreateUserAccountDto & UpdateUserAccountDto), value: string) => {
    setAccountForm(prev => ({ ...prev, [field]: value }));
    setStatusMessage('');
    setIsSuccess(null);
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (!selectedUserId) {
      setStatusMessage('Vui lòng chọn một người dùng.');
      setIsSuccess(false);
      return;
    }

    setIsProcessing(true);
    setStatusMessage(isEditing ? 'Đang cập nhật tài khoản...' : 'Đang tạo tài khoản...');
    setIsSuccess(null);

    try {
      if (isEditing) {
        // Cập nhật tài khoản hiện có
        if (!existingAccount?._id) {
          throw new Error('Không tìm thấy ID tài khoản để cập nhật.');
        }
        const updatePayload: UpdateUserAccountDto = {
          username: accountForm.username,
          status: accountForm.status,
          // Chỉ gửi mật khẩu nếu người dùng nhập vào để thay đổi
          ...(accountForm.password && { password: accountForm.password }),
        };
        await userAccountApi.updateUserAccount(existingAccount._id, updatePayload);
      } else {
        // Tạo tài khoản mới
        if (!accountForm.username || !accountForm.password) {
          setStatusMessage('Tên người dùng và mật khẩu là bắt buộc khi tạo tài khoản mới.');
          setIsSuccess(false);
          setIsProcessing(false);
          return;
        }
        const createPayload: CreateUserAccountDto = {
          userId: selectedUserId,
          username: accountForm.username,
          password: accountForm.password,
        };
        await userAccountApi.createUserAccount(createPayload);
      }

      setStatusMessage(`${isEditing ? 'Cập nhật' : 'Tạo'} tài khoản thành công!`);
      setIsSuccess(true);
      // Sau khi tạo/cập nhật thành công, tải lại thông tin tài khoản
      // để đảm bảo form hiển thị trạng thái mới nhất và chuyển sang chế độ chỉnh sửa
      await userAccountApi.getUserAccountByUserId(selectedUserId);

    } catch (error: any) {
      console.error('Lỗi khi gửi tài khoản:', error);
      setStatusMessage(`Lỗi: ${error.message}`);
      setIsSuccess(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setStatusMessage('');
    setIsSuccess(null);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl mx-auto my-8 font-inter">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
        {isEditing ? 'Cập nhật' : 'Tạo'} Tài khoản Người dùng
      </h1>

      {/* Chọn Người dùng */}
      <div className="mb-6">
        <label htmlFor="user-select" className="block text-gray-700 text-sm font-semibold mb-2">
          Chọn Người dùng:
        </label>
        {loadingUsers ? (
          <p className="text-gray-600">Đang tải danh sách người dùng...</p>
        ) : usersError ? (
          <p className="text-red-500">{usersError}</p>
        ) : (
          <select
            id="user-select"
            value={selectedUserId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleUserChange(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing || users.length === 0}
          >
            {users.length === 0 ? (
              <option value="">Không có người dùng nào</option>
            ) : (
              users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.fullName} ({user.email})
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {/* Form Tài khoản */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Thông tin Tài khoản</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Tên đăng nhập:
              </label>
              <input
                type="text"
                value={accountForm.username || ''}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập tên đăng nhập"
                required               
              />
              {isEditing && (
                <p className="text-sm text-gray-500 mt-1">Tên đăng nhập không nên thay đổi sau khi tạo.</p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Mật khẩu:
              </label>
              <input
                type="password"
                value={accountForm.password || ''}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={isEditing ? 'Để trống nếu không thay đổi' : 'Nhập mật khẩu'}
                required={!isEditing} // Bắt buộc khi tạo, tùy chọn khi chỉnh sửa
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Trạng thái:
              </label>
              <select
                value={accountForm.status || 'active'}
                onChange={(e) => handleInputChange('status', e.target.value as 'active' | 'inactive' | 'locked' | 'suspended')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Không hoạt động</option>
                <option value="locked">Bị khóa</option>
                <option value="suspended">Bị đình chỉ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Nút gửi */}
        <button
          type="submit"
          disabled={isProcessing || !selectedUserId || (isEditing && !existingAccount) || (!isEditing && (!accountForm.username || !accountForm.password))}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ease-in-out ${isProcessing || !selectedUserId || (isEditing && !existingAccount) || (!isEditing && (!accountForm.username || !accountForm.password))
            ? 'bg-indigo-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50'
            }`}
        >
          {isProcessing ? 'Đang xử lý...' : (isEditing ? 'Cập nhật Tài khoản' : 'Tạo Tài khoản')}
        </button>
      </form>

      {/* Thông báo trạng thái */}
      {statusMessage && (
        <div
          className={`mt-6 p-4 rounded-lg text-center ${isSuccess === true ? 'bg-green-100 text-green-800' :
            isSuccess === false ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}
        >
          <p className="font-medium">{statusMessage}</p>
        </div>
      )}

      {/* Thông tin tài khoản hiện có */}
      {existingAccount && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tài khoản hiện tại:</strong> Tên đăng nhập: {existingAccount.username}, Trạng thái: {existingAccount.status}
            <br />
            Được tạo {new Date(existingAccount.createdAt).toLocaleDateString('vi-VN')}
            {existingAccount.updatedAt !== existingAccount.createdAt &&
              `, cập nhật lần cuối ${new Date(existingAccount.updatedAt).toLocaleDateString('vi-VN')}`
            }
          </p>
        </div>
      )}
    </div>
  );
}