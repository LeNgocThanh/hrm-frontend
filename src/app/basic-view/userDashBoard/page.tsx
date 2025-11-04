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
  CalendarX,
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
import { UserProfile, EDUCATION_LEVELS } from "@/types/userProfile";
import { Position } from "@/types/position";

import { getUsers, getUsersUnderOrganizations } from "@/lib/api/users";
import { getUserAssignmentsByUser } from "@/lib/api/user-assignments";
import { getUserDocument } from "@/lib/api/userDocument";
import { getPositions } from "@/lib/api/positions";
import { EDUCATION_LEVELS_VI, EDUCATION_LEVELS_OPTIONS, WORK_TYPE_OPTIONS, workTypeOptions } from "@/i18n/user.vi"

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
  return t.getMonth() === ref.getMonth() 
  //&& t.getFullYear() === ref.getFullYear();
};
const isSameYear = (d?: string | Date | null, ref = new Date()) => {
  if (!isValid(d)) return false;
  const t = typeof d === "string" ? new Date(d) : d!;
  return t.getFullYear() === ref.getFullYear();
};

const prettyLabel = (val?: string | null) => {
  if (!val) return "(Chưa khai báo)";
  // Nếu EDUCATION_LEVELS là enum string -> Object.values sẽ chứa các nhãn hợp lệ
  const all = Object.values(EDUCATION_LEVELS).filter(v => typeof v === "string") as string[];
  if (all.includes(val)) return val;
  // Fallback làm đẹp từ kiểu CODE_CASE -> "Code case"
  return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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
const startOfMonth = (ref = new Date()) => new Date(ref.getFullYear(), ref.getMonth(), 1, 0,0,0,0);
const endOfMonth   = (ref = new Date()) => new Date(ref.getFullYear(), ref.getMonth()+1, 0, 23,59,59,999);


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
          getUsersUnderOrganizations(),
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

  const { resignedMonth, resignedYear } = useMemo(() => {
  const now = new Date();
  const mFrom = startOfMonth(now), mTo = endOfMonth(now);
  const year = now.getFullYear();

  const monthSet = new Set<string>(); // tránh trùng người
  const yearSet  = new Set<string>();

  for (const a of aggs) {
    const pa = a.primaryAssignment;
    if (!pa) continue;

    const inactive = pa.isActive === false;        // người đã nghỉ
    const tOutRaw: any = pa.timeOut ; // phòng hờ tên field
    if (!inactive || !tOutRaw) continue;

    const tOut = new Date(tOutRaw);
    if (isNaN(tOut.getTime())) continue;

    // Nghỉ trong tháng hiện tại (timeOut ∈ [mFrom, mTo])
    if (tOut >= mFrom && tOut <= mTo) monthSet.add(String(a.user._id));

    // Nghỉ trong năm hiện tại
    if (tOut.getFullYear() === year) yearSet.add(String(a.user._id));
  }

  return { resignedMonth: monthSet.size, resignedYear: yearSet.size };
}, [aggs]);

const educationStats = useMemo(() => {
  // Chuẩn hoá danh mục từ enum (chỉ lấy giá trị string)
  const levelValues = (Object.values(EDUCATION_LEVELS).filter(v => typeof v === "string") as string[]);
  const map = new Map<string, number>();

  // Khởi tạo đủ các “xô” theo enum để hiển thị cả những mức chưa có người
  levelValues.forEach(lv => map.set(lv, 0));

  // Thêm “xô” cho trường hợp thiếu/khác
  const OTHER = "(Chưa khai báo)";
  map.set(OTHER, 0);

  for (const a of aggs) {
    const raw = (a.profile as any)?.educationLevel as string | undefined;
    const key = raw && levelValues.includes(raw) ? raw : OTHER;
    map.set(key, (map.get(key) || 0) + 1);
  }

  // Trả về mảng đã sắp xếp giảm dần theo số lượng
  return Array.from(map.entries())
    .map(([name, count]) => ({ name: prettyLabel(name), count }))
    .sort((a, b) => b.count - a.count);
}, [aggs]);

const birthdaysThisMonth = useMemo(() => {
    const now = new Date();
    return users
      .filter(u => isSameMonth(u.birthDay, now))
      .map(u => {
        const d = new Date(u.birthDay as any);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return { id: (u as any)._id, name: u.fullName || (u as any).email || "—", dm: `${dd}/${mm}`, day: d.getDate() };
      })
      .sort((a, b) => a.day - b.day);
  }, [users]);

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

  // Define color palette for charts
  const barColors = ["#4338ca", "#a5b4fc", "#c7d2fe", "#e0e7ff", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8", "#2563eb", "#1e40af", "#3730a3", "#4f46e5"];
  const pieColors = ["#0e7490", "#22d3ee", "#67e8f9", "#06b6d4", "#0891b2", "#164e63"];
  
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tổng quan nhân sự</h1>
        <p className="mt-2 text-gray-600">Tổng quan theo hồ sơ, tình trạng làm việc và phân bổ chức vụ.</p>
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
        <Card
    title="Nghỉ trong tháng"
    value={resignedMonth}    
    icon={<CalendarX className="h-5 w-5 text-rose-700" />}
  />
  <Card
    title="Nghỉ trong năm"
    value={resignedYear}
    subtitle={`Năm ${new Date().getFullYear()}`}
    icon={<Briefcase className="h-5 w-5 text-amber-700" />}
  />
        <div className="sm:col-span-2" />
      </div>

      {/* Positions distribution */}
      {birthdaysThisMonth.length > 0 && (
  <Section title="Sinh nhật trong tháng">
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {birthdaysThisMonth.map(b => (
        <li key={b.id} className="flex items-center justify-between rounded-lg border p-3">
          <span className="font-medium truncate">{b.name}</span>
          <span className="rounded bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700">{b.dm}</span>
        </li>
      ))}
    </ul>
  </Section>
)}
      <Section title="Phân bổ theo chức vụ">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionStats.slice(0, 12)} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#4f46e5" activeBar={{ fill: "#6366f1", stroke: "#4f46e5" }} />
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

      <Section title="Phân bổ theo trình độ học vấn">
  <div className="grid gap-6 lg:grid-cols-5">   
    <div className="lg:col-span-3 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={educationStats} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#4f46e5" activeBar={{ fill: "#6366f1", stroke: "#4f46e5" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
   
    <div className="lg:col-span-2">
      <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trình độ</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {educationStats.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-2 text-sm text-gray-800">{EDUCATION_LEVELS_OPTIONS.find(option => option.value === r.name)?.label}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-800">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</Section>
     
      <Section title="Hình thức làm việc (workType)">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={workTypeStats} dataKey="count" nameKey="type" outerRadius={110} innerRadius={50} paddingAngle={4} animationDuration={500}>
                  {workTypeStats.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2">
            <ul className="space-y-2">
              {workTypeStats.map((w, i) => (
                <li key={w.type} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2">
                  <span className="text-sm text-gray-700" style={{ color: pieColors[i % pieColors.length] }}>{WORK_TYPE_OPTIONS.find(option => option.value === w.type)?.label || "unknown"}</span>
                  <span className="text-sm font-semibold text-gray-900">{w.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
   
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