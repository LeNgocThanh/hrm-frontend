"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Asset,
  AssetStatus,
  AssetType,
  AssetEventType,
  AssetDocType,
  AssetDocument,
  AssetEvent,
  AssetMetadata,
} from '@/types/asset';
import { User } from '@/types/index';
import {
  listAssets,
  listAssetEvents,
  listAssetDocuments,
  listUsers,
  buildFileUrl,
  // NEW: org-related APIs
  listOrganizations,
  listUsersInOrganization,
} from '@/lib/api/asset';
import {format} from 'date-fns';

// Minimal organization type (match your backend shape if already exported elsewhere)
interface Organization { _id: string; name?: string }

// ===== VIETNAMESE LABELS (frontend only) =====
const DOC_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Mua',
  WARRANTY: 'Bảo hành',
  MAINTENANCE: 'Bảo trì',
  LIQUIDATION: 'Thanh lý',
  HANDOVER: 'Bàn giao',
  ACCEPTANCE: 'Tiếp nhận',
  REPAIR: 'Sửa chữa',
  TRANSFER: 'Chuyển giao',
  OTHER: 'Khác',
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Mua',
  ASSIGN: 'Giao tài sản',
  TRANSFER: 'Chuyển giao',
  RETURN: 'Hoàn trả',
  REPAIR: 'Sửa chữa',
  LOSS: 'Mất',
  FOUND: 'Tìm thấy',
  DISPOSE: 'Thanh lý',
  OTHER: 'Khác',
};
const ASSET_TYPE_LABELS: Record<string, string> = {  
  VEHICLE: 'Phương tiện',
  FURNITURE: 'Nội thất',
  ELECTRONIC: 'Đồ điện tử',
  EQUIPMENT: 'Công cụ',
  TOOL: 'Dụng cụ',
  OTHER: 'Khác',
};
const STATUS_LABELS: Record<string, string> = {
  IN_STOCK: 'Trong kho',
  ASSIGNED: 'Đang sử dụng',
  IN_REPAIR: 'Đang sửa chữa',
  REPAIRING: 'Đang sửa',
  LOST: 'Mất',
  DISPOSED: 'Đã thanh lý',
};
const labelDocType = (v?: string) => (v ? (DOC_TYPE_LABELS[v] ?? v) : '');
const labelEventType = (v?: string) => (v ? (EVENT_TYPE_LABELS[v] ?? v) : '');
const labelAssetType = (v?: string) => (v ? (ASSET_TYPE_LABELS[v] ?? v) : '');
const labelAssetStatus = (v?: string) => (v ? (STATUS_LABELS[v] ?? v) : '');

// ===== Types =====
interface AdvancedFilter {
  q: string;
  type: AssetType | '';
  status: AssetStatus | '';
  holderId: string;           // one
  orgId: string;              // NEW: selected organization
  purchasedFrom?: string;     // YYYY-MM-DD
  purchasedTo?: string;       // YYYY-MM-DD
  hasDocuments?: boolean;     // only assets that have docs
  docType: AssetDocType | '';
  eventType: AssetEventType | '';
  metadataKey?: string;       // contains key
  metadataValue?: string;     // value includes
}

const DEFAULT_FILTER: AdvancedFilter = {
  q: '',
  type: '',
  status: '',
  holderId: '',
  orgId: '',
  purchasedFrom: undefined,
  purchasedTo: undefined,
  hasDocuments: undefined,
  docType: '',
  eventType: '',
  metadataKey: '',
  metadataValue: '',
};

// ===== Helpers =====
function normalize(str?: string) {
  return (str || '').toLowerCase();
}

// Prefer a friendly label for User objects coming from different payload shapes
// Always derive a fullName for consistent display
function deriveFullName(u: any): string {
  let name = u?.fullName || u?.name || u?.profile?.fullName || u?.profile?.displayName || u?.profile?.name;
  if (!name && u?.email) {
    const local = String(u.email).split('@')[0].replace(/[._-]+/g, ' ');
    const parts = local.split(' ').filter(Boolean);
    name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  return name || String(u?._id || '');
}

function normalizeUsers(arr: any[]): any[] {
  return (arr || []).map((u: any) => ({
    ...u,
    _id: String(u?._id ?? u?.id ?? ''),
    fullName: deriveFullName(u),
  }));
}

function matchMetadata(meta: AssetMetadata | undefined, key?: string, value?: string) {
  if (!meta) return false;
  const k = normalize(key);
  const v = normalize(value);
  const entries = Object.entries(meta);
  const keyOk = !k || entries.some(([mk]) => normalize(mk).includes(k));
  const valOk = !v || entries.some(([, mv]) => normalize(String(mv)).includes(v));
  return keyOk && valOk;
}

// ===== Component =====
export default function AssetAdvancedSearch() {
  // Orgs & Users (dependent)
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const usersMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users as any[]) {
      const id = String((u as any)._id);
      const label = (u as any).fullName as string;
      if (id) m.set(id, label);
    }
    return m;
  }, [users]);

  const [filter, setFilter] = useState<AdvancedFilter>(DEFAULT_FILTER);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [showFilters, setShowFilters] = useState(true);

  // Expand state & caches
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [eventsByAsset, setEventsByAsset] = useState<Record<string, AssetEvent[]>>({});
  const [docsByAsset, setDocsByAsset] = useState<Record<string, AssetDocument[]>>({});
  const [loadingEv, setLoadingEv] = useState<Record<string, boolean>>({});
  const [loadingDoc, setLoadingDoc] = useState<Record<string, boolean>>({});

  // Load organizations on first mount
  useEffect(() => {
    (async () => {
      try {
        const o = await listOrganizations();
        setOrgs(o || []);
      } catch (e) {
        console.warn('Load orgs failed', e);
        setOrgs([]);
      }
    })();
  }, []);

  // Load users — depends on org selection
  useEffect(() => {
    (async () => {
      try {
        if (filter.orgId) {
          const u = await listUsersInOrganization(filter.orgId);
          setUsers(normalizeUsers(u || []));
          // If current holder is not in org anymore, clear it
          if (u && !u.find(x => x._id === filter.holderId)) {
            setFilter(prev => ({ ...prev, holderId: '' }));
          }
        } else {
          const u = await listUsers();
          setUsers(normalizeUsers(u || []));
        }
      } catch (e) {
        console.warn('Load users failed', e);
        setUsers([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.orgId]);

  // Fetch assets (server-side basic filters) then client-side for metadata/org/holder
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await listAssets({
          search: filter.q || undefined,
          type: filter.type || undefined,
          status: filter.status || undefined,
          page,
          limit,
        });
        let list: Asset[] = res.assets || [];

        // Filter by holder
        if (filter.holderId) list = list.filter(a => a.currentHolderId === filter.holderId);

        // Filter by org — any asset whose holder is a user in the selected org
        if (filter.orgId) {
          const userIds = new Set(users.map(u => u._id));
          list = list.filter(a => (a.currentHolderId ? userIds.has(a.currentHolderId) : false));
        }

        if (filter.purchasedFrom) list = list.filter(a => (a.purchaseDate || '') >= filter.purchasedFrom!);
        if (filter.purchasedTo) list = list.filter(a => (a.purchaseDate || '') <= filter.purchasedTo!);
        if (filter.metadataKey || filter.metadataValue) list = list.filter(a => matchMetadata(a.metadata, filter.metadataKey, filter.metadataValue));

        setAssets(list);
        setTotal(res.total ?? list.length);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filter.q, filter.type, filter.status, filter.holderId, filter.orgId, filter.purchasedFrom, filter.purchasedTo, filter.metadataKey, filter.metadataValue, users]);

  async function toggleExpand(id: string) {
    const willOpen = !expanded[id];
    setExpanded(prev => ({ ...prev, [id]: willOpen }));
    if (willOpen) {
      if (!eventsByAsset[id] && !loadingEv[id]) {
        try {
          setLoadingEv(prev => ({ ...prev, [id]: true }));
          const ev = await listAssetEvents(id);
          setEventsByAsset(prev => ({ ...prev, [id]: ev || [] }));
        } finally { setLoadingEv(prev => ({ ...prev, [id]: false })); }
      }
      if (!docsByAsset[id] && !loadingDoc[id]) {
        try {
          setLoadingDoc(prev => ({ ...prev, [id]: true }));
          const docs = await listAssetDocuments(id);
          setDocsByAsset(prev => ({ ...prev, [id]: docs || [] }));
        } finally { setLoadingDoc(prev => ({ ...prev, [id]: false })); }
      }
    }
  }

  // Advanced enrichment for hasDocuments / docType / eventType, plus org filter
  async function applyAdvancedFilters() {
    setLoading(true);
    try {
      const res = await listAssets({
        search: filter.q || undefined,
        type: filter.type || undefined,
        status: filter.status || undefined,
        page: 1,
        limit: 500,
      });
      let list: Asset[] = res.assets || [];

      if (filter.holderId) list = list.filter(a => a.currentHolderId === filter.holderId);

      if (filter.orgId) {
        // Ensure users for org are loaded (in case user clicked very fast)
        let orgUsers = users;
        if (!users?.length) {
          try { orgUsers = await listUsersInOrganization(filter.orgId); } catch {}
        }
        const userIds = new Set((orgUsers || []).map(u => u._id));
        list = list.filter(a => (a.currentHolderId ? userIds.has(a.currentHolderId) : false));
      }

      if (filter.purchasedFrom) list = list.filter(a => (a.purchaseDate || '') >= filter.purchasedFrom!);
      if (filter.purchasedTo) list = list.filter(a => (a.purchaseDate || '') <= filter.purchasedTo!);
      if (filter.metadataKey || filter.metadataValue) list = list.filter(a => matchMetadata(a.metadata, filter.metadataKey, filter.metadataValue));

      if (filter.hasDocuments !== undefined || filter.docType || filter.eventType) {
        const enriched: Asset[] = [];
        for (const a of list) {
          const [ev, docs] = await Promise.all([listAssetEvents(a._id!), listAssetDocuments(a._id!)]);
          const hasDocs = (docs?.length || 0) > 0;
          const docTypeOk = !filter.docType || (docs || []).some(d => d.type === filter.docType);
          const evTypeOk  = !filter.eventType || (ev || []).some(e => e.type === filter.eventType);
          const hasDocsOk = filter.hasDocuments === undefined ? true : (filter.hasDocuments ? hasDocs : !hasDocs);
          if (hasDocsOk && docTypeOk && evTypeOk) enriched.push(a);
          setDocsByAsset(prev => ({ ...prev, [a._id!]: docs || [] }));
          setEventsByAsset(prev => ({ ...prev, [a._id!]: ev || [] }));
        }
        list = enriched;
      }
      setPage(1);
      setAssets(list);
      setTotal(list.length);
    } finally { setLoading(false); }
  }

  // ===== UI pieces =====
  function FilterPill({ children, onClear }: { children: React.ReactNode; onClear?: () => void }) {
    return (
      <span className="inline-flex items-center gap-2 text-xs bg-gray-100 border rounded-full px-3 py-1 min-w-0">
        <span className="truncate">{children}</span>
        {onClear && (
          <button type="button" className="text-gray-500 hover:text-gray-700" onClick={onClear} aria-label="clear">×</button>
        )}
      </span>
    );
  }

  // Chuẩn hoá nhãn nhanh cho Excel/Print
function fmtDate(d?: string) {
  return d ? format(new Date(d), 'dd/MM/yyyy') : '';
}
function holderNameById(id?: string) {
  return id ? (usersMap.get(id) ?? id) : '';
}

// Gộp mô tả bộ lọc cho Excel (sheet "BoLoc")
function describeFilters() {
  const getOrgName = () => (orgs.find(o => o._id === filter.orgId)?.name) || filter.orgId || '';
  return [
    ['Từ khóa', filter.q || ''],
    ['Loại', filter.type ? labelAssetType(filter.type) : ''],
    ['Trạng thái', filter.status ? labelAssetStatus(filter.status) : ''],
    ['Tổ chức', filter.orgId ? getOrgName() : ''],
    ['Người giữ', filter.holderId ? (usersMap.get(filter.holderId) || filter.holderId) : ''],
    ['Ngày mua từ', filter.purchasedFrom || ''],
    ['Ngày mua đến', filter.purchasedTo || ''],
    ['Chỉ tài sản có hồ sơ', filter.hasDocuments ? 'Có' : (filter.hasDocuments === false ? 'Không' : '')],
    ['Loại hồ sơ', filter.docType ? labelDocType(filter.docType) : ''],
    ['Loại sự kiện', filter.eventType ? labelEventType(filter.eventType) : ''],
    ['Metadata key', filter.metadataKey || ''],
    ['Metadata value', filter.metadataValue || ''],
  ];
}

// 1) Export Excel theo đúng kết quả sau khi lọc (giao diện đang hiển thị)
async function handleExportExcel() {
  const XLSX = await import('xlsx');

  // Dữ liệu chính: thêm cột Số TT ở đầu; bỏ checklist & phần ký (chỉ dành cho bản in)
  const rows = assets.map((a, idx) => ({
    'Số TT': idx + 1,
    'Mã': a.code || '',
    'Tên': a.name || '',
    'Loại': labelAssetType(a.type as any),
    'Người giữ': holderNameById(a.currentHolderId),
    'Trạng thái': labelAssetStatus(a.status as any),
    'Ngày mua': fmtDate(a.purchaseDate),
  }));

  const wb = XLSX.utils.book_new();

  // Sheet 1: Kết quả
  const ws1 = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws1, 'KetQua');

  // Sheet 2: Bộ lọc
  const ws2 = XLSX.utils.aoa_to_sheet([['Bộ lọc', 'Giá trị'], ...describeFilters()]);
  XLSX.utils.book_append_sheet(wb, ws2, 'BoLoc');

  const fileName = `kiemke_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// 2) In kiểm kê: bảng có Số TT + Checklist + khu vực ký
function handlePrintInventory() {
  const w = window.open('', '_blank', 'width=1024,height=768');
  if (!w) return;

  const title = 'Biểu kiểm kê tài sản';
  const today = format(new Date(), 'dd/MM/yyyy');

  const tableRows = assets.map((a, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${a.code || ''}</td>
      <td>${a.name || ''}</td>
      <td>${labelAssetType(a.type as any)}</td>
      <td>${holderNameById(a.currentHolderId)}</td>
      <td>${labelAssetStatus(a.status as any)}</td>
      <td>${fmtDate(a.purchaseDate)}</td>
      <td style="text-align:center;"><input type="checkbox" /></td>
    </tr>
  `).join('');

  // Tóm tắt bộ lọc hiển thị trên đầu trang in
  const filterSummary = describeFilters()
    .filter(([_, v]) => String(v).trim() !== '')
    .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
    .join('');

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @media print {
      @page { margin: 16mm; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    .signature { margin-top: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .sig-box { text-align: center; }
    .sig-role { font-weight: 600; margin-bottom: 40px; }
    .sig-name { border-top: 1px dashed #aaa; padding-top: 6px; min-height: 20px; }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right; margin-bottom:10px;">
    <button onclick="window.print()">In</button>
    <button onclick="window.close()">Đóng</button>
  </div>

  <h1>${title}</h1>
  <div class="meta">
    <div><strong>Ngày in:</strong> ${today}</div>
    ${filterSummary ? `<div style="margin-top:6px;"><strong>Bộ lọc áp dụng:</strong><br>${filterSummary}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:50px; text-align:center;">Số TT</th>
        <th>Mã</th>
        <th>Tên</th>
        <th>Loại</th>
        <th>Người giữ</th>
        <th>Trạng thái</th>
        <th>Ngày mua</th>
        <th style="width:90px; text-align:center;">Checklist</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="8" style="text-align:center;color:#666;">Không có kết quả</td></tr>`}
    </tbody>
  </table>

  <div class="signature">
    <div class="sig-box">
      <div class="sig-role">Người lập</div>
      <div class="sig-name">&nbsp;</div>
    </div>
    <div class="sig-box">
      <div class="sig-role">Thủ kho / Quản trị tài sản</div>
      <div class="sig-name">&nbsp;</div>
    </div>
    <div class="sig-box">
      <div class="sig-role">Kế toán tài sản</div>
      <div class="sig-name">&nbsp;</div>
    </div>
    <div class="sig-box">
      <div class="sig-role">Trưởng bộ phận</div>
      <div class="sig-name">&nbsp;</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  w.document.open();
  w.document.write(html);
  w.document.close();
  // Tự động gọi hộp thoại in sau khi render
  w.onload = () => w.print();
}


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
     <div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Tài sản</h1>
  <div className="flex gap-2">
    <button
      className="px-3 py-1 border rounded-md text-sm"
      onClick={handleExportExcel}
    >
      Xuất Excel
    </button>
    <button
      className="px-3 py-1 border rounded-md text-sm"
      onClick={handlePrintInventory}
    >
      In kiểm kê
    </button>
    <button
      className="px-3 py-1 border rounded-md text-sm"
      onClick={() => setShowFilters(s => !s)}
    >
      {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
    </button>
  </div>
</div>

      {/* FILTERS */}
      {showFilters && (
        <div className="rounded-2xl border p-5 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Từ khóa (mã, tên, mô tả...)"
              value={filter.q}
              onChange={e => setFilter({ ...filter, q: e.target.value })}
              className="px-3 py-2 border rounded-md w-full"
            />

            {/* Type (single) */}
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={filter.type}
              onChange={e => setFilter({ ...filter, type: e.target.value as AssetType | '' })}
            >
              <option value="">-- Loại tài sản --</option>
              {Object.values(AssetType).map(t => (
                <option key={t} value={t}>{labelAssetType(t as any)}</option>
              ))}
            </select>

            {/* Status (single) */}
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={filter.status}
              onChange={e => setFilter({ ...filter, status: e.target.value as AssetStatus | '' })}
            >
              <option value="">-- Trạng thái --</option>
              {Object.values(AssetStatus).map(s => (
                <option key={s} value={s}>{labelAssetStatus(s as any)}</option>
              ))}
            </select>

            {/* Organization (server-driven) */}
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={filter.orgId}
              onChange={e => setFilter({ ...filter, orgId: e.target.value, holderId: '' })}
            >
              <option value="">-- Cơ cấu tổ chức --</option>
              {orgs.map(o => (
                <option key={o._id} value={o._id}>{o.name || o._id}</option>
              ))}
            </select>

            {/* Holder (depends on org) */}
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={filter.holderId}
              onChange={e => setFilter({ ...filter, holderId: e.target.value })}
              disabled={!!(filter.orgId && users.length === 0)}
              title={filter.orgId ? 'Danh sách người giữ trong tổ chức đã chọn' : 'Danh sách tất cả người dùng'}
            >
              <option value="">-- Người giữ --</option>
              {users.map(u => (
              <option key={u._id} value={u._id}>{u.fullName}</option>
            ))}
            </select>

            {/* Purchase date range */}
            <div className="flex gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-gray-600">Từ ngày mua</label>
                <input type="date" className="px-3 py-2 border rounded-md w-full" value={filter.purchasedFrom || ''} onChange={e => setFilter({ ...filter, purchasedFrom: e.target.value || undefined })} />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-gray-600">Đến ngày mua</label>
                <input type="date" className="px-3 py-2 border rounded-md w-full" value={filter.purchasedTo || ''} onChange={e => setFilter({ ...filter, purchasedTo: e.target.value || undefined })} />
              </div>
            </div>

            {/* Has documents */}
            <label className="inline-flex items-center gap-2">
              <input id="hasDocs" type="checkbox" checked={!!filter.hasDocuments} onChange={e => setFilter({ ...filter, hasDocuments: e.target.checked ? true : undefined })} />
              <span>Chỉ hiện tài sản có hồ sơ</span>
            </label>

            {/* Document type (single) */}
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={filter.docType}
              onChange={e => setFilter({ ...filter, docType: e.target.value as AssetDocType | '' })}
            >
              <option value="">-- Loại hồ sơ --</option>
              {Object.values(AssetDocType).map(dt => (
                <option key={dt} value={dt}>{labelDocType(dt as any)}</option>
              ))}
            </select>

            {/* Event type (single) */}
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={filter.eventType}
              onChange={e => setFilter({ ...filter, eventType: e.target.value as AssetEventType | '' })}
            >
              <option value="">-- Loại sự kiện --</option>
              {Object.values(AssetEventType).map(et => (
                <option key={et} value={et}>{labelEventType(et as any)}</option>
              ))}
            </select>

            {/* Metadata contains */}
            <div className="grid grid-cols-2 gap-2 min-w-0">
              <input
                type="text"
                placeholder="Thông tin như Ram..."
                className="px-3 py-2 border rounded-md w-full min-w-0"
                value={filter.metadataKey}
                onChange={e => setFilter({ ...filter, metadataKey: e.target.value })}
              />
              <input
                type="text"
                placeholder="Giá trị ..."
                className="px-3 py-2 border rounded-md w-full min-w-0"
                value={filter.metadataValue}
                onChange={e => setFilter({ ...filter, metadataValue: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex flex-wrap gap-2 min-w-0">
              {filter.q && <FilterPill onClear={() => setFilter({ ...filter, q: '' })}>Từ khóa: <strong>{filter.q}</strong></FilterPill>}
              {filter.type && <FilterPill onClear={() => setFilter({ ...filter, type: '' })}>Loại: {labelAssetType(filter.type)}</FilterPill>}
              {filter.status && <FilterPill onClear={() => setFilter({ ...filter, status: '' })}>Trạng thái: {labelAssetStatus(filter.status)}</FilterPill>}
              {filter.orgId && <FilterPill onClear={() => setFilter({ ...filter, orgId: '', holderId: '' })}>Tổ chức: {/* show name */}{(orgs.find(o => o._id===filter.orgId)?.name) || filter.orgId}</FilterPill>}
              {filter.holderId && <FilterPill onClear={() => setFilter({ ...filter, holderId: '' })}>Người giữ: {usersMap.get(filter.holderId)}</FilterPill>}
              {(filter.purchasedFrom || filter.purchasedTo) && (
                <FilterPill onClear={() => setFilter({ ...filter, purchasedFrom: undefined, purchasedTo: undefined })}>
                  Mua: {filter.purchasedFrom || '...'} → {filter.purchasedTo || '...'}
                </FilterPill>
              )}
              {(filter.metadataKey || filter.metadataValue) && (
                <FilterPill onClear={() => setFilter({ ...filter, metadataKey: '', metadataValue: '' })}>
                  Metadata: {filter.metadataKey || '*'} ~ {filter.metadataValue || '*'}
                </FilterPill>
              )}
              {(filter.hasDocuments || filter.docType) && (
                <FilterPill onClear={() => setFilter({ ...filter, hasDocuments: undefined, docType: '' })}>
                  Hồ sơ: {filter.hasDocuments ? 'Có' : 'Tất cả'}{filter.docType ? ` (${labelDocType(filter.docType)})` : ''}
                </FilterPill>
              )}
              {filter.eventType && (
                <FilterPill onClear={() => setFilter({ ...filter, eventType: '' })}>
                  Sự kiện: {labelEventType(filter.eventType)}
                </FilterPill>
              )}
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 border rounded-md"
                onClick={() => setFilter(DEFAULT_FILTER)}
                type="button"
              >
                Xóa lọc
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={applyAdvancedFilters}
                type="button"
              >
                Áp dụng nâng cao
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      <div className="rounded-2xl border p-5 bg-white">
        {loading ? (
          <div>Đang tìm...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">Mã</th>
                  <th className="py-2 pr-4">Tên</th>
                  <th className="py-2 pr-4">Loại</th>
                  <th className="py-2 pr-4">Người giữ</th>
                  <th className="py-2 pr-4">Trạng thái</th>
                  <th className="py-2 pr-4">Ngày mua</th>
                  <th className="py-2 pr-4">Mở rộng</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => {
                  const isOpen = !!expanded[a._id!];
                  const evs = eventsByAsset[a._id!] || [];
                  const docs = docsByAsset[a._id!] || [];
                  return (
                    <React.Fragment key={a._id}>
                      <tr className="border-b hover:bg-gray-50 align-top">
                        <td className="py-2 pr-4">{a.code}</td>
                        <td className="py-2 pr-4">{a.name}</td>
                        <td className="py-2 pr-4">{labelAssetType(a.type as any)}</td>
                        <td className="py-2 pr-4">{a.currentHolderId ? usersMap.get(a.currentHolderId) ?? a.currentHolderId : '-'}</td>
                        <td className="py-2 pr-4">{labelAssetStatus(a.status as any)}</td>
                        <td className="py-2 pr-4">{a.purchaseDate ? format(new Date(a.purchaseDate), 'dd/MM/yyyy') : '-'}
</td>
                        <td className="py-2 pr-4">
                          <button onClick={() => toggleExpand(a._id!)} className="px-2 py-1 rounded-lg border hover:bg-gray-50">
                            {isOpen ? 'Ẩn' : 'Xem'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50">
                          <td className="py-2 px-4" colSpan={7}>
                            {/* EVENTS */}
                            <div className="mb-4">
                              <div className="font-semibold mb-2">Lịch sử sự kiện</div>
                              {loadingEv[a._id!] ? (
                                <div className="text-gray-600">Đang tải lịch sử...</div>
                              ) : evs.length === 0 ? (
                                <div className="text-gray-500">Chưa có sự kiện.</div>
                              ) : (
                                <ul className="space-y-2">
                                  {evs.map(ev => (
                                    <li key={ev._id} className="border rounded-lg bg-white p-3">
                                      <div className="font-medium">
                                        {labelEventType(ev.type as any)} • {ev.date?.slice(0,10)}
                                      </div>
                                      <div className="text-sm text-gray-700">
                                        {ev.toUserId && (<div><span className="text-gray-500">Người nhận:</span> {usersMap.get(ev.toUserId) || ev.toUserId}</div>)}
                                        {ev.fromUserId && (<div><span className="text-gray-500">Người giao:</span> {usersMap.get(ev.fromUserId) || ev.fromUserId}</div>)}
                                        {ev.note && (<div><span className="text-gray-500">Ghi chú:</span> {ev.note}</div>)}
                                        {ev.cost && (<div><span className="text-gray-500">Chi phí:</span> {ev.cost.amount} {ev.cost.currency}</div>)}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* DOCUMENTS */}
                            <div>
                              <div className="font-semibold mb-2">Văn bản / Hồ sơ</div>
                              {loadingDoc[a._id!] ? (
                                <div className="text-gray-600">Đang tải hồ sơ...</div>
                              ) : docs.length === 0 ? (
                                <div className="text-gray-500">Chưa có hồ sơ.</div>
                              ) : (
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                  {docs.map(d => (
                                    <li key={d._id}>
                                      <div className="font-medium inline-block mr-2">{labelDocType(d.type as any)}</div>
                                      <span className="text-gray-600">{d.date}</span>
                                      {d.code ? <span className="text-gray-600"> • {d.code}</span> : null}
                                      {d.description ? <div className="text-gray-700">{d.description}</div> : null}
                                      {!!(d.files && d.files.length) && (
                                        <ul className="pl-4 list-disc">
                                          {d.files.map(f => (
                                            <li key={f._id}>
                                              {buildFileUrl(f) ? (
                                                <a className="text-blue-600 hover:underline" href={buildFileUrl(f)} target="_blank" rel="noreferrer">
                                                  {f.originalName} ({Math.round(f.size / 1024)} KB)
                                                </a>
                                              ) : (
                                                <span>{f.originalName} ({Math.round(f.size / 1024)} KB)</span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {!assets.length && !loading && (
                  <tr className="border-b"><td colSpan={7} className="text-center py-6 text-gray-500">Không có kết quả</td></tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-700">Hiển thị {assets.length} / {total}</span>
              <div className="flex items-center gap-2">
                <select
                  className="px-2 py-1 border rounded-md"
                  value={limit}
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                >
                  {[20,50,100,200].map(n => <option key={n} value={n}>{n}/trang</option>)}
                </select>
                <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="px-3 py-1 border rounded-md disabled:opacity-50">Trước</button>
                <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded-md">Tiếp</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
