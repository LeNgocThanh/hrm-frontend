'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Import useAuth hook

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[]; // Các vai trò cần thiết để truy cập trang này
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { isAuthenticated, userInfo, loadingAuth, logout, refreshAccessToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (loadingAuth) {
        // Vẫn đang tải trạng thái xác thực ban đầu, chờ đợi
        return;
      }

      if (!isAuthenticated) {
        // Nếu chưa xác thực, chuyển hướng đến trang đăng nhập
        router.replace('/login');
        return;
      }

      // Nếu đã xác thực, kiểm tra quyền (nếu có yêu cầu vai trò)
      if (requiredRoles && requiredRoles.length > 0) {

        const userPermissions: string[] = userInfo?.scopedPermissions
          ? userInfo.scopedPermissions.flatMap((s: any) => s.permissions)
          : [];
        const hasRequiredPermission = requiredRoles.some(role => userPermissions.includes(role));

        if (!hasRequiredPermission) {
          // Nếu không có quyền, chuyển hướng đến trang không có quyền truy cập
          router.replace('/unauthorized'); // Tạo trang này nếu chưa có
          return;
        }
      }

      // Logic kiểm tra access token hết hạn và làm mới
      // Bạn có thể thêm logic kiểm tra thời gian sống của access token ở đây
      // Hoặc dựa vào phản hồi 401 từ API khi token hết hạn
      // Ví dụ:
      // const tokenExpiration = // Lấy thời gian hết hạn từ access token (cần giải mã token)
      // if (tokenExpiration && Date.now() > tokenExpiration - 60 * 1000) { // Hết hạn trong 1 phút tới
      //   try {
      //     await refreshAccessToken();
      //   } catch (error) {
      //     console.error("Lỗi làm mới token trong ProtectedRoute:", error);
      //     logout(); // Đăng xuất nếu không thể làm mới
      //   }
      // }
    };

    checkAuth();
  }, [isAuthenticated, userInfo, loadingAuth, requiredRoles, router, logout, refreshAccessToken]);

  // Hiển thị loading hoặc null trong khi đang kiểm tra xác thực
  if (loadingAuth || !isAuthenticated && !requiredRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700 text-lg">Đang tải...</p>
      </div>
    );
  }

  // Nếu đã xác thực và có quyền, hiển thị nội dung trang
  return <>{children}</>;
};

export default ProtectedRoute;
