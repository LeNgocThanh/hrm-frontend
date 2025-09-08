// app/admin/assets/page.tsx
'use client'
import dynamic from 'next/dynamic';

// Tải client component (tránh SSR các API browser-only)
const AssetManagement = dynamic(() => import('@/components/asset/assetManament'), { ssr: false });

export default function Page() {
  return <AssetManagement />;
}
