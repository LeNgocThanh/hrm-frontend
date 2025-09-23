import { Position } from '@/types/position';
import { access } from 'fs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
const accessToken = localStorage.getItem('accessToken');

export async function getPositions(): Promise<Position[]> {
  const res = await fetch(`${API_URL}/positions`, { 
    headers: { 'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json' },
     cache: 'no-store' } );
  return res.json();
}

export async function createPosition(data: Partial<Position>): Promise<Position> {
  const res = await fetch(`${API_URL}/positions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`
      , 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updatePosition(id: string, data: Partial<Position>): Promise<Position> {
  const res = await fetch(`${API_URL}/positions/${id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}`
    , 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deletePosition(id: string): Promise<void> {
  await fetch(`${API_URL}/positions/${id}`, { method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
   });
} 