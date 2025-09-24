import { CreateUserAccountDto, UpdateUserAccountDto, UserAccountResponse } from '@/types/userAccount';

// URL cơ sở của API NestJS của bạn
const NESTJS_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn'; // Đảm bảo URL này chính xác
const accessToken = localStorage.getItem('accessToken');

export const userAccountApi = {
  /**
   * Tạo một tài khoản người dùng mới.
   * @param data Dữ liệu để tạo tài khoản người dùng.
   * @returns Promise chứa phản hồi tài khoản người dùng.
   */
  createUserAccount: async (data: CreateUserAccountDto): Promise<UserAccountResponse> => {
    const response = await fetch(`${NESTJS_API_BASE_URL}/user-accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
        , 'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create user account');
    }
    return response.json();
  },

  /**
   * Lấy tài khoản người dùng theo ID tài khoản.
   * @param id ID của tài khoản người dùng.
   * @returns Promise chứa tài khoản người dùng hoặc null nếu không tìm thấy.
   */
  getUserAccountById: async (id: string): Promise<UserAccountResponse | null> => {
    const response = await fetch(`${NESTJS_API_BASE_URL}/user-accounts/${id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 404) {
      return null; // Không tìm thấy tài khoản
    }
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch user account by ID');
    }
    return response.json();
  },

  /**
   * Lấy tài khoản người dùng theo ID người dùng.
   * @param userId ID của người dùng.
   * @returns Promise chứa tài khoản người dùng hoặc null nếu không tìm thấy.
   */
  getUserAccountByUserId: async (userId: string): Promise<UserAccountResponse | null> => {
    const response = await fetch(`${NESTJS_API_BASE_URL}/user-accounts/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Không sử dụng cache để đảm bảo lấy dữ liệu mới nhất
    });
    console.log('Response:', response); // Giữ lại để debug

    // Kiểm tra nếu phản hồi là 404 hoặc không có nội dung
    if (response.status === 404) {
      return null; // Không tìm thấy tài khoản cho userId này
    }

    // Kiểm tra nếu phản hồi có nội dung và là JSON hợp lệ
    const contentType = response.headers.get('content-type');
    if (response.ok && contentType && contentType.includes('application/json')) {
      // Chỉ cố gắng phân tích cú pháp JSON nếu có nội dung và là JSON
      const data = await response.json();
      return data;
    } else if (response.ok && (!contentType || !contentType.includes('application/json'))) {
      // Trường hợp 200 OK nhưng không phải JSON (có thể là body rỗng)
      // Điều này thường xảy ra nếu backend trả về 200 OK với body rỗng khi không tìm thấy.
      // Chúng ta sẽ coi đây là trường hợp không tìm thấy tài khoản.
      console.warn('Received 200 OK but response is not JSON or empty body:', response);
      return null;
    } else {
      // Xử lý các lỗi khác (ví dụ: 500 Internal Server Error)
      const errorData = await response.json(); // Cố gắng lấy lỗi nếu có
      throw new Error(errorData.message || `Failed to fetch user account by user ID with status: ${response.status}`);
    }
  },

  /**
   * Cập nhật tài khoản người dùng hiện có.
   * @param id ID của tài khoản người dùng cần cập nhật.
   * @param data Dữ liệu cập nhật.
   * @returns Promise chứa phản hồi tài khoản người dùng đã cập nhật.
   */
  updateUserAccount: async (id: string, data: UpdateUserAccountDto): Promise<UserAccountResponse> => {
    const response = await fetch(`${NESTJS_API_BASE_URL}/user-accounts/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update user account');
    }
    return response.json();
  },

  /**
   * Xóa tài khoản người dùng.
   * @param id ID của tài khoản người dùng cần xóa.
   * @returns Promise chứa phản hồi tài khoản người dùng đã xóa.
   */
  deleteUserAccount: async (id: string): Promise<UserAccountResponse> => {
    const response = await fetch(`${NESTJS_API_BASE_URL}/user-accounts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete user account');
    }
    return response.json();
  },
};