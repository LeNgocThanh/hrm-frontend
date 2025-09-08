import { Permission } from '@/types/permission';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function getPermissions(): Promise<Permission[]> {
  const res = await fetch(`${API_URL}/permissions`, { cache: 'no-store', 
    headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json',
  },
   });
  return res.json();
}

export async function createPermission(data: Partial<Permission>): Promise<Permission> {
  const res = await fetch(`${API_URL}/permissions`, {
    method: 'POST',
    headers: {  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updatePermission(id: string, data: Partial<Permission>): Promise<Permission> {
  const res = await fetch(`${API_URL}/permissions/${id}`, {
    method: 'PUT',
    headers: {  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deletePermission(id: string): Promise<void> {
  await fetch(`${API_URL}/permissions/${id}`, { method: 'DELETE', 
     headers: {  'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
   });
} 