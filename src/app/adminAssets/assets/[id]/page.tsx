// app/admin/assets/[id]/page.tsx
'use client'
import dynamic from 'next/dynamic';
import React from 'react';

const AssetManagement = dynamic(() => import('@/components/asset/assetManament'), { ssr: false });

type Props = {
  params: { id: string };
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <AssetManagement assetId={id} />;
}
