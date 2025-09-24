// src/types/leave.ts
import { api } from '@/lib/api/room-meetings';
export type ObjectId = string;

export enum LeaveType {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
  SICK = 'SICK',
  MATERNITY = 'MATERNITY',
  COMPENSATORY = 'COMPENSATORY',
  OTHER = 'OTHER',
}

export enum LeaveUnit {
  DAY = 'DAY',
  HALF_DAY = 'HALF_DAY',
  HOUR = 'HOUR',
}

export type LeaveStatus = 'pending'|'approved'|'rejected'|'cancelled';

export interface LeaveRequest {
  _id: ObjectId;
  userId: ObjectId;
  reviewerId?: ObjectId;
  leaveType: LeaveType;
  startAt: string; // ISO date
  endAt: string;   // ISO date
  hours?: number;
  status: LeaveStatus;
  reason?: string;
  attachmentIds: ObjectId[];
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface UserLite {
  _id: ObjectId;
  fullName: string;
  email?: string;
}

export interface UploadFileLite {
  _id: ObjectId;
  fileName: string;
  url: string;
  size?: number;
}



// fetcher giống trang mẫu “room-meetings”
// export async function api(path: string, { query, method, body, headers }: {
//   query?: Record<string, any>, method?: string, body?: any, headers?: Record<string,string>
// } = {}) {
//   const qs = query
//     ? '?' + new URLSearchParams(Object.entries(query).reduce((acc, [k, v]) => {
//         if (v === undefined || v === null) return acc;
//         acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
//         return acc;
//       }, {} as Record<string,string>)).toString()
//     : '';
//   const res = await fetch(`${path}${qs}`, {
//     method: method || (body ? 'POST' : 'GET'),
//     headers: {
//       'Content-Type': 'application/json',
//       ...(headers || {}),
//     },
//     body: body ? JSON.stringify(body) : undefined,
//   });
//   if (!res.ok) {
//     const t = await res.text();
//     throw new Error(`API ${res.status}: ${t}`);
//   }
//   return res.json();
// }

export const fetcher = (path: string, query?: Record<string, any>) => api(path, { query });
