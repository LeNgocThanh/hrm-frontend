import { UserAssignment } from '@/types/user-assignment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
const accessToken = localStorage.getItem('accessToken');

export async function getUserAssignmentsByUser(userId: string): Promise<UserAssignment[]> {
  const res = await fetch(`${API_URL}/user-assignments/user/${userId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    cache: 'no-store'
  });
  return res.json();
}

export async function createUserAssignment(data: Partial<UserAssignment>): Promise<UserAssignment> {
  const res = await fetch(`${API_URL}/user-assignments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateUserAssignmentPATCH(id: string, data: Partial<UserAssignment>): Promise<UserAssignment> {
  const res = await fetch(`${API_URL}/user-assignments/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateUserAssignment(id: string, data: Partial<UserAssignment>): Promise<UserAssignment> {
  const res = await fetch(`${API_URL}/user-assignments/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteUserAssignment(id: string): Promise<void> {
  await fetch(`${API_URL}/user-assignments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` }, credentials: 'include' });
} 