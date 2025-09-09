export enum NoticeStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

export enum NoticeVisibility {
  Public = 'public',
  Internal = 'internal',
  RoleBased = 'role_based',
}

export interface FileRef {
  _id: string;
  filename?: string;
  url?: string;         // placeholder nếu BE trả link trực tiếp
  path?: string;        // hoặc path để gọi API tải
}

export interface Notice {
  _id: string;
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  tags?: string[];
  category?: string;
  attachments?: FileRef[];
  coverImage?: FileRef | string; // tùy BE trả ref hay id
  status: NoticeStatus;
  visibility: NoticeVisibility;
  allowedPermissions?: string[];
  publishAt?: string;
  expireAt?: string;
  pinned?: boolean;
  viewCount?: number;
  createdBy?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedNotices {
  items: Notice[];
  page: number;
  limit: number;
  total: number;
}

export type CreateNoticeInput = {
title: string
summary?: string
content?: string
tags?: string[]
category?: string
attachments?: string[] // IDs expected by BE
coverImage?: string // ID expected by BE
status?: NoticeStatus
visibility?: NoticeVisibility
allowedPermissions?: string[]
publishAt?: string // ISO string
expireAt?: string // ISO string
pinned?: boolean
}
