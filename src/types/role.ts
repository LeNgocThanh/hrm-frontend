export interface Role {
  _id: string;
  name: string;
  description?: string;
  permissionIds: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
} 