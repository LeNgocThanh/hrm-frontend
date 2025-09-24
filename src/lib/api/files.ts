// src/lib/api/files.ts
import type { UploadFileRef, UploadFileInfo, UploadResponse } from '@/types/upload'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn').replace(/\/+$/, '');  // Cấu hình base URL của API''

// Endpoints theo backend của bạn:
const UPLOAD_URL = `${API_BASE}/files/upload`              // POST form-data: file, uploadedBy, resourceType
const DOWNLOAD_BASE = `${API_BASE}/fileDetails/download`   // GET ?path=...
const FILE_INFO_URL = (id: string) => `${API_BASE}/files/${id}`

// ==============================
// Core helpers (download URL, normalizer)
// ==============================
export function buildDownloadUrlFromPath(path?: string) {
  if (!path) return undefined;
  const p = path.replace(/^\/+/, '');                 // bỏ / đầu
  const sp = new URLSearchParams({ path: p });
  return `${DOWNLOAD_BASE}?${sp.toString()}`;
}

function normalizeOne(x: any): UploadFileRef | null {
  if (!x) return null
  return {
    id: x.id || x._id || x.fileId || '',
    originalName: x.originalName || x.filename,
    filename: x.filename,
    mimetype: x.mimetype || x.mimeType,
    size: x.size,
    path: x.path,
    publicUrl: x.publicUrl,
  }
}

// ==============================
// Upload API (resourceType = 'noties')
// ==============================
export async function uploadFile(
  file: File,
  opts: { uploadedBy?: string; resourceType?: string } = {},
  token?: string,
): Promise<UploadFileRef> {
  const fd = new FormData()
  fd.append('file', file)
  if (opts.uploadedBy) fd.append('uploadedBy', opts.uploadedBy)
  // CHỐT: resourceType theo yêu cầu
  fd.append('resourceType', opts.resourceType || 'noties')

  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(UPLOAD_URL, { method: 'POST', credentials: 'include', headers, body: fd })
  const json: UploadResponse = await res.json()
  if (!res.ok) throw new Error((json as any)?.message || 'Upload failed')

  // ✅ KHÔNG dùng `as any` ở đây.
  // Type Guard 'id' in json sẽ hoạt động chính xác.
  if ('id' in json) {
    // TypeScript hiểu `json` là kiểu { id, ... } ở đây
    const r = normalizeOne(json)
    if (!r) throw new Error('Invalid upload response')
    return r
  } else {
    // TypeScript hiểu `json` là kiểu { files, ... } ở đây
    const arr = (json.files || json.data || json.result || json.uploaded || []) as any[]
    const r = normalizeOne(arr[0])
    if (!r) throw new Error('No file returned')
    return r
  }
}

export async function uploadFiles(
  files: File[],
  opts: { uploadedBy?: string; resourceType?: string } = {},
  token?: string,
): Promise<UploadFileRef[]> {
  const out: UploadFileRef[] = []
  for (const f of files) out.push(await uploadFile(f, opts, token))
  return out
}

// ==============================
// File info APIs
// ==============================
export async function getFileInfo(id: string, token?: string): Promise<UploadFileInfo> {
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(FILE_INFO_URL(id), { headers, cache: 'no-store', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to get file info')
  return res.json()
}

export async function getFileInfos(ids: string[], token?: string): Promise<UploadFileInfo[]> {
  return Promise.all(ids.map((id) => getFileInfo(id, token)))
}

// ==============================
// Compatibility helpers for AttachmentList
// ==============================
/** Trả về URL public (nếu có) hoặc link download theo path. */
export function getFileUrl(
  file: UploadFileRef | UploadFileInfo | null | undefined
): string | undefined {
  if (!file) return undefined;

  // 1) Ưu tiên publicUrl nếu backend có phát hành public
  //  const publicUrl = (file as any).publicUrl as string | undefined;
  //  if (publicUrl) return publicUrl;

  // 2) Nếu có path -> build đúng router download ?path=...
  const path: string | undefined = file.path || file.id;
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;

  // 3) Nếu BE serve static /uploads trực tiếp trên API_BASE
  if (/^\/?uploads\//i.test(path)) {
    return `${API_BASE}/${path.replace(/^\/+/, '')}`;
  }

  return buildDownloadUrlFromPath(path);
}

/** Đoán tên file: originalName > filename > path > id. */
export function bestGuessFileName(file: UploadFileRef | UploadFileInfo): string {

  return file.originalName || file.filename || file.path || (file as any).id || (file as any)._id || 'file'
}

/** Nhận diện ảnh theo mimetype hoặc phần đuôi tên file (fallback). */
export function isImageLike(file: UploadFileRef | UploadFileInfo): boolean {
  // @ts-expect-error – chấp nhận mọi biến thể
  const mt = (file.mimetype || file.mimeType || '').toLowerCase()
  if (mt) return mt.startsWith('image/')
  const name = bestGuessFileName(file).toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
}

/** Dành cho nơi cần URL public: ưu tiên publicUrl, fallback về download link. */
export function filePublicUrl(info?: UploadFileInfo | UploadFileRef): string | undefined {
  return getFileUrl(info as any)
}
