"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  UserCheck,
  UserX,
  HeartHandshake,
  FileWarning,
  CalendarClock,
  Baby,
  Briefcase,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ==== Types & APIs (reuse your existing codebase) ====
import { User } from "@/types";
import { UserAssignment } from "@/types/user-assignment";
import { UserDocumentResponse, DocTypeEnum } from "@/types/userDocument";
import { UserProfile } from "@/types/userProfile";
import { Position } from "@/types/position";

import { getUsers } from "@/lib/api/users";
import { getUserAssignmentsByUser } from "@/lib/api/user-assignments";
import { getUserDocument } from "@/lib/api/userDocument";
import { getPositions } from "@/lib/api/positions";

// ==== Small helpers ====
const isValid = (d?: string | Date | null) => {
  if (!d) return false;
  const dt = typeof d === "string" ? new Date(d) : d;
  return !isNaN(dt.getTime());
};

const getAge = (dob?: string | Date | null) => {
  if (!isValid(dob)) return null;
  const dt = typeof dob === "string" ? new Date(dob) : dob!;
  const now = new Date();
  let age = now.getFullYear() - dt.getFullYear();
  const m = now.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--;
  return age;
};

const isSameMonth = (d?: string | Date | null, ref = new Date()) => {
  if (!isValid(d)) return false;
  const t = typeof d === "string" ? new Date(d) : d!;
  return t.getMonth() === ref.getMonth() && t.getFullYear() === ref.getFullYear();
};
const isSameYear = (d?: string | Date | null, ref = new Date()) => {
  if (!isValid(d)) return false;
  const t = typeof d === "string" ? new Date(d) : d!;
  return t.getFullYear() === ref.getFullYear();
};

// Consolidated shape per USER (not per-assignment)
interface UserAgg {
  user: User;
  profile: UserProfile | null;
  primaryAssignment: UserAssignment | null;
  positionName: string;
  workType: string; // e.g. 'fullTime' | 'partTime' | ...
  docs: {
    CV: boolean;
    PHOTO: boolean;
    DEGREE: boolean;
    HEALTH_CHECK: boolean;
    IDENTIFICATION: boolean;
  };
}

// ========= Pretty UI bits =========
const Card: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, value, subtitle, icon, className }) => (
  <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className || ""}`}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="mt-1 text-3xl font-semibold text-gray-900">{value}</div>
        {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
      </div>
      {icon && <div className="rounded-xl bg-gray-50 p-3">{icon}</div>}
    </div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }>= ({ title, children, right }) => (
  <section className="mt-8">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {right}
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">{children}</div>
  </section>
);

// ========= Main Component =========
const HRUsersDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [aggs, setAggs] = useState<UserAgg[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [usersData, positionsData] = await Promise.all([
          getUsers(),
          getPositions(),
        ]);

        const nextAggs: UserAgg[] = [];

        for (const u of usersData) {
          let assigns: UserAssignment[] = [];
          let docs: UserDocumentResponse[] = [];
          let profile: UserProfile | null = null;
          try { assigns = await getUserAssignmentsByUser(u._id); } catch {}
          try { docs = await getUserDocument(u._id); } catch {}
          try { profile = await (await import("@/lib/api/userProfile")).getUserProfile(u._id); } catch {}

          const primary = assigns.find(a => a.isPrimary) || assigns[0] || null;
          const posId = primary ? (typeof primary.positionId === "string" ? primary.positionId : (primary.positionId as any)?._id) : undefined;
          const posName = posId ? (positionsData.find(p => p._id === posId)?.name || "") : "";

          const had = (t: DocTypeEnum) => docs?.some(d => d.docType === t) || false;

          nextAggs.push({
            user: u,
            profile,
            primaryAssignment: primary,
            positionName: posName || "(Chưa gán chức vụ)",
            workType: (primary?.workType as any) || "unknown",
            docs: {
              CV: had(DocTypeEnum.CV),
              PHOTO: had(DocTypeEnum.PHOTO),
              DEGREE: had(DocTypeEnum.DEGREE),
              HEALTH_CHECK: had(DocTypeEnum.HEALTH_CHECK),
              IDENTIFICATION: had(DocTypeEnum.IDENTIFICATION),
            },
          });
        }

        setUsers(usersData);
        setPositions(positionsData);
        setAggs(nextAggs);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // ===== Derived metrics =====
  const {
    totalUsers,
    activeCount,
    inactiveCount,
    maleCount,
    femaleCount,
    marriedCount,
    avgAge,
    joinedThisMonth,
    joinedThisYear,
    missingDocsCount,
    positionStats,
    workTypeStats,
    missingList,
  } = useMemo(() => {
    const totalUsers = users.length;

    // Active/inactive by PRIMARY assignment if present
    let activeCount = 0, inactiveCount = 0;
    let maleCount = 0, femaleCount = 0;
    let marriedCount = 0;
    const ages: number[] = [];

    let joinedThisMonth = 0, joinedThisYear = 0;

    let missingDocsCount = 0;
    const missingList: { name: string; why: string[] }[] = [];

    const positionMap = new Map<string, number>();
    const workTypeMap = new Map<string, number>();

    for (const a of aggs) {
      // status
      if (a.primaryAssignment?.isActive) activeCount++; else inactiveCount++;

      // gender
      if (a.user.gender === "Nam") maleCount++;
      else if (a.user.gender === "Nữ") femaleCount++;

      // marital
      if (a.profile?.maritalStatus === "married") marriedCount++;

      // age
      const age = getAge(a.user.birthDay);
      if (age != null) ages.push(age);

      // newcomers
      const tIn = a.primaryAssignment?.timeIn;
      if (isSameMonth(tIn)) joinedThisMonth++;
      if (isSameYear(tIn)) joinedThisYear++;

      // missing docs (any missing among 5 required)
      const lacks: string[] = [];
      if (!a.docs.CV) lacks.push("CV");
      if (!a.docs.PHOTO) lacks.push("Ảnh");
      if (!a.docs.DEGREE) lacks.push("Bằng cấp");
      if (!a.docs.HEALTH_CHECK) lacks.push("Giấy KSK");
      if (!a.docs.IDENTIFICATION) lacks.push("CCCD sao y");
      if (lacks.length > 0) {
        missingDocsCount++;
        missingList.push({ name: a.user.fullName || a.user.email || "(no name)", why: lacks });
      }

      // position & workType stats
      const pn = a.positionName || "(Khác)";
      positionMap.set(pn, (positionMap.get(pn) || 0) + 1);

      const wt = a.workType || "unknown";
      workTypeMap.set(wt, (workTypeMap.get(wt) || 0) + 1);
    }

    const avgAge = ages.length ? (ages.reduce((s, v) => s + v, 0) / ages.length) : null;

    const positionStats = Array.from(positionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const workTypeStats = Array.from(workTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalUsers,
      activeCount,
      inactiveCount,
      maleCount,
      femaleCount,
      marriedCount,
      avgAge,
      joinedThisMonth,
      joinedThisYear,
      missingDocsCount,
      positionStats,
      workTypeStats,
      missingList: missingList.slice(0, 12), // show top 12
    };
  }, [aggs, users.length]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Đang tải dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard nhân sự</h1>
        <p className="mt-2 text-gray-600">Tổng quan workforce theo hồ sơ, tình trạng làm việc và phân bổ chức vụ.</p>
      </header>

      {/* Top KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Tổng nhân sự" value={totalUsers} icon={<UsersIcon className="h-5 w-5 text-gray-700" />} />
        <Card title="Đang làm" value={activeCount} subtitle="(theo vai trò chính)" icon={<UserCheck className="h-5 w-5 text-green-700" />} />
        <Card title="Đã nghỉ" value={inactiveCount} subtitle="(theo vai trò chính)" icon={<UserX className="h-5 w-5 text-red-700" />} />
        <Card title="Đã kết hôn" value={marriedCount} icon={<HeartHandshake className="h-5 w-5 text-rose-700" />} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Nam" value={maleCount} icon={<Baby className="h-5 w-5 text-blue-700" />} />
        <Card title="Nữ" value={femaleCount} icon={<Baby className="h-5 w-5 text-pink-700" />} />
        <Card title="Tuổi TB" value={avgAge == null ? "—" : avgAge.toFixed(1)} icon={<CalendarClock className="h-5 w-5 text-indigo-700" />} />
        <Card title="Thiếu hồ sơ" value={missingDocsCount} subtitle="CV/Ảnh/Bằng cấp/KSK/CCCD" icon={<FileWarning className="h-5 w-5 text-amber-700" />} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Mới vào tháng này" value={joinedThisMonth} icon={<Briefcase className="h-5 w-5 text-emerald-700" />} />
        <Card title="Mới vào năm nay" value={joinedThisYear} icon={<Briefcase className="h-5 w-5 text-teal-700" />} />
        <div className="sm:col-span-2" />
      </div>

      {/* Positions distribution */}
      <Section title="Phân bổ theo chức vụ">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionStats.slice(0, 12)} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2">
            <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chức vụ</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {positionStats.map((r) => (
                    <tr key={r.name}>
                      <td className="px-4 py-2 text-sm text-gray-800">{r.name}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-800">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* Work type distribution */}
      <Section title="Hình thức làm việc (workType)">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={workTypeStats} dataKey="count" nameKey="type" outerRadius={110} innerRadius={50} paddingAngle={4}>
                  {workTypeStats.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2">
            <ul className="space-y-2">
              {workTypeStats.map((w) => (
                <li key={w.type} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2">
                  <span className="text-sm text-gray-700">{w.type || "unknown"}</span>
                  <span className="text-sm font-semibold text-gray-900">{w.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Missing dossier quick list */}
      <Section title="Danh sách thiếu hồ sơ (top 12)">
        {missingList.length === 0 ? (
          <div className="text-gray-600">Tất cả đã đủ hồ sơ!</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ tên</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {missingList.map((m, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-800">{m.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">{m.why.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <footer className="mt-10 text-xs text-gray-400">
        <p>
          * Ghi chú: các thống kê dựa trên <span className="font-medium">vai trò chính (isPrimary)</span> của mỗi nhân sự khi có nhiều phân công. ()          
        </p>
      </footer>
    </div>
  );
};

export default HRUsersDashboard;
