export type ObjectId = string;

export enum MeetingStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export type Participant = {
  userId: ObjectId;
  role: 'CHAIR' | 'REQUIRED' | 'OPTIONAL';
  response: 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
  note?: string;
};

export type ExternalGroup = {
  leaderName?: string;
  leaderPhone?: string;
  organization?: string;
  note?: string;
  headcount: number;
};

export type Meeting = {
  _id: ObjectId;
  organizationId: ObjectId;
  createdBy: ObjectId;
  organizerId: ObjectId;
  roomId: ObjectId;
  title: string;
  agenda?: string;
  note?: string;
  startAt: string; // ISO
  endAt: string;   // ISO
  participants: Participant[];
  externalGuests: ExternalGroup[];
  externalHeadcount: number;
  status: MeetingStatus;
};

export type MeetingRoom = {
  _id: ObjectId;
  organizationId: ObjectId;
  name: string;
  location?: string;
  capacity: number;
  equipment: string[];
  isActive: boolean;
  requiresApproval: boolean;
};
