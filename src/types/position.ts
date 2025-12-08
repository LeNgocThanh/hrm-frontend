export interface Position {
  _id: string;
  name: string;
  description?: string;
  level: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  code: string;
} 