import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/layout/Navigation";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import QueryProvider from "@/components/notice/QuerryProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
title: "Phần mềm quản lý",
description: "Resource Management System",
};


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
return (
<html lang="vi" className="h-full">
<body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-gray-50`}>
<AuthProvider>
    <QueryProvider>
<div className="min-h-screen flex flex-col">
{/* Sticky, translucent nav with backdrop for readability */}
<Navigation />


{/* Main grows to fill, safe paddings for small screens */}
<main className="flex-1">
{/* Optional global container; many pages already add their own.
If your pages already handle container spacing, you can remove the wrapper below. */}
<div className="max-w-9xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
<AuthGuard>
{children}
</AuthGuard>
</div>
</main>
</div>
</QueryProvider>
</AuthProvider>
</body>
</html>
);
}