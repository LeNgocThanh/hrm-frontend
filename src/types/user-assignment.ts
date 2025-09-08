export interface UserAssignment {
  _id: string;
  userId: string | { _id: string };
  organizationId: string | { _id: string };
  positionId: string | { _id: string };
  roleIds: string[];
  isActive: boolean;
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
  timeIn: string;
  timeOut?: string;
  workType: string;    
  user?: import('./index').User;
} 