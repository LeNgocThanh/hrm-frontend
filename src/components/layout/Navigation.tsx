"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Bell from "@/components/notifications/Bell";

const navigationItems = [
  { name: "Trang chủ", href: "/", icon: "🏠",
    children: [
      { name: "Trang chủ", href: "/", icon: "🏠" },
      { name: "Thông báo", href: "/notices", icon: "📣" },
      { name: "Quản trị thông báo", href: "/notices/admin", icon: "🛠️📣" },
      { name: "Tạo thông báo mới", href: "/notices/new", icon: "📣" },
    ],
   },
  {
    name: "Nhân sự",
    icon: "👨‍💼",
    children: [
      { name: "Tổng quan", href: "/basic-view/userDashBoard", icon: "📊👨‍💼" },
      { name: "Nhân sự", href: "/admin/users", icon: "🛠️👨‍💼" },
      { name: "Chức vụ", href: "/admin/positions", icon: "🛠️💼" },
      { name: "Tổ chức", href: "/admin/organizations", icon: "🛠️🏢" },
    ],
  },
  {
    name: "Nghỉ phép",
    icon: "📝",
    children: [
      { name: "Tổng quan", href: "/leaveRequest/reports", icon: "📊📝" },
      { name: "Đơn xin nghỉ phép", href: "/leaveRequest/create", icon: "🛠️📝" },
      { name: "Duyệt đơn nghỉ phép", href: "/leaveRequest/approvals", icon: "🛠️📝" },      
    ],
  },
  {
    name: "Tài sản",
    icon: "💼",
    children: [
       { name: "Tổng quan", href: "/basic-view/assetDashBoard", icon: "📊💼" },
      { name: "Quản trị Tài sản", href: "/adminAssets/assets", icon: "🛠️👨‍💼" },
      { name: "View tài sản", href: "/basic-view/asset", icon: "🔎💼" },
    ],
  },
  {
    name: "Lịch họp",
    icon: "📅",
    children: [
       { name: "Tổng quan cuộc họp", href: "/roomMeetings/dashboard", icon: "📊📅" },
      { name: "Đăng ký lịch họp", href: "/roomMeetings/meetings/new", icon: "🛠️📅" },
      { name: "Duyệt lịch họp", href: "/roomMeetings/registrations", icon: "🛠️📅" },
      { name: "Xem lịch họp", href: "/roomMeetings/rooms", icon: "🔎📅" },
    ],
  },
  {
    name: "Xem và tìm kiếm",
    icon: "🔍",
    children: [
      { name: "View Cây cơ cấu tổ chức", href: "/basic-view/organization-structure", icon: "🔎🌳" },
      { name: "Tìm kiếm Nhân sự", href: "/basic-view/users-report", icon: "🔎👨‍💼" },
      { name: "Dành cho HR", href: "/basic-view/userView", icon: "🔎👨‍💼" },
      { name: "Tài sản", href: "/basic-view/asset", icon: "🔎💼" },
      { name: "Lịch họp", href: "/roomMeetings/rooms", icon: "🔎📅" },
    ],
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  // Read name on client to avoid hydration mismatch
  const [fullName, setFullName] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = window?.localStorage?.getItem("userInfo");
      if (raw) setFullName(JSON.parse(raw)?.fullName || null);
    } catch {}
  }, []);

  // Desktop dropdowns
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  // Mobile states
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const isActive = (href?: string) => (href ? pathname === href : false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Close menus on route change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
    setOpenAccordion(null);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur supports-backdrop-blur:bg-white/70">
      <div className="mx-auto max-w-8xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Brand + Mobile toggle */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
              aria-label="Mở menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {/* hamburger */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" fill="none" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <Link href="/" className="text-base sm:text-xl font-bold text-gray-800">
              Quản trị doanh nghiệp
            </Link>
          </div>

          {/* Center: Desktop menu */}
          <div className="hidden md:flex items-center gap-1">
            {navigationItems.map((item) => (
              <div key={item.name} className="relative">
                {item.children ? (
                  <div>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      aria-expanded={openDropdown === item.name}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.name}
                      <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    </button>
                    {openDropdown === item.name && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black/5 z-[60]">
                        <div className="py-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`flex items-center px-4 py-2 text-sm transition-colors ${isActive(child.href) ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
                              onClick={() => setOpenDropdown(null)}
                            >
                              <span className="mr-2">{child.icon}</span>
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href as string}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive(item.href) ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"}`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-gray-700">Hi: <span className="font-medium">{fullName ?? "—"}</span></span>
            <Bell />
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 hover:text-green-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              LogOut
            </button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <div className={`md:hidden border-t border-gray-200 bg-white ${mobileOpen ? "block" : "hidden"}`}>
        <div className="px-4 py-3 space-y-1">
          {navigationItems.map((item) => (
            <div key={item.name} className="">
              {item.children ? (
                <div>
                  <button
                    onClick={() => setOpenAccordion(openAccordion === item.name ? null : item.name)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                    aria-expanded={openAccordion === item.name}
                  >
                    <span className="flex items-center"><span className="mr-2">{item.icon}</span>{item.name}</span>
                    <svg className={`h-4 w-4 transition-transform ${openAccordion === item.name ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                  </button>
                  {openAccordion === item.name && (
                    <div className="pl-8 pr-2 py-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-3 py-2 rounded-md text-sm ${isActive(child.href) ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
                        >
                          <span className="mr-2">{child.icon}</span>
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href as string}
                  className={`block px-3 py-2 rounded-md text-sm ${isActive(item.href) ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              )}
            </div>
          ))}

          {/* Mobile footer line (user + logout) */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-700">Hi: <span className="font-medium">{fullName ?? "—"}</span></span>
            <button onClick={handleLogout} className="text-sm font-medium text-green-700 hover:text-green-900">LogOut</button>
          </div>
        </div>
      </div>
    </nav>
  );
}