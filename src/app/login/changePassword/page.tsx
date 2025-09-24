'use client';

import React, { useState, FormEvent, useEffect } from 'react';
// Do not import useRouter from 'next/navigation' as it causes an error in the current environment.
// We will simulate the behavior of useRouter.
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Lấy accountId từ localStorage khi trang được tải
  useEffect(() => {
    const userInfoString = localStorage.getItem('userInfo');
    if (userInfoString) {
      try {
        const userInfo = JSON.parse(userInfoString);
        if (userInfo.accountId) {
          setAccountId(userInfo.accountId);
        } else {
          setStatusMessage('Không tìm thấy accountId trong localStorage.');
          setIsSuccess(false);
        }
      } catch (e) {
        setStatusMessage('Lỗi khi phân tích dữ liệu người dùng.');
        setIsSuccess(false);
      }
    } else {
      setStatusMessage('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      setIsSuccess(false);
    }
  }, []);

  const handleChangePassword = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setStatusMessage('Vui lòng điền đầy đủ các trường.');
      setIsSuccess(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatusMessage('Mật khẩu mới và mật khẩu xác nhận không khớp.');
      setIsSuccess(false);
      return;
    }

    if (!accountId) {
        setStatusMessage('Không thể đổi mật khẩu, không tìm thấy ID tài khoản.');
        setIsSuccess(false);
        return;
    }

    setIsProcessing(true);
    setStatusMessage('Đang xử lý...');
    setIsSuccess(null);

    try {
      // Giả sử bạn có một token truy cập đã lưu trong localStorage hoặc context
    //  const accessToken = 'YOUR_ACCESS_TOKEN'; // Thay thế bằng cách lấy token thực tế

      const response = await fetch(`${baseUrl}/user-accounts/${accountId}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
         // 'Authorization': `Bearer ${accessToken}`, // Thêm token vào header
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        setStatusMessage('Đổi mật khẩu thành công!');
        setIsSuccess(true);
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        const errorData = await response.json();
        setStatusMessage(`Lỗi: ${errorData.message || 'Không thể đổi mật khẩu.'}`);
        setIsSuccess(false);
      }
    } catch (error: any) {
      console.error('Lỗi API:', error);
      setStatusMessage(`Lỗi kết nối: ${error.message}`);
      setIsSuccess(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-inter">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Đổi Mật Khẩu</h1>

        <form onSubmit={handleChangePassword} className="space-y-6">
          <div>
            <label htmlFor="oldPassword" className="block text-gray-700 text-sm font-semibold mb-2">
              Mật khẩu cũ:
            </label>
            <input
              type="password"
              id="oldPassword"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập mật khẩu cũ"
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-gray-700 text-sm font-semibold mb-2">
              Mật khẩu mới:
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập mật khẩu mới"
              required
            />
          </div>
          
          <div>
            <label htmlFor="confirmNewPassword" className="block text-gray-700 text-sm font-semibold mb-2">
              Xác nhận mật khẩu mới:
            </label>
            <input
              type="password"
              id="confirmNewPassword"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập lại mật khẩu mới"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing || !accountId}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ease-in-out ${
              (isProcessing || !accountId)
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50'
            }`}
          >
            {isProcessing ? 'Đang đổi...' : 'Đổi mật khẩu'}
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
      </div>
    </div>
  );
}