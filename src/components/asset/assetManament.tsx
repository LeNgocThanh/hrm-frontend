'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Asset,
  AssetStatus,
  AssetType,
  AssetEventType,
  AssetDocType,
  UploadFile,
  AssetDocument,
  AssetEvent,
  AssetMetadata,
} from '@/types/asset';
import { User } from '@/types/index';
import {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  listAssetEvents,
  createAssetEvent,
  deleteAssetEvent,
  listAssetDocuments,
  createAssetDocument,
  deleteAssetDocument,
  uploadFile,
  buildFileUrl,
  listUsers,
} from '@/lib/api/asset';
import { createUserDocument } from '@/lib/api/userDocument';
import { DocTypeEnum } from '@/types/userDocument';
import { flushSync } from 'react-dom';
// ==== VIETNAMESE LABEL MAPPERS (frontend only) ====
const DOC_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Mua',
  WARRANTY: 'Bảo hành',
  MAINTENANCE: 'Bảo trì',
  LIQUIDATION: 'Thanh lý',
  HANDOVER: 'Bàn giao',
  OTHER: 'Khác',
  ACCEPTANCE: 'Tiếp nhận',
  REPAIR: 'Sửa chữa',
  TRANSFER: 'Chuyển giao'
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  ASSIGN: 'Giao tài sản',
  TRANSFER: 'Chuyển giao',
  RETURN: 'Hoàn trả',
  REPAIR: 'Sửa chữa',
  LOSS: 'Mất',
  FOUND: 'Tìm thấy',
  DISPOSE: 'Thanh lý',
  OTHER: 'Khác',
  PURCHASE: 'Mua',
};
const ASSET_TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Máy bàn',
  MONITOR: 'Màn hình',
  PHONE: 'Điện thoại',
  VEHICLE: 'Phương tiện',
  FURNITURE: 'Nội thất',
  OTHER: 'Khác',
  ELECTRONIC: 'Đồ điện tử',
  EQUIPMENT: 'Công cụ',
  TOOL: 'Dụng cụ',
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

type Props = { assetId?: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5 shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

const emptyAsset: Asset = {
  code: '',
  name: '',
  type: AssetType.OTHER,
  status: AssetStatus.IN_STOCK,
};

type MetaRow = { key: string; value: string };

type AssetFilter = {
  search?: string;
  type?: AssetType;
  status?: AssetStatus;
  metadata?: Record<string, string>;
};

type AssetSorter = {
  sortBy?: keyof Asset;
  sortOrder?: 'asc' | 'desc';
};

export default function AssetManagement({ assetId }: Props) {
  // Index list state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [filter, setFilter] = useState<AssetFilter>({});
  const [sorter, setSorter] = useState<AssetSorter>({ sortBy: 'name', sortOrder: 'asc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);

  // Asset form state
  const [asset, setAsset] = useState<Asset>(emptyAsset);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Inline edit mode (on index page)
  const [editingInline, setEditingInline] = useState<boolean>(false);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const usersMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u._id, u.fullName || u._id);
    return m;
  }, [users]);

  // Children: events & documents (both detail and inline-edit use these)
  const [events, setEvents] = useState<AssetEvent[]>([]);
  const [documents, setDocuments] = useState<AssetDocument[]>([]);

  // Also keep per-asset cache for expanded rows on index list
  const [eventsByAsset, setEventsByAsset] = useState<Record<string, AssetEvent[]>>({});
  const [documentsByAsset, setDocumentsByAsset] = useState<Record<string, AssetDocument[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<Record<string, boolean>>({});
  const [loadingDocs, setLoadingDocs] = useState<Record<string, boolean>>({});
  const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({});
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, string | null>>({});

  // Forms for children (used in inline edit only)
  const [eventForm, setEventForm] = useState<{
    type: AssetEventType;
    date: string;
    note?: string;
    amount?: number;
    currency?: string;
    fromUserId?: string;
    toUserId?: string;
  }>({
    type: AssetEventType.ASSIGN,
    date: new Date().toISOString().slice(0, 10),
    fromUserId: '',
    toUserId: '',
  });

  const [docForm, setDocForm] = useState<{
    type: AssetDocType;
    date: string;
    description?: string;
    code?: string;
    ownerUserId?: string;
  }>({
    type: AssetDocType.PURCHASE,
    date: new Date().toISOString().slice(0, 10),
    ownerUserId: '',
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

  // Metadata rows for asset form
  const [metaRows, setMetaRows] = useState<MetaRow[]>([{ key: '', value: '' }]);

  const canCreateChildren = useMemo(() => Boolean(asset._id), [asset._id]);
  const showChildrenEdit = canCreateChildren && editingInline; // inline edit at index
  const showChildrenView = canCreateChildren && Boolean(assetId) && !editingInline; // detail view only

  const userLabel = (id?: string) => (id ? usersMap.get(id) ?? id : '');

  function eventDateOf(ev: any): string {
    const raw = ev.date || ev.eventDate || ev.createdAt;
    if (!raw) return '';
    return String(raw).slice(0, 10);
  }

  async function toggleAssetHistory(id: string) {
    setExpandedAssets(prev => ({ ...prev, [id]: !prev[id] }));
    if (!eventsByAsset[id] && !loadingEvents[id]) {
      try {
        setLoadingEvents(prev => ({ ...prev, [id]: true }));
        const evs = await listAssetEvents(id);
        setEventsByAsset(prev => ({ ...prev, [id]: evs || [] }));
      } finally {
        setLoadingEvents(prev => ({ ...prev, [id]: false }));
      }
    }
    if (!documentsByAsset[id] && !loadingDocs[id]) {
      try {
        setLoadingDocs(prev => ({ ...prev, [id]: true }));
        const docs = await listAssetDocuments(id);
        setDocumentsByAsset(prev => ({ ...prev, [id]: docs || [] }));
      } finally {
        setLoadingDocs(prev => ({ ...prev, [id]: false }));
      }
    }
  }

  function toggleEventDetail(assetId: string, eventId: string) {
    setExpandedEventIds(prev => ({ ...prev, [assetId]: prev[assetId] === eventId ? null : eventId }));
  }

  // Load users
  useEffect(() => {
    (async () => {
      try {
        const u = await listUsers();
        setUsers(u);
      } catch (e) {
        console.warn('Load users failed', e);
      }
    })();
  }, []);

  // List assets
  const fetchAssets = useMemo(() => {
    return async (page: number, limit: number, filter: AssetFilter, sorter: AssetSorter) => {
      setLoadingList(true);
      setError(null);
      try {
        const res = await listAssets({ ...filter, ...sorter, page, limit });
        const sortedAssets = (res.assets || []).slice().sort((a: any, b: any) => {
          if (!sorter.sortBy) return 0;
          const aValue = a[sorter.sortBy] ?? '';
          const bValue = b[sorter.sortBy] ?? '';
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sorter.sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
          }
          return 0;
        });
        setAssets(sortedAssets);
        setTotal(res.total ?? 0);
      } catch (e: any) {
        setError(e.message ?? 'Load assets failed');
      } finally {
        setLoadingList(false);
      }
    };
  }, [sorter.sortBy, sorter.sortOrder]);

  useEffect(() => {
    if (!assetId) fetchAssets(page, limit, filter, sorter);
  }, [assetId, page, limit, filter, sorter, fetchAssets]);

  // Detail route: load asset
  useEffect(() => {
    if (!assetId) return;
    (async () => {
      try {
        const data = await getAsset(assetId);
        const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate).toISOString().split('T')[0] : '';
        setAsset({ ...data, purchaseDate, originalCost: data.originalCost ?? { amount: 0, currency: 'VND' } });
      } catch (e: any) {
        setError(e.message ?? 'Load asset failed');
      }
    })();
  }, [assetId]);

  // Load children when we have an asset selected (detail or inline edit)
  useEffect(() => {
    if (!asset._id) return;
    (async () => {
      try {
        const [ev, docs] = await Promise.all([
          listAssetEvents(asset._id!),
          listAssetDocuments(asset._id!),
        ]);
        setEvents(ev || []);
        setDocuments(docs || []);
      } catch (e) {
        console.warn(e);
      }
    })();
  }, [asset._id]);

  // Metadata helpers
  function buildMetadata(): AssetMetadata | undefined {
    const clean = metaRows.map(r => ({ key: r.key.trim(), value: r.value })).filter(r => r.key.length > 0);
    if (!clean.length) return undefined;
    return Object.fromEntries(clean.map(r => [r.key, r.value]));
  }

  // Save/Delete asset
  async function handleSaveAsset(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<Asset> = { ...asset, metadata: buildMetadata() } as any;      
      if (asset._id) {
        const updated = await updateAsset(asset._id, payload);
        setAsset(updated);
      } else {
        const created = await createAsset(payload);
        setAsset(created);
      }
      if (!assetId) await fetchAssets(page, limit, filter, sorter);
      if (editingInline) setEditingInline(false);
      const rows: MetaRow[] = Object.entries(((asset._id ? asset.metadata : payload.metadata) ?? {}) as AssetMetadata).map(([k, v]) => ({ key: k, value: String(v) }));
      setMetaRows(rows.length ? rows : [{ key: '', value: '' }]);
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAsset() {
    if (!asset._id) return;
    if (!confirm('Xóa tài sản này?')) return;
    setDeleting(true);
    try {
      await deleteAsset(asset._id);
      setAsset(emptyAsset);
      setMetaRows([{ key: '', value: '' }]);
      if (!assetId) {
        await fetchAssets(page, limit, filter, sorter);
        setEditingInline(false);
      } else {
        alert('Đã xóa. Quay lại danh sách.');
      }
    } catch (e: any) {
      alert(e.message ?? 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // Inline edit loader
  async function handleInlineEdit(id: string) {
    try {
      const data = await getAsset(id);
      const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate).toISOString().split('T')[0] : '';
      setAsset({ ...data, purchaseDate, originalCost: data.originalCost ?? { amount: 0, currency: 'VND' } });
      const rows: MetaRow[] = Object.entries((data.metadata ?? {}) as AssetMetadata).map(([k, v]) => ({ key: k, value: String(v) }));
      setMetaRows(rows.length ? rows : [{ key: '', value: '' }]);
      setEditingInline(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message ?? 'Load asset failed');
    }
  }

  // Event handlers (used in inline edit only)
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!asset._id) return;
    const fromUserId = (eventForm.type === AssetEventType.ASSIGN || eventForm.type === AssetEventType.TRANSFER)
      ? asset.currentHolderId
      : eventForm.fromUserId;
    try {
      const created = await createAssetEvent(asset._id, {
        type: eventForm.type,
        date: eventForm.date,
        note: eventForm.note,
        cost: eventForm.amount && eventForm.currency ? { amount: eventForm.amount, currency: eventForm.currency } : undefined,
        fromUserId,
        toUserId: eventForm.toUserId,
      });

      const fresh = await listAssetEvents(asset._id);
      setEvents(fresh || []);

      //setEvents([created, ...events]);
      setEventForm({ type: eventForm.type, date: new Date().toISOString().slice(0, 10) });
    } catch (err: any) {
      alert(err.message ?? 'Create event failed');
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!id) return;
    if (!confirm('Xóa event này?')) return;
    try {
      await deleteAssetEvent(id);
      setEvents(events.filter(e => e._id !== id));
    } catch (err: any) {
      alert(err.message ?? 'Delete event failed');
    }
  }

  // Document handlers (used in inline edit only)
  async function handleUploadFiles(): Promise<UploadFile[]> {
    if (!pendingFiles.length) return [];
    setUploading(true);
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const uploaderId = userInfo.id;
    try {
      const uploaded: UploadFile[] = [];
      for (const f of pendingFiles) {
        const up = await uploadFile(f, { resourceType: 'ASSET_DOCUMENT', relatedId: asset._id, uploaderId });
        uploaded.push(up);
      }
      return uploaded;
    } finally {
      setUploading(false);
      setPendingFiles([]);
    }
  }

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!asset._id) return;
    try {
      const uploaded = await handleUploadFiles();
      const fileIds = uploaded.map(f => (f as any)._id!).filter(Boolean);
      const ownerUserId = docForm.ownerUserId;
      const created = await createAssetDocument(asset._id, {
        type: docForm.type,
        date: docForm.date,
        description: docForm.description,
        code: docForm.code,
        ownerUserId,
        fileIds,
      });
      setDocuments([created, ...documents]);
      setDocForm({ type: docForm.type, date: new Date().toISOString().slice(0, 10) });

      for (const file of uploaded) {
        await createUserDocument({
          userId: ownerUserId || '',
          docType: DocTypeEnum.ASSET_DOCUMENT,
          description: 'asset',
          fileId: (file as any)._id!,
        });
      }
    } catch (err: any) {
      alert(err.message ?? 'Create document failed');
    }
  }

  async function handleDeleteDocument(id: string) {
    if (!asset._id) return;
    if (!confirm('Xóa hồ sơ (document) này?')) return;
    try {
      await deleteAssetDocument(asset._id, id);
      setDocuments(documents.filter(d => d._id !== id));
    } catch (err: any) {
      alert(err.message ?? 'Delete document failed');
    }
  }

  // Metadata row helpers
  function addMetaRow() { setMetaRows(rows => [...rows, { key: '', value: '' }]); }
  function removeMetaRow(idx: number) { setMetaRows(rows => rows.filter((_, i) => i !== idx)); }
  function updateMetaRow(idx: number, patch: Partial<MetaRow>) { setMetaRows(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))); }

  // Filters & sorters
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setFilter({ ...filter, search: e.target.value }); setPage(1); };
  const handleSort = (sortBy: keyof Asset) => setSorter(prev => ({ sortBy, sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc' }));

  function fmtVN(d?: string) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return d;
  }
}

async function handleCreateEventAndPrint(e: React.FormEvent) {
  e.preventDefault();
  if (!asset._id) return;

  const fromUserId =
    (eventForm.type === AssetEventType.ASSIGN || eventForm.type === AssetEventType.TRANSFER)
      ? asset.currentHolderId
      : eventForm.fromUserId;

  try {
    const created = await createAssetEvent(asset._id, {
      type: eventForm.type,
      date: eventForm.date,
      note: eventForm.note,
      cost: eventForm.amount && eventForm.currency ? { amount: eventForm.amount, currency: eventForm.currency } : undefined,
      fromUserId,
      toUserId: eventForm.toUserId,
    });
    const fresh = await listAssetEvents(asset._id);
     flushSync(() => {
    setEvents(fresh || []);
  });
    //setEvents([created, ...events]);
    // In ngay biên bản của sự kiện vừa tạo:
    //printEventReceipt(asset, created, usersMap);
    const enriched =
    (fresh || []).find(ev => ev._id && ev._id === created?._id)
    // fallback nếu backend chưa trả _id ở create
    ?? (fresh || []).find(ev =>
        ev.type === created.type &&
        ev.date === created.date &&
        (ev.note || '') === (created.note || '') &&
        ev.toUserId === created.toUserId &&
        (ev.fromUserId || null) === (created.fromUserId || null)
      )
    // thêm một fallback an toàn cuối cùng
    ?? (fresh?.[0]);

  // 5) In bằng bản ghi “enriched”
  if (enriched) {
    printEventReceipt(asset, enriched, usersMap);
  }
    // reset form
    setEventForm({ type: eventForm.type, date: new Date().toISOString().slice(0, 10) });
  } catch (err: any) {
    alert(err.message ?? 'Create event failed');
  }
}

function printEventReceipt(asset: Asset, ev: AssetEvent, usersMap: Map<string, string>) {
  const w = window.open('', '_blank', 'width=1024,height=768');
  if (!w) return;

  const title = `Biên bản ${labelEventType(ev.type as any).toLowerCase()}`;
  const dateStr = fmtVN(ev.date || ev.createdAt);
  const toName = ev.toUserId ? (usersMap.get(ev.toUserId) ?? ev.toUserId) : '';
  const fromName = ev.fromUserId ? (usersMap.get(ev.fromUserId) ?? ev.fromUserId) : '';
  const note = ev.note || '';

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @media print { @page { margin: 16mm; } .no-print { display:none!important; } }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111; }
    h1 { font-size: 20px; margin: 0 0 12px; text-transform: uppercase; }
    .meta { font-size: 13px; color:#444; margin-bottom: 12px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .box { background:#fafafa; border:1px solid #ddd; border-radius:10px; padding:10px; }
    table { width:100%; border-collapse: collapse; margin-top:10px; font-size: 13px; }
    th, td { border:1px solid #999; padding:6px 8px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; }
    .signature { margin-top: 24px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
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
    <div><strong>Ngày lập:</strong> ${dateStr || ''}</div>
    ${note ? `<div><strong>Ghi chú:</strong> ${note}</div>` : ''}
  </div>

  <div class="grid">
    <div class="box">
      <div><strong>Tài sản:</strong> ${asset.name || ''}</div>
      <div><strong>Mã:</strong> ${asset.code || ''}</div>
      <div><strong>Loại:</strong> ${labelAssetType(asset.type as any)}</div>
      <div><strong>Vị trí:</strong> ${asset.location || ''}</div>
      <div><strong>Serial:</strong> ${asset.serialNumber || ''}</div>
    </div>
    <div class="box">
      <div><strong>Người giao:</strong> ${fromName || '-'}</div>
      <div><strong>Người nhận:</strong> ${toName || '-'}</div>
      <div><strong>Trạng thái sau sự kiện:</strong> ${labelAssetStatus(asset.status as any)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:60px; text-align:center;">Số TT</th>
        <th>Mô tả</th>
        <th style="width:120px; text-align:center;">Checklist</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center;">1</td>
        <td>${asset.name || ''} (${asset.code || ''})</td>
        <td style="text-align:center;"><input type="checkbox"/></td>
      </tr>
    </tbody>
  </table>

  <div class="signature">
    <div class="sig-box">
      <div class="sig-role">Bên giao</div>
      <div class="sig-name">&nbsp;</div>
    </div>
    <div class="sig-box">
      <div class="sig-role">Bên nhận</div>
      <div class="sig-name">&nbsp;</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

  // Render gates
  const showForm = Boolean(editingInline || (!assetId && !asset._id)); // create or inline edit on index
  const isEditing = Boolean(asset._id);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Tài sản</h1>
      {error && <div className="rounded-md bg-red-50 text-red-700 p-3">{error}</div>}

      {/* Index list */}
      {!assetId && (
        <Section title="Danh sách tài sản">
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Tìm kiếm tài sản..."
              className="px-4 py-2 border rounded-md w-full sm:w-1/2"
              value={filter.search ?? ''}
              onChange={handleSearchChange}
            />
            <select className="px-4 py-2 border rounded-md" value={filter.type ?? ''} onChange={e => { setFilter({ ...filter, type: e.target.value as AssetType }); setPage(1); }}>
              <option value="">-- Loại tài sản --</option>
              {Object.values(AssetType).map(type => (<option key={type} value={type}>{labelAssetType(type as any)}</option>))}
            </select>
            <select className="px-4 py-2 border rounded-md" value={filter.status ?? ''} onChange={e => { setFilter({ ...filter, status: e.target.value as AssetStatus }); setPage(1); }}>
              <option value="">-- Trạng thái --</option>
              {Object.values(AssetStatus).map(status => (<option key={status} value={status}>{labelAssetStatus(status as any)}</option>))}
            </select>
          </div>
          {loadingList ? (
            <div>Đang tải...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('code')}>Mã {sorter.sortBy === 'code' && (sorter.sortOrder === 'asc' ? '▲' : '▼')}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('name')}>Tên {sorter.sortBy === 'name' && (sorter.sortOrder === 'asc' ? '▲' : '▼')}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('type')}>Loại {sorter.sortBy === 'type' && (sorter.sortOrder === 'asc' ? '▲' : '▼')}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('currentHolderId')}>Người giữ {sorter.sortBy === 'currentHolderId' && (sorter.sortOrder === 'asc' ? '▲' : '▼')}</th>
                    <th className="py-2 pr-4 cursor-pointer" onClick={() => handleSort('status')}>Trạng thái {sorter.sortBy === 'status' && (sorter.sortOrder === 'asc' ? '▲' : '▼')}</th>
                    <th className="py-2 pr-4">Lịch sử</th>
                    <th className="py-2 pr-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => {
                    const isOpen = !!expandedAssets[a._id!];
                    const evs = eventsByAsset[a._id!] || [];
                    const docs = documentsByAsset[a._id!] || [];
                    const isLoadingEvents = !!loadingEvents[a._id!];
                    const isLoadingDocs = !!loadingDocs[a._id!];
                    const openEventId = expandedEventIds[a._id!] ?? null;
                    return (
                      <React.Fragment key={a._id}>
                        <tr className="border-b hover:bg-gray-50 align-top">
                          <td className="py-2 pr-4">{a.code}</td>
                          <td className="py-2 pr-4">{a.name}</td>
                          <td className="py-2 pr-4">{labelAssetType(a.type as any)}</td>
                          <td className="py-2 pr-4">{a.currentHolderId ? usersMap.get(a.currentHolderId) ?? a.currentHolderId : '-'}</td>
                          <td className="py-2 pr-4">{labelAssetStatus(a.status as any)}</td>
                          <td className="py-2 pr-4">
                            <button onClick={() => toggleAssetHistory(a._id!)} className="px-2 py-1 rounded-lg border hover:bg-gray-50" title={isOpen ? 'Đóng lịch sử' : 'Xem lịch sử'}>
                              {isOpen ? 'Ẩn' : 'Xem'}
                            </button>
                          </td>
                          <td className="py-2 pr-4 space-x-3">
                            <button onClick={() => handleInlineEdit(a._id!)} className="text-blue-600 hover:underline">Sửa</button>
                            <a className="text-blue-600 hover:underline" href={`/adminAssets/assets/${a._id}`}>Chi tiết</a>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50">
                            <td className="py-2 px-4" colSpan={7}>
                              {/* Event history */}
                              <div className="mb-4">
                                <div className="font-semibold mb-2">Lịch sử sự kiện</div>
                                {isLoadingEvents ? (
                                  <div className="text-gray-600">Đang tải lịch sử...</div>
                                ) : evs.length === 0 ? (
                                  <div className="text-gray-500">Chưa có sự kiện.</div>
                                ) : (
                                  <ul className="space-y-2">
                                    {evs.map((ev, idx) => {
                                      const label = `${labelEventType(ev.type as any)} ${eventDateOf(ev)} ${userLabel(ev.toUserId)} nhận - ${userLabel(ev.fromUserId)} giao`;
                                      const active = openEventId === ev._id;
                                      return (
                                        <li key={ev._id ?? `tmp-${ev.type}-${ev.date}-${idx}`} className="border rounded-lg bg-white">
                                          <button type="button" onClick={() => toggleEventDetail(a._id!, ev._id!)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between">
                                            <span className="truncate">{label}</span>
                                            <span className="text-gray-500">{active ? '▴' : '▾'}</span>
                                          </button>
                                          {active && (
                                            <div className="px-3 pb-3 text-sm text-gray-700">
                                              <div><span className="text-gray-500">Ngày:</span> {eventDateOf(ev)}</div>
                                              {ev.note && (<div><span className="text-gray-500">Ghi chú:</span> {ev.note}</div>)}
                                              {ev.cost && (<div><span className="text-gray-500">Chi phí:</span> {ev.cost.amount} {ev.cost.currency}</div>)}
                                            </div>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>

                              {/* Documents list */}
                              <div className="mb-4">
                                <div className="font-semibold mb-2">Văn bản / Hồ sơ</div>
                                {isLoadingDocs ? (
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

                              {/* Metadata display */}
                              <div>
                                <div className="font-semibold mb-2">Thông số (Metadata)</div>
                                {a.metadata && Object.keys(a.metadata).length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    {Object.entries(a.metadata as AssetMetadata).map(([k, v]) => (
                                      <div key={k} className="flex justify-between bg-white p-2 rounded border">
                                        <span className="text-gray-600">{k}</span>
                                        <span className="font-medium">{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-gray-500">Chưa có metadata.</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!assets.length && (
                    <tr className="border-b">
                      <td colSpan={7} className="text-center py-4 text-gray-500">Không có tài sản nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-700">Hiển thị {assets.length} trên {total} kết quả</span>
                <div>
                  <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="px-3 py-1 mr-2 border rounded-md disabled:opacity-50">Trước</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-3 py-1 border rounded-md disabled:opacity-50">Tiếp</button>
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Create/Edit form (index inline or creating) */}
      {showForm && (
        <Section title={isEditing ? `Chỉnh sửa tài sản: ${asset.name}` : 'Tạo mới tài sản'}>
          <form onSubmit={handleSaveAsset} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">Mã tài sản</label>
              <input id="code" type="text" value={asset.code} onChange={e => setAsset({ ...asset, code: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Tên tài sản</label>
              <input id="name" type="text" value={asset.name} onChange={e => setAsset({ ...asset, name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">Loại</label>
              <select id="type" value={asset.type} onChange={e => setAsset({ ...asset, type: e.target.value as AssetType })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                {Object.values(AssetType).map(type => (<option key={type} value={type}>{labelAssetType(type as any)}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Trạng thái</label>
              <select
                id="status"
                value={asset.status}
                onChange={e => setAsset({ ...asset, status: e.target.value as AssetStatus })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                {Object.values(AssetStatus).map(status => (
                  <option key={status} value={status}>
                    {labelAssetStatus(status)}
                  </option>
                ))}
              </select>

            </div>
            <div>
              <label htmlFor="holder" className="block text-sm font-medium text-gray-700">Người giữ hiện tại</label>
              <select id="holder" value={asset.currentHolderId || ''} onChange={e => setAsset({ ...asset, currentHolderId: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                <option value="">-- Chọn người dùng --</option>
                {users.map(u => (<option key={u._id} value={u._id}>{u.fullName || u._id}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">Vị trí</label>
              <input id="location" type="text" value={asset.location || ''} onChange={e => setAsset({ ...asset, location: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">Ngày mua</label>
              <input id="purchaseDate" type="date" value={asset.purchaseDate || ''} onChange={e => setAsset({ ...asset, purchaseDate: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
             <div>
  <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">
    Giá mua
  </label>
  <input
    id="purchasePrice"
    type="number"
    value={asset.purchasePrice?.amount ?? ''}
    onChange={e =>
      setAsset({
        ...asset,
        purchasePrice: {
          amount: Number(e.target.value),
          currency: asset.purchasePrice?.currency || 'VND', // giữ nguyên hoặc gán mặc định
        },
      })
    }
    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
  />
</div>

            <div>
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">Nhà cung cấp</label>
              <input id="supplier" type="text" value={asset.supplier || ''} onChange={e => setAsset({ ...asset, supplier: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700">Serial Number</label>
              <input id="serialNumber" type="text" value={asset.serialNumber || ''} onChange={e => setAsset({ ...asset, serialNumber: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Mô tả</label>
              <textarea id="description" value={asset.description || ''} onChange={e => setAsset({ ...asset, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>

            <h4 className="font-semibold text-gray-700 pt-4">Thông tin thêm </h4>
            <div className="space-y-2">
              {metaRows.map((row, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="text" placeholder="Loại .. ví dụ RAM" value={row.key} onChange={e => updateMetaRow(idx, { key: e.target.value })} className="w-1/3 rounded-md border-gray-300 shadow-sm" />
                  <input type="text" placeholder="Giá trị ... ví dụ 2G" value={row.value} onChange={e => updateMetaRow(idx, { value: e.target.value })} className="w-2/3 rounded-md border-gray-300 shadow-sm" />
                  <button type="button" onClick={() => removeMetaRow(idx)} className="text-red-600 hover:text-red-800">Xóa</button>
                </div>
              ))}
              <button type="button" onClick={addMetaRow} className="text-blue-600 hover:text-blue-800">+ Thêm</button>
            </div>

            <div className="flex gap-4">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={saving}>{saving ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo mới'}</button>
              {isEditing && (
                <button type="button" onClick={handleDeleteAsset} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700" disabled={deleting}>{deleting ? 'Đang xóa...' : 'Xóa'}</button>
              )}
              {editingInline && (
                <button type="button" onClick={() => { setAsset(emptyAsset); setEditingInline(false); setMetaRows([{ key: '', value: '' }]); }} className="px-4 py-2 border rounded-md">Hủy</button>
              )}
            </div>
          </form>
        </Section>
      )}

      {/* DETAIL VIEW (read-only) */}
      {assetId && asset._id && !editingInline && (
        <Section title={`Thông tin tài sản : ${asset.name}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded border"><div className="text-gray-500">Mã</div><div className="font-medium">{asset.code}</div></div>
            <div className="bg-gray-50 p-3 rounded border"><div className="text-gray-500">Loại</div><div className="font-medium">{labelAssetType(asset.type as any)}</div></div>
            <div className="bg-gray-50 p-3 rounded border"><div className="text-gray-500">Trạng thái</div><div className="font-medium">{labelAssetStatus(asset.status as any)}</div></div>
            <div className="bg-gray-50 p-3 rounded border"><div className="text-gray-500">Người giữ</div><div className="font-medium">{asset.currentHolderId ? usersMap.get(asset.currentHolderId) ?? asset.currentHolderId : '-'}</div></div>
            <div className="bg-gray-50 p-3 rounded border"><div className="text-gray-500">Vị trí</div><div className="font-medium">{asset.location || '-'}</div></div>
            <div className="bg-gray-50 p-3 rounded border"><div className="text-gray-500">Ngày mua</div><div className="font-medium">{asset.purchaseDate || '-'}</div></div>
            <div className="bg-gray-50 p-3 rounded border md:col-span-2"><div className="text-gray-500">Mô tả</div><div className="font-medium whitespace-pre-wrap">{asset.description || '-'}</div></div>
          </div>
          <div className="mt-6">
            <div className="font-semibold mb-2">Thông số (Metadata)</div>
            {asset.metadata && Object.keys(asset.metadata).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(asset.metadata as AssetMetadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-white p-2 rounded border"><span className="text-gray-600">{k}</span><span className="font-medium">{String(v)}</span></div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">Không có thông tin thêm.</div>
            )}
          </div>
        </Section>
      )}

      {/* CHILDREN: INLINE EDIT (editable) */}
      {showChildrenEdit && (
        <>
          <Section title="Lịch sử sự kiện ">
            <form onSubmit={handleCreateEvent} className="mb-4 space-y-2 border-b pb-4">
              <h4 className="font-semibold">Thêm sự kiện mới</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <select className="px-2 py-1 border rounded-md" value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value as AssetEventType })}>
                  {Object.values(AssetEventType).map(type => (<option key={type} value={type}>{labelEventType(type as any)}</option>))}
                </select>
                <input type="date" className="px-2 py-1 border rounded-md" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} required />
                <input type="text" placeholder="Ghi chú" className="px-2 py-1 border rounded-md flex-grow" value={eventForm.note || ''} onChange={e => setEventForm({ ...eventForm, note: e.target.value })} />
                {(eventForm.type === AssetEventType.ASSIGN || eventForm.type === AssetEventType.TRANSFER) && (
                  <select className="px-2 py-1 border rounded-md" value={eventForm.toUserId || ''} onChange={e => setEventForm({ ...eventForm, toUserId: e.target.value })}>
                    <option value="">-- Giao cho --</option>
                    {users.map(u => (<option key={u._id} value={u._id}>{u.fullName || u._id}</option>))}
                  </select>
                )}
                <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md">Thêm</button>
                <button
    type="button"
    onClick={handleCreateEventAndPrint}
    className="px-3 py-1 border rounded-md"
    title="Tạo sự kiện và in biên bản"
  >
    Thêm & In biên bản
  </button>
              </div>
            </form>
            <div className="space-y-2">
              {events.map((ev, idx) => (
                <div key={ev._id ?? `tmp-${ev.type}-${ev.date}-${idx}`} className="p-3 border rounded-md flex justify-between items-start bg-gray-50">
                  <div>
                    <div className="font-medium">
                      {labelEventType(ev.type as any)} - {ev.toUserId ? (<><span className="text-gray-500">Người nhận:</span> {usersMap.get(ev.toUserId) || ev.toUserId}</>) : ''} - {ev.fromUserId ? (<><span className="text-gray-500">Người giao:</span> {usersMap.get(ev.fromUserId) || ev.toUserId}</>) : ''}
                    </div>
                    <div className="text-sm text-gray-600">{eventDateOf(ev)}</div>
                    {ev.note && <div className="text-sm">{ev.note}</div>}
                  </div>
                  <div className="flex items-center gap-3">
    <button
      className="text-gray-700 hover:underline"
      onClick={() => printEventReceipt(asset, ev, usersMap)}
      title="In biên bản sự kiện này"
    >
      In biên bản
    </button>
    <button
      className="text-red-600 hover:underline"
      onClick={() => handleDeleteEvent(ev._id!)}
    >
      Xóa
    </button>
  </div>
                </div>
                
              ))}
              {!events.length && <div className="text-sm text-gray-500 py-3">Chưa có sự kiện.</div>}
            </div>
          </Section>

          <Section title="Hồ sơ tài liệu ">
            <form onSubmit={handleCreateDocument} className="mb-4 space-y-2 border-b pb-4">
              <h4 className="font-semibold">Thêm hồ sơ mới</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="docType" className="block text-sm font-medium text-gray-700">Loại hồ sơ</label>
                  <select id="docType" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value as AssetDocType })}>
                    {Object.values(AssetDocType).map(type => (<option key={type} value={type}>{labelDocType(type as any)}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="docDate" className="block text-sm font-medium text-gray-700">Ngày</label>
                  <input id="docDate" type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={docForm.date} onChange={e => setDocForm({ ...docForm, date: e.target.value })} required />
                </div>
                <select className="px-2 py-1 border rounded-md" value={docForm.ownerUserId || ''} onChange={e => setDocForm({ ...docForm, ownerUserId: e.target.value })}>
                  <option value="">-- Chủ sở hữu --</option>
                  {users.map(u => (<option key={u._id} value={u._id}>{u.fullName || u._id}</option>))}
                </select>
                <div className="sm:col-span-2">
                  <label htmlFor="docDescription" className="block text-sm font-medium text-gray-700">Mô tả</label>
                  <textarea id="docDescription" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={docForm.description || ''} onChange={e => setDocForm({ ...docForm, description: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="docFiles" className="block text-sm font-medium text-gray-700">File đính kèm</label>
                  <input id="docFiles" type="file" multiple className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={e => setPendingFiles(Array.from(e.target.files || []))} />
                  {pendingFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-500">{pendingFiles.length} file đã chọn: {pendingFiles.map(f => f.name).join(', ')}</div>
                  )}
                </div>
              </div>
              <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={uploading}>{uploading ? 'Đang tải lên...' : 'Thêm hồ sơ'}</button>
            </form>
            <div className="space-y-4">
              {documents.map(d => (
                <div key={d._id} className="p-4 border rounded-md flex justify-between items-start bg-gray-50">
                  <div>
                    <div className="font-medium">{labelDocType(d.type as any)} - {d.ownerUserId ? usersMap.get(d.ownerUserId) : ''}</div>
                    <div className="text-sm text-gray-600">{d.date} {d.code ? `• ${d.code}` : ''}</div>
                    {d.description && <div className="text-sm">{d.description}</div>}
                    {!!(d.files && d.files.length) && (
                      <ul className="text-sm list-disc pl-5">
                        {d.files.map(f => (
                          <li key={f._id}>
                            {buildFileUrl(f) ? (
                              <a className="text-blue-600 hover:underline" href={buildFileUrl(f)} target="_blank" rel="noreferrer">{f.originalName} ({Math.round(f.size / 1024)} KB)</a>
                            ) : (
                              <span>{f.originalName} ({Math.round(f.size / 1024)} KB)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button className="text-red-600 hover:underline" onClick={() => handleDeleteDocument(d._id!)}>Xóa</button>
                </div>
              ))}
              {!documents.length && <div className="text-sm text-gray-500 py-3">Chưa có hồ sơ.</div>}
            </div>
          </Section>
        </>
      )}

      {/* CHILDREN: DETAIL VIEW (read-only) */}
      {showChildrenView && (
        <>
          <Section title="Lịch sử sự kiện">
            <div className="space-y-2">
              {events.map((ev, idx) => (
                <div key={ev._id ?? `tmp-${ev.type}-${ev.date}-${idx}`} className="p-3 border rounded-md bg-white">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-medium">{labelEventType(ev.type as any)}</span>
                    <span className="text-gray-500">• {eventDateOf(ev)}</span>
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    {ev.toUserId && (<div><span className="text-gray-500">Người nhận:</span> {usersMap.get(ev.toUserId) || ev.toUserId}</div>)}
                    {ev.fromUserId && (<div><span className="text-gray-500">Người giao:</span> {usersMap.get(ev.fromUserId) || ev.fromUserId}</div>)}
                    {ev.note && (<div><span className="text-gray-500">Ghi chú:</span> {ev.note}</div>)}
                    {ev.cost && (<div><span className="text-gray-500">Chi phí :</span> {ev.cost.amount} {ev.cost.currency}</div>)}
                  </div>
                </div>
              ))}
              {!events.length && <div className="text-sm text-gray-500 py-3">Chưa có sự kiện.</div>}
            </div>
          </Section>

          <Section title="Hồ sơ tài liệu ">
            <div className="space-y-4">
              {documents.map(d => (
                <div key={d._id} className="p-4 border rounded-md bg-white">
                  <div className="font-medium">{labelDocType(d.type as any)} - {d.ownerUserId ? usersMap.get(d.ownerUserId) : ''}</div>
                  <div className="text-sm text-gray-600">{d.date} {d.code ? `• ${d.code}` : ''}</div>
                  {d.description && <div className="text-sm mt-1">{d.description}</div>}
                  {!!(d.files && d.files.length) && (
                    <ul className="text-sm list-disc pl-5 mt-2">
                      {d.files.map(f => (
                        <li key={f._id}>
                          {buildFileUrl(f) ? (
                            <a className="text-blue-600 hover:underline" href={buildFileUrl(f)} target="_blank" rel="noreferrer">{f.originalName} ({Math.round(f.size / 1024)} KB)</a>
                          ) : (
                            <span>{f.originalName} ({Math.round(f.size / 1024)} KB)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {!documents.length && <div className="text-sm text-gray-500 py-3">Không có Hồ sơ.</div>}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
