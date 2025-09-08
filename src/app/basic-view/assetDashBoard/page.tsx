"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Package2 as AssetIcon,
  Files as FilesIcon,
  FileWarning,
  BadgeCheck,
  ClipboardList,
  Users as UsersIcon,
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

// ====== Vivid palette for charts ======
const CHART_COLORS = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#10b981",
  "#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1","#8b5cf6",
  "#a855f7","#d946ef","#ec4899","#f43f5e"
];

// ==== Domain types & APIs (khớp code sẵn có của bạn) ====
import {
  Asset,
  AssetStatus,
  AssetType,
  AssetDocument,
} from "@/types/asset";
import { User } from "@/types";
import {
  listAssets,
  listAssetDocuments,
  listUsers,
} from "@/lib/api/asset";

// ===== Nhãn tiếng Việt cho enum (frontend only) =====
const ASSET_TYPE_LABELS: Record<string, string> = {
  VEHICLE: "Phương tiện",
  FURNITURE: "Nội thất",
  ELECTRONIC: "Đồ điện tử",
  EQUIPMENT: "Công cụ",
  TOOL: "Dụng cụ",
  OTHER: "Khác",
};
const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "Trong kho",
  ASSIGNED: "Đang sử dụng",
  IN_REPAIR: "Đang sửa chữa",
  REPAIRING: "Đang sửa",
  LOST: "Mất",
  DISPOSED: "Đã thanh lý",
};
const labelAssetType = (v?: string) => (v ? ASSET_TYPE_LABELS[v] ?? v : "");
const labelAssetStatus = (v?: string) => (v ? STATUS_LABELS[v] ?? v : "");

// ===== Helpers =====
function deriveFullName(u: any): string {
  let name = u?.fullName || u?.name || u?.profile?.fullName || u?.profile?.displayName || u?.profile?.name;
  if (!name && u?.email) {
    const local = String(u.email).split("@")[0].replace(/[._-]+/g, " ");
    const parts = local.split(" ").filter(Boolean);
    name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return name || String(u?._id || "");
}

function normalizeUsers(arr: any[]): (User & { fullName: string })[] {
  return (arr || []).map((u: any) => ({
    ...u,
    _id: String(u?._id ?? u?.id ?? ""),
    fullName: deriveFullName(u),
  }));
}

// Concurrency helper (giới hạn song song khi tải hồ sơ cho từng tài sản)
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let i = 0;
  const running: Promise<void>[] = [];
  async function runOne(idx: number) {
    const r = await worker(items[idx], idx);
    results[idx] = r;
  }
  while (i < items.length || running.length) {
    while (i < items.length && running.length < limit) {
      const idx = i++;
      const p = runOne(idx).finally(() => {
        const pos = running.indexOf(p as any);
        if (pos >= 0) running.splice(pos, 1);
      });
      running.push(p as any);
    }
    // eslint-disable-next-line no-await-in-loop
    await Promise.race(running).catch(() => {});
  }
  return results;
}

// ====== UI atomics ======
const Card: React.FC<{ title: string; value: string | number; subtitle?: string; icon?: React.ReactNode; className?: string }> = ({ title, value, subtitle, icon, className }) => (
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

const Section: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <section className="mt-8">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {right}
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">{children}</div>
  </section>
);

// ===== Main component =====
const AssetsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<(User & { fullName: string })[]>([]);
  const [hasDocsMap, setHasDocsMap] = useState<Record<string, boolean>>({});

  // Load all data (paging qua API listAssets)
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // 1) Users for holder mapping
        const u = await listUsers().catch(() => []);
        setUsers(normalizeUsers(u || []));

        // 2) Assets — gom đủ các trang (giới hạn bảo vệ 5000)
        const LIMIT = 500;
        let page = 1;
        let all: Asset[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const res = await listAssets({ page, limit: LIMIT });
          const chunk: Asset[] = res?.assets || [];
          all = all.concat(chunk);
          const total: number = res?.total ?? all.length;
          if (!chunk.length || all.length >= total || all.length >= 5000) break;
          page += 1;
        }
        setAssets(all);

        // 3) Documents presence — chỉ cần có/không (giới hạn song song 10)
        const docsPresence = await mapWithConcurrency(all, 10, async (a) => {
          if (!a?._id) return false;
          try {
            const docs: AssetDocument[] | undefined = await listAssetDocuments(a._id);
            return (docs?.length || 0) > 0;
          } catch {
            return false;
          }
        });
        const m: Record<string, boolean> = {};
        all.forEach((a, i) => { if (a?._id) m[a._id] = !!docsPresence[i]; });
        setHasDocsMap(m);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const usersMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(String(u._id), u.fullName);
    return m;
  }, [users]);

  // ===== Derived metrics =====
  const {
    totalAssets,
    byType,
    byStatus,
    hasDocsCount,
    noDocsCount,
    distinctHolders,
    topHoldersByQty,
    topHoldersByTypes,
  } = useMemo(() => {
    const totalAssets = assets.length;

    const typeMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    const holderQty = new Map<string, number>(); // tổng số tài sản theo người giữ
    const holderTypes = new Map<string, Set<string>>(); // số loại tài sản khác nhau theo người giữ

    let hasDocsCount = 0;

    for (const a of assets) {
      // type/status
      const tKey = a.type || "OTHER";
      const sKey = a.status || "IN_STOCK";
      typeMap.set(tKey, (typeMap.get(tKey) || 0) + 1);
      statusMap.set(sKey, (statusMap.get(sKey) || 0) + 1);

      // docs presence
      if (a._id && hasDocsMap[a._id]) hasDocsCount++;

      // holder
      const holder = a.currentHolderId ? String(a.currentHolderId) : "";
      if (holder) {
        holderQty.set(holder, (holderQty.get(holder) || 0) + 1);
        if (!holderTypes.has(holder)) holderTypes.set(holder, new Set());
        holderTypes.get(holder)!.add(tKey as string);
      }
    }

    const noDocsCount = totalAssets - hasDocsCount;

    const byType = Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, label: labelAssetType(type), count }))
      .sort((a, b) => b.count - a.count);

    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, label: labelAssetStatus(status), count }))
      .sort((a, b) => b.count - a.count);

    const distinctHolders = holderQty.size;

    const topHoldersByQty = Array.from(holderQty.entries())
      .map(([holderId, count]) => ({ holderId, name: usersMap.get(holderId) || holderId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topHoldersByTypes = Array.from(holderTypes.entries())
      .map(([holderId, set]) => ({ holderId, name: usersMap.get(holderId) || holderId, types: set.size }))
      .sort((a, b) => b.types - a.types)
      .slice(0, 10);

    return { totalAssets, byType, byStatus, hasDocsCount, noDocsCount, distinctHolders, topHoldersByQty, topHoldersByTypes };
  }, [assets, hasDocsMap, usersMap]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Đang tải Asset Dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard tài sản</h1>
        <p className="mt-2 text-gray-600">Bức tranh tổng quan: số lượng, trạng thái, hồ sơ, và người nắm giữ nổi bật.</p>
      </header>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Tổng tài sản" value={totalAssets} icon={<AssetIcon className="h-5 w-5 text-gray-700" />} />
        <Card title="Có hồ sơ" value={hasDocsCount} subtitle="(ít nhất 1 văn bản)" icon={<FilesIcon className="h-5 w-5 text-indigo-700" />} />
        <Card title="Chưa có hồ sơ" value={noDocsCount} icon={<FileWarning className="h-5 w-5 text-amber-700" />} />
        <Card title="Số người đang giữ" value={distinctHolders} icon={<UsersIcon className="h-5 w-5 text-emerald-700" />} />
      </div>

      {/* By Type */}
      <Section title="Phân bổ theo loại tài sản">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
  {(Array.isArray(byType) ? byType : byStatus).map((_: any, i: number) => (
    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
  ))}
</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* By Status + Doc coverage */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Theo trạng thái">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
  {(Array.isArray(byType) ? byType : byStatus).map((_: any, i: number) => (
    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
  ))}
</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Bao phủ hồ sơ" right={<span className="text-xs text-gray-500">(có ≥ 1 hồ sơ)</span>}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: "Có hồ sơ", value: hasDocsCount }, { name: "Chưa có", value: noDocsCount }]} dataKey="value" nameKey="name" outerRadius={110} innerRadius={50} paddingAngle={4}>
                  {[0, 1].map((i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Top holders */}
      <Section title="Người nắm giữ nhiều tài sản nhất (số lượng)">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Người giữ</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Số tài sản</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {topHoldersByQty.map((r, idx) => (
                <tr key={r.holderId}>
                  <td className="px-4 py-2 text-sm text-gray-800">{idx + 1}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{r.name}</td>
                  <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">{r.count}</td>
                </tr>
              ))}
              {!topHoldersByQty.length && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Người nắm giữ nhiều LOẠI tài sản nhất (phân loại khác nhau)">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Người giữ</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Số LOẠI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {topHoldersByTypes.map((r, idx) => (
                <tr key={r.holderId}>
                  <td className="px-4 py-2 text-sm text-gray-800">{idx + 1}</td>
                  <td className="px-4 py-2 text-sm text-gray-800">{r.name}</td>
                  <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">{r.types}</td>
                </tr>
              ))}
              {!topHoldersByTypes.length && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <footer className="mt-10 text-xs text-gray-400 space-y-1">
        <p>* Số liệu "có hồ sơ" kiểm tra qua API listAssetDocuments cho từng tài sản (đếm ≥ 1 văn bản). Có thể tối ưu bằng endpoint tổng hợp ở backend nếu cần.</p>
        <p>* "Người nắm giữ nhiều LOẠI" tính theo số loại tài sản khác nhau (VEHICLE/FURNITURE/…). Nếu bạn muốn so theo nhóm lớn khác, mình sẽ map lại enum.</p>
      </footer>
    </div>
  );
};

export default AssetsDashboard;
