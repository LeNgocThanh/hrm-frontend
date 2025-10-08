// LoginPage.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated, loadingAuth } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !loadingAuth) {
      window.location.replace("/") // hoặc trang chính của bạn
    }
  }, [isAuthenticated, loadingAuth, router]);

  const handleLogin = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (!username || !password) {
      setStatusMessage('Vui lòng nhập tên đăng nhập và mật khẩu.');
      setIsSuccess(false);
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Đang đăng nhập...');
    setIsSuccess(null);

    try {
      await login(username, password);
      setStatusMessage('Đăng nhập thành công!');
      setIsSuccess(true);
      // AuthContext sẽ tự động redirect thông qua useEffect ở trên
    } catch (error: any) {
      console.error('Lỗi đăng nhập:', error);
      setStatusMessage(`Lỗi: ${error.message}`);
      setIsSuccess(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang kiểm tra trạng thái đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-inter">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Đăng nhập</h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-gray-700 text-sm font-semibold mb-2">
              Tên đăng nhập:
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập tên đăng nhập"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">
              Mật khẩu:
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nhập mật khẩu"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition duration-300 ease-in-out ${isProcessing
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50'
              }`}
          >
            {isProcessing ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Status Message */}
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

        {/* Optional: Link to registration or forgot password */}
        {/* <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">
            Chưa có tài khoản?{' '}
            <a href="/register" className="text-indigo-600 hover:underline">
              Đăng ký ngay
            </a>
          </p>
          <p className="text-gray-600 mt-2">
            <a href="/forgot-password" className="text-indigo-600 hover:underline">
              Quên mật khẩu?
            </a>
          </p>
        </div> */}
      </div>
    </div>
  );
}
