import { UserDocumentResponse, DocTypeEnum } from '@/types/userDocument';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
const accessToken = localStorage.getItem('accessToken');

function jsonHeaders() {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

function assertOk(res: Response) {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
}

// -------------------- User Documents --------------------
// Lấy tất cả tài liệu của một người dùng theo userId
export async function getUserDocument(userId: string): Promise<UserDocumentResponse[]> {
  const res = await fetch(`${API_URL}/user-documents/user/${userId}`, {
    headers: jsonHeaders(),
    cache: 'no-store'
  });
  assertOk(res);
  return res.json();
}

// Lấy một tài liệu người dùng theo ID
export async function getUserDocumentById(id: string): Promise<UserDocumentResponse> {
  const res = await fetch(`${API_URL}/user-documents/${id}`, { headers: jsonHeaders() });
  assertOk(res);
  return res.json();
}

// Tạo một tài liệu người dùng mới
export async function createUserDocument(
  payload: {
    userId: string;
    docType: DocTypeEnum;
    otherDocTypeDescription?: string;
    fileId: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<UserDocumentResponse> {
  const res = await fetch(`${API_URL}/user-documents`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

// Cập nhật một tài liệu người dùng
export async function updateUserDocument(
  id: string,
  payload: {
    docType?: DocTypeEnum;
    otherDocTypeDescription?: string;
    fileId?: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<UserDocumentResponse> {
  const res = await fetch(`${API_URL}/user-documents/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

// Xóa một tài liệu người dùng
export async function deleteUserDocument(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/user-documents/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
  });
  assertOk(res);
  return res.json();
}