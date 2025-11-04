import { Organization } from '@/types/organization';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
const accessToken = localStorage.getItem('accessToken');

export async function getOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_URL}/organizations`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  return res.json();
}

export async function getOrganizationsUnder(): Promise<Organization[]> {
  const res = await fetch(`${API_URL}/organizations/under`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  return res.json();
}

export async function createOrganization(data: Partial<Organization>): Promise<Organization> {
  const res = await fetch(`${API_URL}/organizations`, {
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

export async function updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
  const res = await fetch(`${API_URL}/organizations/${id}`, {
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

export async function deleteOrganization(id: string): Promise<void> {
  await fetch(`${API_URL}/organizations/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    credentials: 'include',
  });
} 

export async function getOrganizationsTree(): Promise<Organization[]> {
  const res = await fetch(`${API_URL}/organizations`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  return res.json();
}