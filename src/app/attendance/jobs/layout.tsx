import React from 'react';
import type { Metadata } from "next";

export const metadata: Metadata = {
title: "Chạy jobs",
description: "Resource Management System",
};

export default function AdminDaillyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">      
      <main>
        {children}
      </main>
    </div>
  );
} 