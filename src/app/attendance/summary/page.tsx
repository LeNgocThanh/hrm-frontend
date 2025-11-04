"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getUsersUnderOrganizations, getUserWithOrganizationUnder } from "@/lib/api/users";
import { UserWithOrganization } from "@/types";
import { Organization as OrganizationType } from "@/types/organization";
import { getOrganizations } from "@/lib/api/organizations";
// Đã loại bỏ các import không cần thiết cho Summary Page
// Ví dụ: AT_STATUS, STATUS_OPTIONS_AT, DailyRow, DailySessionActual, ...

// Env
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// --- Types khớp backend mới (Summary) ---

// Khớp với AttendanceSummaryInterface từ summary.service.ts
interface AttendanceSummaryInterface {
  userId: string;
  monthKey: string; // 'YYYY-MM'
  days: {
    days: number;
    presentDays: number;
    leaveDays: number; // Thêm vào từ summary.service.ts
    fullDays: number;
    halfDaysAM: number;
    halfDaysPM: number;
    absentDays: number;
  };
  minutes: {
    worked: number;
    late: number;
    earlyLeave: number;
    hourWork: number;
    workedCheckIn: number;
  };
  computedAt: string | Date; // Date là object/string
}

interface UserLite { _id: string; fullName: string; email?: string }

// --- fetch util ---
// Giữ nguyên hàm api, chỉ thay đổi kiểu trả về trong useSWR
async function api(path: string, opts: any = {}) {
  const { method = "GET", query, body, headers } = opts;
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v != null && v !== "")
        url.searchParams.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    });
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { Accept: "application/json, text/plain, */*", "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const txt = await res.text();
      if (isJson && txt) msg = (JSON.parse(txt).message || msg);
      else if (txt) msg = txt;
    } catch { }
    throw new Error(msg || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  let txt = "";
  try { txt = await res.text(); } catch { return null; }
  if (!txt || !txt.trim()) return null;

  if (isJson) {
    try { return JSON.parse(txt); } catch { return { data: txt }; }
  }
  return { data: txt };
}

// --- mini SWR ---
function useSWR<T>(key: any, fetcher: any) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!key);
  const [error, setError] = useState<any>(null);
  const fetchKey = typeof key === "string" ? key : JSON.stringify(key);

  useEffect(() => {
    if (!fetchKey || fetchKey === "null") {
      setData(null); setIsLoading(false); setError(null); return;
    }
    let cancelled = false;
    setIsLoading(true); setError(null);
    fetcher(key)
      .then((res: any) => { if (!cancelled) setData(res.data || res); })
      .catch((e: any) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);
  return { data, isLoading, error, mutate: () => { } };
}

const summaryFetcher = (path: string) => api(path);

export default function MonthlyAttendanceSummaryPage() {
  const [userId, setUserId] = useState<string>("");
  const tz = "Asia/Bangkok";
  const todayKey = useMemo(() => toDateKeyLocal(new Date(), tz), []);
  const currentMonthKey = todayKey.slice(0, 7); // YYYY-MM
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthKey);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(''); // Rỗng là "Tất cả"
  const EMPTY_USERS: UserWithOrganization[] = React.useMemo(() => [], []);
  const EMPTY_ORGS: OrganizationType[] = React.useMemo(() => [], []);
  const [nameFilter, setNameFilter] = useState<string>('');

  // Users
  const { data: users, isLoading: isLoadingUsers } = useSWR<UserWithOrganization[]>("/users/withOrganizationName", api);
  const { data: orgsData, isLoading: isLoadingOrganizations } = useSWR<OrganizationType[]>("/organizations/under", api);

const allUsers = users ?? EMPTY_USERS;
const organizations = orgsData ?? EMPTY_ORGS;

  // Monthly Summary
  const swrKey = useMemo(() => {
    if (!userId) return null;
    const params = new URLSearchParams({ userId, monthKey: filterMonth });
    // Dùng endpoint GET /attendance
    return `/attendance?${params.toString()}`;
  }, [userId, filterMonth]);



  const { data: summaryData, isLoading: isLoadingSummary, error } = useSWR<AttendanceSummaryInterface>(swrKey, summaryFetcher);

  const filteredUsers = useMemo(() => {
      let users = allUsers;
  
      // 1. Lọc theo Organization
      if (selectedOrganizationId) {
        users = users.filter(user => user.organizationId === selectedOrganizationId);
      }
  
      // 2. Lọc theo Tên
      if (nameFilter) {
        const lowerCaseFilter = nameFilter.toLowerCase();
        users = users.filter(user => user.fullName.toLowerCase().includes(lowerCaseFilter));
      }
  
      return users;
    }, [allUsers, selectedOrganizationId, nameFilter]);

  // Tính toán Tỉ lệ công (Work Ratio)
  const workRatio = useMemo(() => {
    const worked = summaryData?.minutes.worked ?? 0;
    const hourWork = summaryData?.minutes.hourWork ?? 0;

    if (hourWork === 0) return 'N/A';

    const ratio = (worked / hourWork) * 100;
    return ratio.toFixed(2);
  }, [summaryData]);

  // Handler cho việc chọn tháng
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Giá trị e.target.value sẽ là YYYY-MM
    setFilterMonth(e.target.value);
  }

  // Lấy ra tên nhân viên
  const selectedUser = useMemo(() => {
    return users?.find(u => u._id === userId);
  }, [users, userId]);


  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-3 flex items-center gap-3">
          Bảng Tổng Hợp Công Tháng (Summary)
        </h1>

        {/* User and Month picker */}
        <div className="mb-8 flex flex-wrap items-end gap-6 bg-white p-6 rounded-2xl shadow-lg border border-gray-100">

            {/* Bộ lọc Tổ Chức */}
            <div className="flex flex-col">
                <label htmlFor="organization-select" className="text-sm font-semibold text-gray-700 mb-1">
                    Chọn Tổ Chức
                </label>
                <select
                    id="organization-select"
                    value={selectedOrganizationId}
                    onChange={(e) => setSelectedOrganizationId(e.target.value)}
                    className="w-64 p-3 border border-gray-300 rounded-xl shadow-sm bg-white hover:border-indigo-500 transition duration-150 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isLoadingOrganizations}
                >
                    <option value="">Tất cả Tổ chức</option>
                    {organizations.map((org) => (
                        <option key={org._id} value={org._id}>
                            {org.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Lọc theo Tên Nhân Viên */}
            <div className="flex flex-col">
                <label htmlFor="name-filter-input" className="text-sm font-semibold text-gray-700 mb-1">
                    Tìm Tên Nhân Viên
                </label>
                <input
                    id="name-filter-input"
                    type="text"
                    placeholder="Nhập tên nhân viên..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="w-64 p-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            
            {/* Chọn Nhân Viên (Dropdown) - Đặt dưới tên để dễ quản lý luồng */}
            <div className="flex flex-col">
                <label htmlFor="user-select" className="text-sm font-semibold text-gray-700 mb-1">
                    Chọn Nhân Viên
                </label>
                {isLoadingUsers ? (
                    <div className="w-64 p-3 text-gray-500 bg-gray-100 rounded-xl border border-gray-300 flex items-center justify-center">
                        Đang tải danh sách…
                    </div>
                ) : (
                    <select
                        id="user-select"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="w-64 p-3 border border-gray-300 rounded-xl shadow-sm bg-white hover:border-blue-500 transition duration-150 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">-- Chọn nhân viên --</option>
                        {(filteredUsers || []).map((u) => (
                            <option key={String(u._id)} value={String(u._id)}>
                                {u.fullName}{u.email ? ` — ${u.email}` : ""}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Chọn Tháng */}
            <div className="flex flex-col">
                <label htmlFor="month-picker" className="text-sm font-semibold text-gray-700 mb-1">
                    Chọn Tháng
                </label>
                <input
                    id="month-picker"
                    type="month"
                    value={filterMonth}
                    onChange={handleMonthChange}
                    className="p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    max={currentMonthKey} // Ngăn chọn tháng trong tương lai
                />
            </div>
        </div>

        {/* Content */}
        {!userId ? (
          <div className="p-8 text-center text-gray-600 bg-white rounded-xl shadow-lg border">
            Vui lòng chọn một nhân viên để xem dữ liệu tổng hợp.
          </div>
        ) : (
          <>
            {isLoadingSummary && (
              <div className="flex items-center justify-center p-8 bg-white rounded-xl shadow text-blue-600">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0a12 12 0 100 24v-4z" />
                </svg>
                Đang tổng hợp dữ liệu tháng {filterMonth}…
              </div>
            )}

            {!isLoadingSummary && summaryData && (
              <SummaryDisplay data={summaryData} workRatio={workRatio} user={selectedUser} />
            )}

            {!isLoadingSummary && !summaryData && (
              <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow">
                Không có dữ liệu tổng hợp cho nhân viên này trong tháng {filterMonth}.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Component hiển thị Summary ---
function SummaryDisplay({ data, workRatio, user }: {
  data: AttendanceSummaryInterface,
  workRatio: string | number,
  user?: UserLite
}) {
  const { days, minutes, monthKey } = data;

  // Lấy ngày cuối của tháng để biết tổng số ngày làm việc
  const [y, m] = monthKey.split('-').map(Number);
  const lastDate = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const totalDaysInMonth = lastDate;

  return (
    <div className="bg-white rounded-xl shadow border p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">
        Tổng hợp tháng <span className="text-blue-600">{monthKey}</span>
        {user && <span className="text-lg font-normal text-gray-600 ml-3">({user.fullName})</span>}
      </h2>
      <p className="text-sm text-gray-500">
        Tính toán vào: {new Date(data.computedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })}
      </p>

      {/* Thống kê Tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Tổng ngày đã duyệt" value={days.days} unit={`/${totalDaysInMonth} ngày`} color="text-indigo-600" />
        <StatCard title="Tổng ngày có mặt" value={days.presentDays} unit="ngày" color="text-green-600" />
        <StatCard title="Tỉ lệ Công (theo giờ)" value={workRatio} unit="%" color="text-purple-600" />
      </div>

      <hr className="my-4" />

      {/* Thống kê Chi tiết Ngày */}
      <h3 className="text-xl font-semibold text-gray-700 mb-4">Chi tiết Ngày</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <DetailCard label="Ngày công (tính cả ngày làm nửa ngày) FULL" value={days.fullDays} unit="ngày" />
        <DetailCard label="Ngày công chỉ làm nửa buổi sáng" value={days.halfDaysAM} unit="ngày" />
        <DetailCard label="Ngày công chỉ làm nửa buổi chiều" value={days.halfDaysPM} unit="ngày" />
        <DetailCard label="Ngày Nghỉ full công" value={days.leaveDays} unit="ngày" />
        <DetailCard label="Ngày Vắng mặt" value={days.absentDays} unit="ngày" color="text-red-600" />
        <DetailCard label="Tổng Ngày" value={days.days} unit="ngày" color="text-gray-700" />
      </div>

      <hr className="my-4" />

      {/* Thống kê Chi tiết Giờ/Phút */}
      <h3 className="text-xl font-semibold text-gray-700 mb-4">Chi tiết Giờ (Phút)</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailCard label="Tổng giờ làm hợp lệ" value={minsToHHmm(minutes.worked)} unit="" />
        <DetailCard label="Tổng giờ cần làm" value={minsToHHmm(minutes.hourWork)} unit="" />
        <DetailCard label="Tổng giờ check-in" value={minsToHHmm(minutes.workedCheckIn)} unit="" />
        <DetailCard label="Tổng phút đi muộn" value={minsToHHmm(minutes.late)} unit="" color="text-red-600" />
        <DetailCard label="Tổng phút về sớm" value={minsToHHmm(minutes.earlyLeave)} unit="" color="text-red-600" />
      </div>
    </div>
  );
}

// --- Card Component cho thống kê tổng quan ---
function StatCard({ title, value, unit, color }: { title: string, value: string | number, unit: string, color: string }) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
      <div className="mt-1 flex items-baseline">
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        <p className="ml-2 text-sm font-medium text-gray-500">{unit}</p>
      </div>
    </div>
  );
}

// --- Card Component cho chi tiết ---
function DetailCard({ label, value, unit, color = "text-gray-700" }: { label: string, value: string | number, unit: string, color?: string }) {
  return (
    <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value} <span className="text-sm font-normal text-gray-500">{unit}</span></p>
    </div>
  );
}


// --- Date and Time helpers (sao chép từ page.tsx) ---

function toDateKeyLocal(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d); // YYYY-MM-DD
}

function minsToHHmm(mins?: number) {
  if (mins === undefined || mins === null || isNaN(mins)) return "0:00";
  const abs = Math.abs(mins);
  const sign = mins < 0 ? "-" : "";
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}