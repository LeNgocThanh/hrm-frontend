import type { PaginatedNotices, Notice } from '@/types/notice';
import type { CreateNoticeInput } from '@/types/notice';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''; // ví dụ: "https://intranet.example.com/api"

export interface ListNoticesParams {
  q?: string;
  category?: string;
  status?: string;
  visibility?: string;
  tags?: string[];
  page?: number;
  limit?: number;
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

  const res = await fetch(url, { next: { revalidate: 10 } }); // SSG/ISR tùy bạn chỉnh
  if (!res.ok) throw new Error('Failed to fetch notices');
  return res.json();
}

/** Chi tiết theo slug hoặc id (placeholder endpoint) */
export async function getNoticeBySlug(slug: string): Promise<Notice> {
  // TODO: thay bằng endpoint thật của bạn
  const url = `${API_BASE}/notices/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch notice detail');
  return res.json();
}

export async function createNotice(input: CreateNoticeInput, token?: string): Promise<Notice> {
// TODO: adjust endpoint/auth as needed
const url = `${API_BASE}/notices`
const headers: HeadersInit = { 'Content-Type': 'application/json' }
if (token) headers['Authorization'] = `Bearer ${token}`


const res = await fetch(url, {
method: 'POST',
headers,
body: JSON.stringify(input),
})
if (!res.ok) {
const msg = await res.text()
throw new Error(msg || 'Failed to create notice')
}
return res.json()
}
