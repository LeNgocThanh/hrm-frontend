import type { PaginatedNotices } from '@/types/notice';
import type { CreateNoticeInput, Notice } from '@/types/notice';

export type NoticeStatus = 'draft' | 'published' | 'archived'
export type NoticeVisibility = 'public' | 'internal' 

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
export type { Notice } from '@/types/notice'
// Nếu bạn muốn định nghĩa riêng, có thể tham khảo như dưới đây

// export interface Notice {
//   _id: string
//   title: string
//   summary?: string
//   category?: string
//   status: NoticeStatus
//   visibility: NoticeVisibility
//   tags?: string[]
//   publishAt?: string
//   expireAt?: string
//   createdAt?: string
//   updatedAt?: string
//   slug?: string
// }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'; // ví dụ: "https://intranet.example.com/api"

export interface ListNoticesParams {
  q?: string;
  category?: string;
  status?: string;
  visibility?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface PatchNoticeInput {
  status?: 'draft' | 'published' | 'archived'
  visibility?: 'public' | 'internal'
  publishAt?: string | Date
  expireAt?: string | Date
}


/** Helper build querystring */
const toQS = (params: Record<string, any>) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((vv) => usp.append(k, String(vv)));
    else usp.set(k, String(v));
  });
  return usp.toString();
};

/** Danh sách thông báo (placeholder endpoint) */
export async function listNotices(params: ListNoticesParams = {}): Promise<PaginatedNotices> {
  // TODO: thay bằng endpoint thật của bạn
  const qs = toQS(params);
  const url = `${API_BASE}/notices${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { next: { revalidate: 10 }, credentials: 'include' }); // SSG/ISR tùy bạn chỉnh
  if (!res.ok) throw new Error('Failed to fetch notices');
  return res.json();
}

/** Chi tiết theo slug hoặc id (placeholder endpoint) */
export async function getNoticeBySlug(slug: string): Promise<Notice> {
  console.log('getNoticeBySlug', slug)
  // TODO: thay bằng endpoint thật của bạn
  const url = `${API_BASE}/notices/${encodeURIComponent(slug)}`;  
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' }); // no-store vì chi tiết thường cần mới nhất
  if (!res.ok) throw new Error('Failed to fetch notice detail');
  return res.json();
}

export async function createNotice(input: CreateNoticeInput): Promise<Notice> {
// TODO: adjust endpoint/auth as needed
const url = `${API_BASE}/notices`
const headers: HeadersInit = { 'Content-Type': 'application/json' }
const res = await fetch(url, {
method: 'POST',
headers,
credentials: 'include',
body: JSON.stringify(input),
})
if (!res.ok) {
const msg = await res.text()
throw new Error(msg || 'Failed to create notice')
}
return res.json()
}

export async function patchNoticeAdmin(id: string, input: PatchNoticeInput, token?: string): Promise<Notice> {
  const url = `${API_BASE}/notices/${encodeURIComponent(id)}`
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || 'Failed to patch notice')
  }
  return res.json()
}

export interface AdminListParams {
  q?: string
  category?: string
  status?: NoticeStatus[] | NoticeStatus
  visibility?: NoticeVisibility[] | NoticeVisibility
  tags?: string[] | string
  timeField?: 'createdAt' | 'publishAt' | 'updatedAt'
  from?: string // ISO
  to?: string   // ISO
  page?: number
  limit?: number
}

function appendParam(sp: URLSearchParams, key: string, val: any) {
  if (val == null || val === '') return
  if (Array.isArray(val)) val.forEach(v => appendParam(sp, key, v))
  else sp.append(key, String(val))
}

export async function adminListNotices(params: AdminListParams = {}, token?: string): Promise<Paginated<Notice>> {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => appendParam(sp, k, v))
  const url = `${API_BASE}/notices/admin?${sp.toString()}`
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { headers, credentials: 'include' })
  if (!res.ok) throw new Error(await res.text() || 'Failed to list notices')
  return res.json()
}

// ===== Admin: GET one =====
export async function adminGetNotice(id: string, token?: string): Promise<Notice> {
  const url = `${API_BASE}/notices/${encodeURIComponent(id)}`
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { headers, credentials: 'include' })
  if (!res.ok) throw new Error(await res.text() || 'Failed to get notice')
  return res.json()
}

// ===== Admin: PATCH (partial) =====
export interface PatchNoticeInput {
  status?: NoticeStatus
  visibility?: NoticeVisibility
  publishAt?: string | Date
  expireAt?: string | Date
  title?: string
  summary?: string
  category?: string
  tags?: string[] | string
}

// ===== Admin: DELETE =====
export async function adminDeleteNotice(id: string, token?: string): Promise<{ deleted: boolean }> {
  const url = `${API_BASE}/notices/${encodeURIComponent(id)}`
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { method: 'DELETE', headers, credentials: 'include' })
  if (!res.ok) throw new Error(await res.text() || 'Failed to delete notice')
  return res.json()
}