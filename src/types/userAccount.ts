// types/userAccount.ts
// Định nghĩa các kiểu dữ liệu cho tài khoản người dùng và DTOs

 // Giả định Types.ObjectId từ mongoose

// Giao diện cơ bản cho UserAccount, dựa trên user-account.schema.ts
export interface UserAccount {
  userId: string; // Sẽ là string ở frontend, backend xử lý thành Types.ObjectId
  username: string;
  password?: string; // Mật khẩu là tùy chọn cho cập nhật, bắt buộc cho tạo
  status: 'active' | 'inactive' | 'locked' | 'suspended';
  lastLoginAt?: Date;
  loginAttempts?: number;
  lockedUntil?: Date;
  isEmailVerified?: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdBy?: string; // ID người tạo
  editedBy?: string; // ID người chỉnh sửa
  createTime?: Date;
  updateTime?: Date;
}

// Giao diện cho phản hồi từ API (bao gồm _id và timestamps)
export interface UserAccountResponse extends UserAccount {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

// DTO để tạo tài khoản người dùng mới
export interface CreateUserAccountDto {
  userId: string;
  username: string;
  password: string; // Mật khẩu là bắt buộc khi tạo
}

// DTO để cập nhật tài khoản người dùng hiện có
export interface UpdateUserAccountDto {
  username?: string;
  password?: string;
  status?: 'active' | 'inactive' | 'locked' | 'suspended';
  lastLoginAt?: Date;
  loginAttempts?: number;
  lockedUntil?: Date;
  isEmailVerified?: boolean;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  editedBy?: string;
}

// Giao diện cho User (để chọn người dùng liên kết tài khoản)
// Lấy từ UserProfile.tsx
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