import { User } from '@/types/index';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
  return res.json();
} 