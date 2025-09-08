export interface Organization {
  _id: any;
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  level: number;
  createdAt: string;
  updatedAt: string;
  parent?: string;
  path?: string;
} 