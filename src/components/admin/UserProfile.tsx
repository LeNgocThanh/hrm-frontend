'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { userProfileApi } from '@/lib/api/userProfile';
import { UserProfile, CreateUserProfileDto, UpdateUserProfileDto } from '@/types/userProfile';

interface UserProfileResponse extends UserProfile {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

// Interface for User
export interface User {
  _id: string;
  fullName: string;
  birthDay: string;
  gender: string;
  details: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  employeeStatus: 'active' | 'inactive' | 'terminated';
  createdAt: string;
  updatedAt: string;
}

export default function UserProfileForm() {
  const NESTJS_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // State for user data fetching and selection
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // State for user profile form
  const [profileForm, setProfileForm] = useState<UserProfile>({
    userId: '',
    placeOfBirth: '',
    permanentAddress: '',
    temporaryAddress: '',
    nationalId: '',
    nationalIdIssuedDate: '',
    nationalIdIssuedPlace: '',
    maritalStatus: '',
    bankAccount: '',
    bankName: '',
    bankBranch: '',
  });

  // State for existing profile
  const [existingProfile, setExistingProfile] = useState<UserProfileResponse | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // State for process status
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await fetch(`${NESTJS_API_BASE_URL}/users`);
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        const data: User[] = await response.json();
        setUsers(data);
        if (data.length > 0) {
          setSelectedUserId(data[0]._id);
        }
        setUsersError(null);
      } catch (err: any) {
        setUsersError(`Failed to fetch users: ${err.message}`);
        console.error('Error fetching users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Fetch user profile when selectedUserId changes
  useEffect(() => {
    if (selectedUserId) {
      fetchUserProfile(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const profile = await userProfileApi.getUserProfile(userId);
      setExistingProfile(profile as UserProfileResponse);
      setProfileForm({
        userId: profile.userId,
        placeOfBirth: profile.placeOfBirth || '',
        permanentAddress: profile.permanentAddress || '',
        temporaryAddress: profile.temporaryAddress || '',
        nationalId: profile.nationalId || '',
        nationalIdIssuedDate: profile.nationalIdIssuedDate ? profile.nationalIdIssuedDate.split('T')[0] : '',
        nationalIdIssuedPlace: profile.nationalIdIssuedPlace || '',
        maritalStatus: profile.maritalStatus || '',
        bankAccount: profile.bankAccount || '',
        bankName: profile.bankName || '',
        bankBranch: profile.bankBranch || '',
      });
      setIsEditing(true);
    } catch (error: any) {
      if (error.status === 404) {
        // No profile exists, create new
        setExistingProfile(null);
        setProfileForm({
          userId: userId,
          placeOfBirth: '',
          permanentAddress: '',
          temporaryAddress: '',
          nationalId: '',
          nationalIdIssuedDate: '',
          nationalIdIssuedPlace: '',
          maritalStatus: '',
          bankAccount: '',
          bankName: '',
          bankBranch: '',
        });
        setIsEditing(false);
      } else {
        console.error('Error fetching user profile:', error);
        setExistingProfile(null);
        setIsEditing(false);
      }
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
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
    setStatusMessage(isEditing ? 'Đang cập nhật hồ sơ...' : 'Đang tạo hồ sơ...');
    setIsSuccess(null);

    try {
      const payload: CreateUserProfileDto | UpdateUserProfileDto = { ...profileForm };
      
      if (isEditing) {
        await userProfileApi.updateUserProfile(selectedUserId, payload);
      } else {
        await userProfileApi.createUserProfile(payload as CreateUserProfileDto);
      }
      
      setStatusMessage(`${isEditing ? 'Cập nhật' : 'Tạo'} hồ sơ thành công!`);
      setIsSuccess(true);
    } catch (error: any) {
      console.error('Error submitting profile:', error);
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
    <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl mx-auto my-8">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
        {isEditing ? 'Cập nhật' : 'Tạo'} Hồ sơ Người dùng
      </h1>

      {/* User Selection */}
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

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Thông tin cá nhân</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Nơi sinh:
              </label>
              <input
                type="text"
                value={profileForm.placeOfBirth}
                onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập nơi sinh"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Tình trạng hôn nhân:
              </label>
              <select
                value={profileForm.maritalStatus}
                onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Chọn tình trạng</option>
                <option value="single">Độc thân</option>
                <option value="married">Đã kết hôn</option>
                <option value="divorced">Đã ly hôn</option>
                <option value="widowed">Góa</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Địa chỉ thường trú:
              </label>
              <textarea
                value={profileForm.permanentAddress}
                onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập địa chỉ thường trú"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Địa chỉ tạm trú:
              </label>
              <textarea
                value={profileForm.temporaryAddress}
                onChange={(e) => handleInputChange('temporaryAddress', e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập địa chỉ tạm trú"
              />
            </div>
          </div>
        </div>

        {/* Identity Information */}
        <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Thông tin giấy tờ</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Số CMND/CCCD:
              </label>
              <input
                type="text"
                value={profileForm.nationalId}
                onChange={(e) => handleInputChange('nationalId', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập số CMND/CCCD"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Ngày cấp:
              </label>
              <input
                type="date"
                value={profileForm.nationalIdIssuedDate}
                onChange={(e) => handleInputChange('nationalIdIssuedDate', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Nơi cấp:
              </label>
              <input
                type="text"
                value={profileForm.nationalIdIssuedPlace}
                onChange={(e) => handleInputChange('nationalIdIssuedPlace', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập nơi cấp CMND/CCCD"
              />
            </div>
          </div>
        </div>

        {/* Bank Information */}
        <div className="p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Thông tin ngân hàng</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Số tài khoản:
              </label>
              <input
                type="text"
                value={profileForm.bankAccount}
                onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập số tài khoản"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Tên ngân hàng:
              </label>
              <input
                type="text"
                value={profileForm.bankName}
                onChange={(e) => handleInputChange('bankName', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập tên ngân hàng"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-700 text-sm font-semibold mb-2">
                Chi nhánh:
              </label>
              <input
                type="text"
                value={profileForm.bankBranch}
                onChange={(e) => handleInputChange('bankBranch', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nhập chi nhánh ngân hàng"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing || !selectedUserId}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ease-in-out ${
            isProcessing || !selectedUserId
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50'
          }`}
        >
          {isProcessing ? 'Đang xử lý...' : (isEditing ? 'Cập nhật Hồ sơ' : 'Tạo Hồ sơ')}
        </button>
      </form>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`mt-6 p-4 rounded-lg text-center ${
            isSuccess === true ? 'bg-green-100 text-green-800' :
            isSuccess === false ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}
        >
          <p className="font-medium">{statusMessage}</p>
        </div>
      )}

      {/* Existing Profile Info */}
      {existingProfile && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Hồ sơ hiện tại:</strong> Được tạo {new Date(existingProfile.createdAt).toLocaleDateString('vi-VN')}
            {existingProfile.updatedAt !== existingProfile.createdAt && 
              `, cập nhật lần cuối ${new Date(existingProfile.updatedAt).toLocaleDateString('vi-VN')}`
            }
          </p>
        </div>
      )}
    </div>
  );
}



