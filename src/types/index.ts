// User types
export interface User {
  _id: string;
  fullName: string;
  birthDay: string; // ISO date string
  gender: string;
  details: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  employeeStatus: 'active' | 'inactive' | 'terminated';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  fullName: string;
  birthDay: string;
  gender: string;
  details?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  employeeStatus?: 'active' | 'inactive' | 'terminated';
}

export interface UpdateUserData {
  fullName?: string;
  birthDay?: string;
  gender?: string;
  details?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  employeeStatus?: 'active' | 'inactive' | 'terminated';
}

// Role types
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

// Permission types
export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  createdAt: string;
  updatedAt: string;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: string;
  path?: string;
}

// Position types
export interface Position {
  id: string;
  title: string;
  description?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: Organization;
}

// User Assignment types
export interface UserAssignment {
  id: string;
  userId: string;
  positionId: string;
  organizationId: string;
  timeIn: string;
  timeOut?: string;
  isActive: boolean;
  workType: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  position?: Position;
  organization?: Organization;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 

export interface PermissionData {
  organizationId: string;
  permissions: string[];
  groupedPermissions: Record<string, string[]>;
}
