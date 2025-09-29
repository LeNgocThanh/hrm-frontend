'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { userProfileApi } from '@/lib/api/userProfile';
import { UserProfile, CreateUserProfileDto, UpdateUserProfileDto, EDUCATION_LEVELS } from '@/types/userProfile';
//import { useAuth } from '@/context/AuthContext';

interface UserProfileResponse extends UserProfile {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  userId: string;
  viewMode?: boolean;
}

const UserProfileManagement: React.FC<Props> = ({ userId, viewMode = false }) => {
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
    educationLevel: EDUCATION_LEVELS.BACHELOR_DEGREE,
    certificate: '',
  });

  const [existingProfile, setExistingProfile] = useState<UserProfileResponse | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  //const {apiCall} = useAuth();
  useEffect(() => {
    if (userId) {
      fetchUserProfile(userId);
    }
  }, [userId]);

  const fetchUserProfile = async (userId: string) => {
    try {
      //const result = await apiCall('/user-profile/'+userId);
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
        educationLevel: profile.educationLevel || EDUCATION_LEVELS.BACHELOR_DEGREE,
        certificate: profile.certificate,
      });
      setIsEditing(true);
    } catch (error: any) {
      if (error.status === 404) {
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
          educationLevel: EDUCATION_LEVELS.BACHELOR_DEGREE,
          certificate: '',
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

    setIsProcessing(true);
    setStatusMessage(isEditing ? 'Đang cập nhật hồ sơ...' : 'Đang tạo hồ sơ...');
    setIsSuccess(null);

    try {
      const payload: CreateUserProfileDto | UpdateUserProfileDto = { ...profileForm };

      if (isEditing) {
        await userProfileApi.updateUserProfile(userId, payload);
      } else {
        await userProfileApi.createUserProfile(payload as CreateUserProfileDto);
      }

      setStatusMessage(`${isEditing ? 'Cập nhật' : 'Tạo'} hồ sơ thành công!`);
      setIsSuccess(true);

      // Refresh profile data
      await fetchUserProfile(userId);
    } catch (error: any) {
      console.error('Error submitting profile:', error);
      setStatusMessage(`Lỗi: ${error.message}`);
      setIsSuccess(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">Hồ sơ cá nhân</h3>

      {!viewMode && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">
            {isEditing ? 'Cập nhật' : 'Tạo'} Hồ sơ Người dùng
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Information */}
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-lg font-medium text-gray-700 mb-3">Thông tin cá nhân</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Nơi sinh:
                  </label>
                  <input
                    type="text"
                    value={profileForm.placeOfBirth}
                    onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập nơi sinh"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Tình trạng hôn nhân:
                  </label>
                  <select
                    value={profileForm.maritalStatus}
                    onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Chọn tình trạng --</option>
                    <option value="single">Độc thân</option>
                    <option value="married">Đã kết hôn</option>
                    <option value="divorced">Đã ly hôn</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Địa chỉ thường trú:
                  </label>
                  <textarea
                    value={profileForm.permanentAddress}
                    onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập địa chỉ thường trú"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Địa chỉ tạm trú:
                  </label>
                  <textarea
                    value={profileForm.temporaryAddress}
                    onChange={(e) => handleInputChange('temporaryAddress', e.target.value)}
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập địa chỉ tạm trú"
                  />
                </div>
              </div>
            </div>

            {/* Identity Information */}
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-lg font-medium text-gray-700 mb-3">Thông tin giấy tờ</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    CMND/CCCD:
                  </label>
                  <input
                    type="text"
                    value={profileForm.nationalId}
                    onChange={(e) => handleInputChange('nationalId', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập số CMND/CCCD"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Ngày cấp:
                  </label>
                  <input
                    type="date"
                    value={profileForm.nationalIdIssuedDate}
                    onChange={(e) => handleInputChange('nationalIdIssuedDate', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Nơi cấp:
                  </label>
                  <input
                    type="text"
                    value={profileForm.nationalIdIssuedPlace}
                    onChange={(e) => handleInputChange('nationalIdIssuedPlace', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập nơi cấp"
                  />
                </div>
              </div>
            </div>

            {/* Banking Information */}
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="text-lg font-medium text-gray-700 mb-3">Thông tin ngân hàng</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Số tài khoản:
                  </label>
                  <input
                    type="text"
                    value={profileForm.bankAccount}
                    onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập số tài khoản"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Tên ngân hàng:
                  </label>
                  <input
                    type="text"
                    value={profileForm.bankName}
                    onChange={(e) => handleInputChange('bankName', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập tên ngân hàng"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Chi nhánh:
                  </label>
                  <input
                    type="text"
                    value={profileForm.bankBranch}
                    onChange={(e) => handleInputChange('bankBranch', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập chi nhánh"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Trình độ học vấn:
                  </label>
                  <select
                    value={profileForm.educationLevel}
                    onChange={(e) => handleInputChange('educationLevel', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="highSchool">Cấp 3</option>
                    <option value="vocationalSchool">Trung cấp</option>
                    <option value="bachelorDegree">Đại học</option>
                    <option value="masterDegree">Thạc sỹ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Chứng chỉ:
                  </label>
                  <input
                    type="text"
                    value={profileForm.certificate}
                    onChange={(e) => handleInputChange('certificate', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập các loại chứng chỉ"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="submit"
                disabled={isProcessing}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${isProcessing
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {isProcessing
                  ? (isEditing ? 'Đang cập nhật...' : 'Đang tạo...')
                  : (isEditing ? 'Cập nhật hồ sơ' : 'Tạo hồ sơ')
                }
              </button>
            </div>
          </form>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`mt-4 p-4 rounded-lg text-center ${isSuccess === true ? 'bg-green-100 text-green-800' :
                isSuccess === false ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}
            >
              <p className="font-medium">{statusMessage}</p>
            </div>
          )}
        </div>
      )}

      {/* Profile Display - Hiển thị đầy đủ thông tin */}
      {existingProfile && (
        <div className="space-y-6">
          {/* Header thông tin */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-blue-800">Thông tin hồ sơ</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Được tạo: {new Date(existingProfile.createdAt).toLocaleDateString('vi-VN')}
                  {existingProfile.updatedAt !== existingProfile.createdAt &&
                    ` • Cập nhật: ${new Date(existingProfile.updatedAt).toLocaleDateString('vi-VN')}`
                  }
                </p>
              </div>
              <div className="text-blue-600">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Thông tin cá nhân */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h5 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-2 text-sm">
                👤
              </span>
              Thông tin cá nhân
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nơi sinh</label>
                  <p className="text-gray-900 mt-1">{existingProfile.placeOfBirth || 'Chưa cập nhật'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Tình trạng hôn nhân</label>
                  <p className="text-gray-900 mt-1">
                    {existingProfile.maritalStatus === 'single' ? 'Độc thân' :
                      existingProfile.maritalStatus === 'married' ? 'Đã kết hôn' :
                        existingProfile.maritalStatus === 'divorced' ? 'Đã ly hôn' :
                          existingProfile.maritalStatus || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Địa chỉ thường trú</label>
                  <p className="text-gray-900 mt-1">{existingProfile.permanentAddress || 'Chưa cập nhật'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Địa chỉ tạm trú</label>
                  <p className="text-gray-900 mt-1">{existingProfile.temporaryAddress || 'Chưa cập nhật'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Thông tin giấy tờ */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h5 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-2 text-sm">
                📄
              </span>
              Thông tin giấy tờ
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">CMND/CCCD</label>
                <p className="text-gray-900 mt-1 font-mono">{existingProfile.nationalId || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Ngày cấp</label>
                <p className="text-gray-900 mt-1">
                  {existingProfile.nationalIdIssuedDate
                    ? new Date(existingProfile.nationalIdIssuedDate).toLocaleDateString('vi-VN')
                    : 'Chưa cập nhật'
                  }
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Nơi cấp</label>
                <p className="text-gray-900 mt-1">{existingProfile.nationalIdIssuedPlace || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>

          {/* Thông tin ngân hàng */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h5 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mr-2 text-sm">
                🏦
              </span>
              Thông tin ngân hàng
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Số tài khoản</label>
                <p className="text-gray-900 mt-1 font-mono">{existingProfile.bankAccount || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Tên ngân hàng</label>
                <p className="text-gray-900 mt-1">{existingProfile.bankName || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Chi nhánh</label>
                <p className="text-gray-900 mt-1">{existingProfile.bankBranch || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h5 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
              <span className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mr-2 text-sm">
                🏦
              </span>
              Thông tin trình dộ học vấn
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Học vấn</label>
                <p className="text-gray-900 mt-1 font-mono">{existingProfile.educationLevel || 'Chưa cập nhật'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Các loại chứng chỉ</label>
                <p className="text-gray-900 mt-1">{existingProfile.certificate || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hiển thị khi chưa có hồ sơ */}
      {!existingProfile && !isProcessing && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8-1a1 1 0 100 2h2a1 1 0 100-2h-2z" clipRule="evenodd" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-600 mb-2">Chưa có hồ sơ cá nhân</h4>
          <p className="text-gray-500">
            {viewMode
              ? 'Người dùng này chưa có thông tin hồ sơ cá nhân.'
              : 'Hãy tạo hồ sơ cá nhân bằng cách điền form bên trên.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default UserProfileManagement;


