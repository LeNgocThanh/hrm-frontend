import { Role } from '@/types/role';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
const accessToken = localStorage.getItem('accessToken');

export async function getRoles(): Promise<Role[]> {
  const res = await fetch(`${API_URL}/roles`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createRole(data: Partial<Role>): Promise<Role> {
  const res = await fetch(`${API_URL}/roles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateRole(id: string, data: Partial<Role>): Promise<Role> {
  const res = await fetch(`${API_URL}/roles/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRole(id: string): Promise<void> {
  await fetch(`${API_URL}/roles/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
} 