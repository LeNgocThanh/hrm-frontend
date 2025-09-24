'use client';

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

// Định nghĩa giao diện cho thông tin người dùng
export interface UserInfo {
  id: string;
  username: string;
  email: string;
  fullName: string;
  employeeStatus: 'active' | 'inactive' | 'terminated';
  roles: string[]; // Thêm trường roles ở đây
  scopedPermissions?: {
    organizationId: string;
    permissions: string[];
    groupedPermissions: Record<string, string[]>;
  }[];
}

// Định nghĩa giao diện cho AuthContext
interface AuthContextType {
  accessToken: string | null;
  userInfo: UserInfo | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  hasRole: (requiredRoles: string[]) => boolean;
  loadingAuth: boolean; // Trạng thái đang tải xác thực ban đầu
  apiCall: (endpoint: string, options?: RequestInit) => Promise<any>;
}

// Tạo AuthContext với giá trị mặc định
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// URL cơ sở của API NestJS của bạn
const NESTJS_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

// AuthProvider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true); // Trạng thái tải ban đầu

  // Hàm kiểm tra và khôi phục trạng thái từ sessionStorage khi tải lại trang
  useEffect(() => {
    if (typeof window !== 'undefined') {

      const storedAccessToken = localStorage.getItem('accessToken');
      const storedUserInfo = localStorage.getItem('userInfo');
      console.log('accessToken', storedAccessToken);

      const validateToken = async (token: string) => {
        try {
          const res = await fetch(`${NESTJS_API_BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
          });
          console.log('token', token);

          if (res.ok) {
            return true;
          }

          if (res.status === 401) {
            // Token hết hạn → thử refresh
            const refreshRes = await fetch(`${NESTJS_API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              credentials: 'include', // gửi cookie
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              localStorage.setItem('accessToken', data.access_token);
              console.log('accessToken', data.access_token);
              return true;
            } else {
              throw new Error('Refresh token failed');
            }
          }

          throw new Error('bạn không có quyền, mời liên hệ Admin');
        } catch (err) {
          console.warn('Xác thực thất bại:', err);
          return false;
        }
      };


      const initAuth = async () => {
        if (storedAccessToken && storedUserInfo) {
          try {
            const isValid = await validateToken(storedAccessToken);
            if (isValid) {
              setAccessToken(localStorage.getItem('accessToken')!); // có thể đã được refresh
              setUserInfo(JSON.parse(storedUserInfo));
            } else {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('userInfo');
              localStorage.setItem('logout', Date.now().toString());
              window.location.href = '/login';
            }
          } catch (e) {
            console.warn('Lỗi khi phân tích userInfo từ storage:', e);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userInfo');
          }
        }
        setLoadingAuth(false);
      };
      initAuth();
    }
  }, []);

  // Hàm đăng nhập
  const login = useCallback(async (username_param: string, password_param: string) => {
    setLoadingAuth(true); // Đặt trạng thái tải khi bắt đầu đăng nhập
    try {
      const response = await fetch(`${NESTJS_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username_param, password: password_param }),
        credentials: 'include',
      });

      // Luôn cố gắng parse JSON để lấy thông báo lỗi từ backend
      const data = await response.json();

      if (!response.ok) {
        // Đây là lỗi từ server (ví dụ: 401, 400, 409)
        // Log lỗi này dưới dạng warn hoặc info thay vì error, vì nó là lỗi nghiệp vụ
        console.warn('Lỗi đăng nhập từ API:', data.message || 'Đăng nhập thất bại.');
        throw new Error(data.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tên đăng nhập hoặc mật khẩu.');
      }

      // Đăng nhập thành công
      setAccessToken(data.access_token);


      // Xử lý scopedPermissions để parse organizationId
      const processedScopedPermissions = data.scopedPermissions?.map((perm: any) => {
        let organizationId = perm.organizationId;

        // Nếu organizationId là string chứa object, parse nó
        if (typeof organizationId === 'string' && organizationId.includes('ObjectId')) {
          // Extract ID từ string "{ _id: new ObjectId('6890249361bf1ceaba99e103'), name: 'phòng IT' }"
          const match = organizationId.match(/'([^']+)'/);
          organizationId = match ? match[1] : organizationId;
        }

        return {
          organizationId,
          permissions: perm.permissions,
          groupedPermissions: perm.groupedPermissions,
        };
      }) || [];

      const userWithPermissions = {
        ...data.user,
        scopedPermissions: processedScopedPermissions
      };

      setUserInfo(userWithPermissions);
      //sessionStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('accessToken', data.access_token);
      // sessionStorage.setItem('refreshToken', data.refresh_token);
      localStorage.setItem('userInfo', JSON.stringify(userWithPermissions));

    } catch (error: any) {
      // Đây là nơi xử lý các lỗi không mong muốn (ví dụ: lỗi mạng, lỗi JSON parsing)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Lỗi mạng hoặc server không phản hồi:', error); // Lỗi hệ thống
        throw new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
        console.error('Lỗi phân tích cú pháp JSON từ phản hồi API:', error); // Lỗi hệ thống
        throw new Error('Đã xảy ra lỗi không mong muốn khi xử lý dữ liệu từ máy chủ.');
      } else {
        // Các lỗi khác (bao gồm lỗi nghiệp vụ đã được ném từ khối try)
        // Nếu lỗi đã được log bằng console.warn ở trên, không cần log error nữa
        // Chỉ log error nếu đây là một lỗi thực sự không lường trước
        if (!error.message.includes('Đăng nhập thất bại') && !error.message.includes('Không thể làm mới token')) {
          console.error('Lỗi không xác định khi đăng nhập:', error); // Lỗi hệ thống
        }
        throw error; // Ném lỗi để component gọi có thể xử lý hiển thị
      }
    } finally {
      setLoadingAuth(false); // Kết thúc tải
    }
  }, []);

  // Hàm đăng xuất
  const logout = useCallback(async () => {
    try {
      // Gọi API logout ở backend để xóa HttpOnly refresh token cookie
      const response = await fetch(`${NESTJS_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Lỗi khi gọi API logout:', errorData.message || 'Đăng xuất thất bại ở backend.');
      }
    } catch (error) {
      console.error('Lỗi hệ thống khi gọi API logout:', error); // Lỗi hệ thống
    } finally {
      setAccessToken(null);
      setUserInfo(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userInfo');
      setLoadingAuth(false); // Kết thúc tải
    }
  }, []);

  // Hàm làm mới Access Token
  const refreshAccessToken = useCallback(async () => {
    setLoadingAuth(true); // Đặt trạng thái tải khi làm mới
    try {
      const response = await fetch(`${NESTJS_API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Luôn cố gắng parse JSON để lấy thông báo lỗi từ backend
      const data = await response.json();
      if (!response.ok) {
        // Đây là lỗi từ server (ví dụ: 401)
        console.warn('Lỗi làm mới token từ API:', data.message || 'Không thể làm mới token.');
        throw new Error(data.message || 'Không thể làm mới token. Vui lòng đăng nhập lại.');
      }

      setAccessToken(data.access_token);
      localStorage.setItem('accessToken', data.access_token);
      const processedScopedPermissions = data.scopedPermissions?.map((perm: any) => {
        let organizationId = perm.organizationId;

        // Nếu organizationId là string chứa object, parse nó
        if (typeof organizationId === 'string' && organizationId.includes('ObjectId')) {
          // Extract ID từ string "{ _id: new ObjectId('6890249361bf1ceaba99e103'), name: 'phòng IT' }"
          const match = organizationId.match(/'([^']+)'/);
          organizationId = match ? match[1] : organizationId;
        }

        return {
          organizationId,
          permissions: perm.permissions,
          groupedPermissions: perm.groupedPermissions,
        };
      }) || [];

      const userWithPermissions = {
        ...data.user,
        scopedPermissions: processedScopedPermissions
      };
      //refesh luôn quyền để cập nhật mới nhất  
      localStorage.setItem('userInfo', JSON.stringify(userWithPermissions));

      console.log('Access Token đã được làm mới:', data.access_token);
    } catch (error: any) {
      // Xử lý các lỗi không mong muốn (ví dụ: lỗi mạng, lỗi JSON parsing)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Lỗi mạng hoặc server không phản hồi khi làm mới token:', error); // Lỗi hệ thống
        throw new Error('Không thể kết nối đến máy chủ để làm mới token.');
      } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
        console.error('Lỗi phân tích cú pháp JSON khi làm mới token:', error); // Lỗi hệ thống
        throw new Error('Đã xảy ra lỗi không mong muốn khi xử lý dữ liệu làm mới token.');
      } else {
        // Các lỗi khác (bao gồm lỗi nghiệp vụ đã được ném từ khối try)
        // Nếu lỗi đã được log bằng console.warn ở trên, không cần log error nữa
        if (!error.message.includes('Không thể làm mới token')) {
          console.error('Lỗi không xác định khi làm mới token:', error); // Lỗi hệ thống
        }
        throw error; // Ném lỗi để component gọi có thể xử lý hiển thị
      }
    } finally {
      setLoadingAuth(false); // Kết thúc tải
    }
  }, []);

  // Hàm kiểm tra quyền
  const hasRole = useCallback((requiredRoles: string[]): boolean => {
    if (!userInfo || !userInfo.roles) {
      return false;
    }
    // Kiểm tra xem người dùng có ít nhất một trong các vai trò yêu cầu không
    return requiredRoles.some(role => userInfo.roles.includes(role));
  }, [userInfo]);

  const isAuthenticated = !!accessToken && !!userInfo; // Đã xác thực nếu có cả access token và user info

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    // Hàm trợ giúp để gửi request với một access token cụ thể
    const doFetch = async (token: string | null) => {
      const response = await fetch(`${NESTJS_API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
        credentials: 'include',
        ...options,
      });
      return response;
    };

    let response = await doFetch(accessToken);

    if (response.status === 401) {

      try {
        // Gọi hàm refreshAccessToken
        await refreshAccessToken();

        // Lấy token mới từ sessionStorage ngay lập tức
        const newAccessToken = localStorage.getItem('accessToken');

        // Thử lại request với token mới
        response = await doFetch(newAccessToken);

        // Nếu sau khi refresh token mà vẫn 401, tức là refresh token cũng hết hạn
        if (response.status === 401) {
          throw new Error('Refresh token đã hết hạn.');
        }
      } catch (e) {
        console.error('Lỗi khi làm mới hoặc thử lại request:', e);
        logout();
        throw new Error('Session expired');
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }, [accessToken, refreshAccessToken, logout]);

  const contextValue = {
    accessToken,
    userInfo,
    isAuthenticated,
    login,
    logout,
    refreshAccessToken,
    hasRole,
    loadingAuth,
    apiCall,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook để dễ dàng sử dụng AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth phải được sử dụng trong AuthProvider');
  }
  return context;
};
