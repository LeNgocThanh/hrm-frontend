// lib/api/asset.ts
import type {
  Asset,
  AssetDocument,
  AssetEvent,
  AssetDocType,
  AssetEventType,
  ResourceType,
  UploadFile,
  AssetStatus,
  AssetType,
} from '@/types/asset';
const accessToken = localStorage.getItem('accessToken');

import type { User } from '@/types/index';
import { Organization } from '@/types/organization';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

function assertOk(res: Response) {
  if (!res.ok) {
    // cố gắng đọc body lỗi từ NestJS
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`  };
}
//----------------- Organization -------------------
export async function listOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_BASE}/organizations`, { next: { revalidate: 0 }, headers: {
    'Authorization': `Bearer ${accessToken}`
  }});
  assertOk(res);
  const data = await res.json();
  // Chuẩn hóa tối thiểu
  return Array.isArray(data) ? data : (data?.data ?? []);
}

// -------------------- Users --------------------
export async function listUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`, { next: { revalidate: 0 },headers: {
    'Authorization': `Bearer ${accessToken}`
  }});
  assertOk(res);
  const data = await res.json();
  // Chuẩn hóa tối thiểu
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function listUsersInOrganization(id: string): Promise<User[]> {
  const res = await fetch(`${API_BASE}/organizations/${id}/users`, { next: { revalidate: 0 }, headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  },
cache: 'no-store',
 });
  assertOk(res);
  const data = await res.json(); 

  return Array.isArray(data) ? data : (data?.users ?? []);
}


// -------------------- Assets --------------------
export async function listAssets(params?: {
  search?: string;
  type?: AssetType;
  status?: AssetStatus;
  metadata?: Record<string, string>;
  sortBy?: keyof Asset;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}): Promise<{ assets: Asset[]; total?: number }> {
  const q = new URLSearchParams();

  // Thêm các tham số vào chuỗi truy vấn nếu chúng tồn tại
  if (params?.search) q.set('search', params.search);
  if (params?.type) q.set('type', params.type);
  if (params?.status) q.set('status', params.status);
  
  // Xử lý tìm kiếm metadata
  if (params?.metadata) {
    for (const [key, value] of Object.entries(params.metadata)) {
      if (key && value) {
        q.set(`metadata.${key}`, value);
      }
    }
  }

  // Thêm các tham số sắp xếp
  if (params?.sortBy) q.set('sortBy', params.sortBy);
  if (params?.sortOrder) q.set('sortOrder', params.sortOrder);

  // Thêm các tham số phân trang
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));

  const url = `${API_BASE}/assets?${q.toString()}`;

  const res = await fetch(url, { next: { revalidate: 0 }, headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  const data = await res.json();
  return Array.isArray(data) ? { assets: data } : data;
}

export async function getAsset(id: string): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`, { next: { revalidate: 0 }, headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  return res.json();
}

export async function createAsset(payload: Partial<Asset>): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function updateAsset(id: string, payload: Partial<Asset>): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function deleteAsset(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/assets/${id}`, { method: 'DELETE', headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  return res.json();
}

// -------------------- Events --------------------
export async function listAssetEvents(assetId: string): Promise<AssetEvent[]> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/history`, { next: { revalidate: 0 }, headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  return res.json();
}

export async function createAssetEvent(
  assetId: string,
  payload: { type: AssetEventType; date: string; note?: string; cost?: { amount: number; currency: string }; fromUserId?: string;
    toUserId?: string; }
): Promise<AssetEvent> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/events`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function deleteAssetEvent(eventId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/assets/events/${eventId}`, { method: 'DELETE', headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  return res.json();
}

// -------------------- Documents --------------------
export async function listAssetDocuments(assetId: string): Promise<AssetDocument[]> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/documents`, { next: { revalidate: 0 }, headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  return res.json();
}

export async function createAssetDocument(
  assetId: string,
  payload: { type: AssetDocType; date: string; description?: string; fileIds?: string[]; code?: string, ownerUserId?: string }
): Promise<AssetDocument> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/documents`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function deleteAssetDocument(assetId: string, docId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/assets/documents/${docId}`, { method: 'DELETE', headers: {authorization: `Bearer ${accessToken}`} });
  assertOk(res);
  return res.json();
}

// -------------------- Files --------------------
export async function uploadFile(
  file: File,
  options: { resourceType: ResourceType; relatedId?: string, uploaderId?: string }
): Promise<UploadFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('resourceType', options.resourceType);
  form.append('uploadedBy', options.uploaderId || ''); // Thêm uploaderId nếu có
  if (options.relatedId) form.append('relatedId', options.relatedId);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,      
    },
    body: form,
  });
  assertOk(res);
  return res.json();
}

export function buildFileUrl(file: UploadFile): string | undefined {
  if (file.url) return file.url;
  if (file.bucket && file.key) return `${API_BASE}/files/${file._id}`; // fallback GET endpoint
  if (file._id) return `${API_BASE}/files/${file._id}`;
  return undefined;
}
