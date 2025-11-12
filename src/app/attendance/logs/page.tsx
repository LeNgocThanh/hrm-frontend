"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getDayNameFromDate } from "@/utils/date-helpers";
import useSWR from "swr";
import { UserWithOrganization } from "@/types";
import { Organization as OrganizationType } from "@/types/organization";

// ==== CONFIG ====
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;
const TZ = "Asia/Bangkok";
type ObjectId = string;

// Minimal types
interface LogRow {
  userId: string;
  userCode?: string;
  timestamp: string; // ISO
  kind?: "IN" | "OUT";
  [key: string]: any;
}

interface GroupRow {
  userId: string;
  userCode?: string;
  userName: string;
  dateKey: string; // YYYY-MM-DD (local TZ)
  times: string[]; // HH:mm (local TZ) sorted asc
}

type UserLite = { _id: ObjectId; fullName: string; email?: string; userCode?: string };

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
};

// ===== API helper (lenient JSON) =====
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
    headers: { Accept: "application/json, text/plain, */*", "Content-Type": "application/json", ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const txt = await res.text();
      if (isJson && txt) msg = (JSON.parse(txt).message || msg); else if (txt) msg = txt;
    } catch { }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  let txt = "";
  try { txt = await res.text(); } catch { return null; }
  if (!txt || !txt.trim()) return null;
  if (isJson) { try { return JSON.parse(txt); } catch { return { data: txt }; } }
  return { data: txt };
}

// Column mapping keys we expect
const REQUIRED_FIELDS = ["date"] as const;
const OPTIONAL_FIELDS = ["time1", "time2", "time3", "time4", "time5", "time6"] as const; // có thể chọn 1 hoặc 2
const USERINFO = ["userCode"] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS, ...USERINFO] as const;

type FieldKey = (typeof ALL_FIELDS)[number];

export default function AttendanceLogsPage() {
  // ===== EXPORT helpers =====
  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const rows = [
      { date: '2025-10-01', time1: '08:00', time2: '09:00', time3: '10:00', time4: '12:00', time5: '13:30', time6: '17:00', userCode: '' },
      { date: '2025-10-02', time1: '08:05', time2: '', time3: '', time4: '', time5: '', time6: '', userCode: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['date', 'time1', 'time2', 'time3', 'time4', 'time5', 'time6', 'userCode'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'logs_import_template.xlsx');
  }

  async function exportExcel() {
    const XLSX = await import('xlsx');
    const data = groupRows.map(r => ({ User: r.userName, UserCode: r.userCode, Date: r.dateKey, Timestamps: r.times.join(' - ') }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Logs');
    XLSX.writeFile(wb, `logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportDocx() {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType } = docx as any;

    const headerRow = new TableRow({
      children: [
        new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '#', alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, children: [new Paragraph('Họ tên')] }),
        new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, children: [new Paragraph('Mã nhân viên')] }),
        new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, children: [new Paragraph('Ngày công')] }),
        new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, children: [new Paragraph('Giờ công (HH:mm)')] }),
      ],
    });

    const rows = groupRows.map((r, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(String(i + 1))] }),
        new TableCell({ children: [new Paragraph(r.userName)] }),
        new TableCell({ children: [new Paragraph(r.userCode || '')] }),
        new TableCell({ children: [new Paragraph(r.dateKey)] }),
        new TableCell({ children: [new Paragraph(r.times.join(' - '))] }),
      ],
    }));

    const table = new Table({ rows: [headerRow, ...rows] });
    const doc = new Document({ sections: [{ properties: {}, children: [new Paragraph({ text: 'Dữ liệu chấm công', heading: 'Heading1' }), table] }] });
    const blob = await Packer.toBlob(doc);
    triggerDownload(blob, `logs_${new Date().toISOString().slice(0, 10)}.docx`);
  }

  async function exportPdf() {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const { default: NotoSans } = await import('@/../public/fonts/NotoSans-Regular.js');

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    // ✅ Nạp font Unicode
    doc.addFileToVFS('NotoSans-Regular.ttf', NotoSans);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.setFont('NotoSans');

    doc.setFontSize(14);

    doc.text('Dữ liệu chấm công', 40, 40);
    const body = groupRows.map((r, i) => [String(i + 1), r.userName, r.userCode || '', r.dateKey, r.times.join(' - ')]);
    // @ts-ignore
    autoTable(doc, {
      startY: 60, head: [['#', 'Họ tên', 'Mã nhân viên', 'Ngày công', 'Giờ công (HH:mm)']], body, styles: { fontSize: 9, cellPadding: 4, font: 'NotoSans' }, headStyles: { font: 'NotoSans', fontStyle: 'normal' },
      bodyStyles: { font: 'NotoSans', fontStyle: 'normal' },
    });
    doc.save(`logs_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ===== Filters =====
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState<string>(""); // yyyy-mm-dd
  const [to, setTo] = useState<string>("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [userCode, setUserCode] = useState("");
  const [nameFilter, setNameFilter] = useState<string>('');

  const EMPTY_USERS: UserWithOrganization[] = React.useMemo(() => [], []);
  const EMPTY_ORGS: OrganizationType[] = React.useMemo(() => [], []);

  const getAllSegmentsFromString = (fullString?: string) => {
  return fullString?.split('/').filter(Boolean) ?? [];
};

  const { data: usersData, error: usersError, isLoading: isLoadingUsers } = useSWR<UserWithOrganization[]>(
    `${API_BASE}/users/withOrganizationName`,
    fetcher<UserWithOrganization[]>,
    { revalidateOnFocus: false }
  );

  const { data: orgsData, error: orgsError, isLoading: isLoadingOrganizations } = useSWR<OrganizationType[]>(
    `${API_BASE}/organizations/under`,
    fetcher<OrganizationType[]>,
    { revalidateOnFocus: false }
  );

  const users = usersData ?? EMPTY_USERS;
  const organizations = orgsData ?? EMPTY_ORGS;

  const filteredUsers = useMemo(() => {
    let userData = users;
    if (selectedOrganizationId) {
    userData = userData.filter(user => {const segments = getAllSegmentsFromString(user.organizationPath);
    if(user.organizationId) {
    segments.push(user.organizationId);}
    return segments.includes(selectedOrganizationId);});
    }
    if (nameFilter) {
      const lowerCaseFilter = nameFilter.toLowerCase();
      userData = userData.filter(user => user.fullName.toLowerCase().includes(lowerCaseFilter));
    }
    if (userCode) {
      const code = userCode.trim();
      userData = userData.filter(user => (user as any).userCode?.includes(code));
    }
    return userData;
  }, [users, selectedOrganizationId, nameFilter, userCode]);

  const userMap = useMemo(() => new Map((users || []).map((u: any) => [String(u._id), u])), [users]);

  // ===== Logs state =====
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grouped + sorted rows (User asc, Date asc)
  const groupRows: GroupRow[] = useMemo(() => {
    const bucket = new Map<string, GroupRow>();
    for (const r of logs) {
      if (!r.timestamp || !r.userId) continue;
      const dateKey = toDateKeyLocal(new Date(r.timestamp), TZ);
      const userName = resolveUser(r.userId, userMap);
      const key = `${r.userId}__${dateKey}`;
      const time = toHHmmLocal(new Date(r.timestamp), TZ);
      if (!bucket.has(key)) {
        bucket.set(key, { userId: r.userId, userName, userCode: r.userCode, dateKey, times: [time] });
      } else {
        bucket.get(key)!.times.push(time);
      }
    }
    const arr = Array.from(bucket.values());
    for (const row of arr) row.times.sort((a, b) => a.localeCompare(b));
    arr.sort((a, b) => a.userName.localeCompare(b.userName, 'vi') || a.dateKey.localeCompare(b.dateKey));
    return arr;
  }, [logs, userMap]);

  // Pagination (client-side)
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(groupRows.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return groupRows.slice(start, start + PAGE_SIZE);
  }, [groupRows, page]);

  // ===== Import dialog state =====
  const [showImport, setShowImport] = useState(false);
  const [useUserCodeImport, setUseUserCodeImport] = useState(false); // NEW: toggle import theo mã NV
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<FieldKey, string | "">>({
    date: "",
    time1: "",
    time2: "",
    time3: "",
    time4: "",
    time5: "",
    time6: "",
    userCode: "",
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<LogRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ===== Fetch logs =====
  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const query: any = {};
      if (userId) query.userId = userId;
      if (!userId && userCode) query.userCode = userCode.trim(); // ưu tiên filter theo mã khi không chọn user
      if (from) query.from = utcStartOfDateInTz(from, TZ);
      if (to) query.to = utcEndOfDateInTz(to, TZ);
      let data: any;
      if (userId) { data = await api(`/attendance/logs/${userId}`, { query }); }
      else { data = await api('/attendance/logs', { query }); }
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const normalized: LogRow[] = items.map((r: any) => ({
        userId: String(r.userId ?? r.user_id ?? r._id ?? ""),
        userCode: r.userCode ? String(r.userCode) : (userMap.get(String(r.userId)) as any)?.userCode || "",
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : "",
        source: r.source ?? r.device ?? r.machine ?? "",
        _raw: r,
      })).filter((r: LogRow) => r.userId && r.timestamp);
      setLogs(normalized);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  };

  // ===== Build preview from header map (only when NOT using userCode import) =====
  useEffect(() => {
    if (useUserCodeImport) {
      setPreviewRows([]); setImportError(null); return;
    }
    if (!rawRows.length || !rawHeaders.length) { setPreviewRows([]); return; }
    try {
      const out: LogRow[] = [];
      if (!userId) { setImportError('Vui lòng chọn Nhân viên ở bộ lọc trước khi import. Hoặc bật \"Sử dụng mã nhân viên\".'); setPreviewRows([]); return; }
      for (const row of rawRows) {
        const dateCell = headerMap.date ? row[headerMap.date] : "";
        if (!dateCell) continue;
        const uid = String(userId).trim();
        for (let i = 1; i <= 6; i++) {
          const field = `time${i}` as FieldKey;
          const timeCell = headerMap[field] ? row[headerMap[field]] : "";
          if (timeCell) {
            const ts = combineDateAndTime(dateCell, timeCell);
            if (ts) out.push({ userId: uid, timestamp: ts });
          }
        }
      }
      setPreviewRows(out);
      setImportError(null);
    } catch (e: any) {
      setImportError(e?.message || 'Mapping failed');
      setPreviewRows([]);
    }
  }, [rawRows, rawHeaders, headerMap, useUserCodeImport, userId]);

  // ===== Import: upload to backend =====
  async function handleUpload() {
    setImportError(null);
    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) throw new Error('Chưa chọn file');

      if (useUserCodeImport) {
        // 1) Dùng endpoint multipart, backend tự đọc userCode trong file
        const payload = await buildPayloadFromUserCode(rawRows, headerMap);
        if (!payload.length) throw new Error("Không ánh xạ được userId từ bất kỳ userCode nào");

        const res = await fetch(`${API_BASE}/attendance/logs/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // 2) Dùng endpoint bulk theo user đã chọn
        if (!userId) throw new Error('Vui lòng chọn Nhân viên ở bộ lọc hoặc bật \"Sử dụng mã nhân viên\".');
        const bad = previewRows.filter((r) => !r.userId || !r.timestamp);
        if (bad.length) throw new Error(`Thiếu trường bắt buộc ở ${bad.length} dòng (userId/timestamp)`);
        const payload = previewRows.map(({ userId, timestamp }) => ({ userId, timestamp }));
        const res = await fetch(`${API_BASE}/attendance/logs/bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      await fetchLogs();
      setShowImport(false);
      resetImport();
    } catch (e: any) {
      setImportError(e?.message || 'Upload thất bại');
    }
  };

  function resetImport() {
    setRawHeaders([]); setRawRows([]);
    setHeaderMap({
      date: '',
      time1: '', time2: '', time3: '',
      time4: '', time5: '', time6: '',
      userCode: '',
    });
    setPreviewRows([]);
    setUseUserCodeImport(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== Parse local file (xlsx/csv) =====
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const { headers, rows } = await parseSpreadsheet(file);
      setRawHeaders(headers); setRawRows(rows);
      const lower = headers.map((h) => ({ h, k: h.toLowerCase() }));
      const find = (keys: string[]) => lower.find(({ k }) => keys.some((kk) => k.includes(kk)))?.h || '';
      setHeaderMap({
        date: find(['date', 'ngay', 'ngày', 'yyyy', 'tháng', 'day']),
        time1: find(['time 1', 'time1', 'giờ 1', '1', 'in']),
        time2: find(['time 2', 'time2', 'giờ 2', '2', 'out']),
        time3: find(['time 3', 'time3', 'giờ 3', '3']),
        time4: find(['time 4', 'time4', 'giờ 4', '4']),
        time5: find(['time 5', 'time5', 'giờ 5', '5']),
        time6: find(['time 6', 'time6', 'giờ 6', '6']),
        userCode: find(['manv', 'mã nhân viên', 'usercode', 'code']),
      });
    } catch (e: any) {
      setImportError(e?.message || 'Không đọc được file');
      resetImport();
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chấm công · Dữ liệu thô</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setShowImport(true)} className="px-3 py-2 rounded-xl border hover:bg-gray-50">Import Logs</button>
          <button onClick={fetchLogs} className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90">Tải dữ liệu</button>
          <div className="w-px h-6 bg-gray-300 mx-2" />
          <button onClick={downloadTemplate} className="px-3 py-2 rounded-xl border hover:bg-gray-50" title="Tải file mẫu nhập logs">File mẫu</button>
          <button onClick={exportExcel} className="px-3 py-2 rounded-xl border hover:bg-gray-50" title="Xuất Excel danh sách bên dưới">Xuất Excel</button>
          <button onClick={exportDocx} className="px-3 py-2 rounded-xl border hover:bg-gray-50" title="Xuất Word (DOCX) danh sách bên dưới">Xuất DOCX</button>
          <button onClick={exportPdf} className="px-3 py-2 rounded-xl border hover:bg-gray-50" title="Xuất PDF danh sách bên dưới">Xuất PDF</button>
        </div>
      </header>

      {/* Filters */}
      {usersError && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">Lỗi tải danh sách nhân viên: {String(usersError)}</div>
      )}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-3 bg-white p-4 rounded-xl shadow-sm">
        {/* Tổ chức */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Chọn Tổ Chức</label>
          <select
            value={selectedOrganizationId}
            onChange={(e) => setSelectedOrganizationId(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoadingOrganizations}
          >
            <option value="">Tất cả Tổ chức</option>
            {organizations.map((org) => (
              <option key={org._id} value={org._id}>{org.name}</option>
            ))}
          </select>
        </div>

        {/* Tên nhân viên */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Tìm Tên Nhân Viên</label>
          <input
            type="text"
            placeholder="Nhập tên nhân viên..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Mã nhân viên */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Mã nhân viên (userCode)</label>
          <input
            type="text"
            placeholder="Nhập mã nhân viên..."
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Chọn nhân viên */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Nhân viên</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Tất cả nhân viên</option>
            {(filteredUsers || []).map((u: any) => (
              <option key={String(u._id)} value={String(u._id)}>
                {u.fullName}{u.email ? ` — ${u.email}` : ""}{u.userCode ? ` — ${u.userCode}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Từ ngày */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Đến ngày + nút lọc */}
        <div className="flex flex-col justify-end">
          <label className="text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={fetchLogs}
              className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Lọc & Tải
            </button>
          </div>
        </div>
      </section>

      {/* Grouped Table */}
      <section className="border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Mã nhân viên</th>
                <th className="px-4 py-3">Ngày công</th>
                <th className="px-4 py-3">Giờ công (HH:mm)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6" colSpan={5}>Đang tải…</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-6 text-red-600" colSpan={5}>{error}</td></tr>
              ) : paged.length === 0 ? (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={5}>Không có dữ liệu</td></tr>
              ) : (
                paged.map((r, idx) => (
                  <tr key={`${r.userId}-${r.dateKey}`} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-2">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-2 font-medium">{r.userName}</td>
                    <td className="px-4 py-2">{r.userCode || ''}</td>
                    <td className="px-4 py-2">{getDayNameFromDate(r.dateKey)} - {r.dateKey}</td>
                    <td className="px-4 py-2 whitespace-pre-wrap">{r.times.join(' - ')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-gray-600">Trang {page}/{pageCount} — Tổng {groupRows.length} dòng</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 rounded-xl border disabled:opacity-50" disabled={page <= 1}>Trước</button>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="px-3 py-2 rounded-xl border disabled:opacity-50" disabled={page >= pageCount}>Sau</button>
          </div>
        </div>
      </section>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 space-y-4 max-h-screen overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Import Logs {resolveUser(userId, userMap)}</h2>
              <button onClick={() => { setShowImport(false); resetImport(); }} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <input
                  id="useUserCode"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useUserCodeImport}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const checked = e.currentTarget.checked;
                    setUseUserCodeImport(checked);
                    if (checked) setUserId("");
                  }}
                />
                <label htmlFor="useUserCode" className="text-sm text-gray-700">
                  Sử dụng mã nhân viên (userCode) trong file để xác định người dùng (tự động bỏ chọn nếu đang chọn).
                </label>
              </div>


              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="block w-full text-sm" />
              {importError && (<div className="text-sm text-red-600">{importError}</div>)}

              {!useUserCodeImport && !!rawHeaders.length && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {(ALL_FIELDS as ReadonlyArray<FieldKey>).map((field) => (
                    <div key={field} className="flex flex-col gap-1">
                      <label className="text-sm text-gray-600">Map to <span className="font-medium">{field}</span>{REQUIRED_FIELDS.includes(field as any) && (<span className="ml-1 text-red-600">*</span>)}</label>
                      <select value={headerMap[field]} onChange={(e) => setHeaderMap((m) => ({ ...m, [field]: e.target.value }))} className="px-3 py-2 rounded-xl border">
                        <option value="">— Chọn cột —</option>
                        {rawHeaders.map((h) => (<option key={`${field}-${h}`} value={h}>{h}</option>))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {!useUserCodeImport && !!previewRows.length && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="p-3 text-sm text-gray-600">Xem trước {previewRows.length} dòng (hiện tối đa 6)</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Họ tên</th>
                          <th className="px-3 py-2" colSpan={2}>Chấm công</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 6).map((r, idx) => (
                          <tr key={`prev-${idx}`} className="odd:bg-white even:bg-gray-50">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">{String(resolveUser(r.userId, userMap) || "")}</td>
                            <td className="px-3 py-2" colSpan={2}>{r.timestamp ? formatLocal(r.timestamp) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setShowImport(false); resetImport(); }} className="px-3 py-2 rounded-xl border">Hủy</button>
                <button
                  onClick={handleUpload}
                  className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
                  disabled={!fileInputRef.current?.files?.length || (!useUserCodeImport && previewRows.length === 0)}
                >
                  Tải lên
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Helpers =====
function resolveUser(u: any, map: Map<string, UserLite>) {
  if (typeof u === 'string') return map.get(u)?.fullName || u;
  const id = String(u?._id ?? '');
  return (u as any)?.fullName || map.get(id)?.fullName || id;
}

function tzOffsetMs(tz: string, d: Date) {
  if (tz === 'Asia/Bangkok') return 7 * 60 * 60 * 1000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUTC - d.getTime();
}
function utcStartOfDateInTz(dateKey: string, tz: string) {
  const [Y, M, D] = dateKey.split('-').map(Number);
  const pseudoUTC = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0, 0));
  const offset = tzOffsetMs(tz, pseudoUTC);
  return new Date(pseudoUTC.getTime() - offset).toISOString();
}
function utcEndOfDateInTz(dateKey: string, tz: string) {
  const [Y, M, D] = dateKey.split('-').map(Number);
  const pseudoUTC = new Date(Date.UTC(Y, M - 1, D, 23, 59, 59, 999));
  const offset = tzOffsetMs(tz, pseudoUTC);
  return new Date(pseudoUTC.getTime() - offset).toISOString();
}

function formatLocal(iso: string) {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(d);
}
function toDateKeyLocal(d: Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function toHHmmLocal(d: Date, tz: string) {
  const hh = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d);
  const mm = new Intl.DateTimeFormat('en-GB', { timeZone: tz, minute: '2-digit' }).format(d);
  return `${hh}:${mm}`;
}

// ===== XLSX/CSV parsing =====
async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: any[] }> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith(".csv")) { const text = await file.text(); return parseCsv(text); }
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
  const headers = extractHeadersFromSheet(ws, XLSX);
  return { headers, rows: json };
}
function extractHeadersFromSheet(ws: any, XLSX: any): string[] {
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    const cell = ws[addr]; headers.push(cell ? String(cell.v) : `Column_${C + 1}`);
  }
  return headers;
}
function parseCsv(text: string): { headers: string[]; rows: any[] } {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line); const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? "")); return obj;
  });
  return { headers, rows };
}
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur); return out.map((s) => s.trim());
}

// ===== Import helpers =====
function combineDateAndTime(dateCell: any, timeCell: any): string | null {
  const datePart = toDateFromCell(dateCell); const timePart = toTimePartsFromCell(timeCell);
  if (!datePart || !timePart) return null; const d = new Date(datePart);
  d.setHours(timePart.hh, timePart.mm, timePart.ss ?? 0, 0);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function toDateFromCell(v: any): Date | null {
  if (v == null) return null;
  if (typeof v === "number") { const base = excelSerialToDate(v); if (!base) return null; base.setHours(0, 0, 0, 0); return base; }
  if (v instanceof Date) { const d = new Date(v); d.setHours(0, 0, 0, 0); return isNaN(d.getTime()) ? null : d; }
  const s = String(v).trim(); if (!s) return null;
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) { const dd = +m1[1], MM = +m1[2] - 1, yyyy = +(m1[3].length === 2 ? "20" + m1[3] : m1[3]); const d = new Date(yyyy, MM, dd, 0, 0, 0, 0); return isNaN(d.getTime()) ? null : d; }
  const d = new Date(s); if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; } return null;
}
function toTimePartsFromCell(v: any): { hh: number; mm: number; ss?: number } | null {
  if (v == null) return null;
  if (typeof v === "number") { const totalSeconds = Math.round(v * 24 * 60 * 60); const hh = Math.floor(totalSeconds / 3600); const mm = Math.floor((totalSeconds % 3600) / 60); const ss = totalSeconds % 60; return { hh, mm, ss }; }
  if (v instanceof Date) { return { hh: v.getHours(), mm: v.getMinutes(), ss: v.getSeconds() }; }
  const s = String(v).trim(); if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) { const hh = +m[1], mm = +m[2], ss = m[3] ? +m[3] : undefined; if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60 && (ss == null || (ss >= 0 && ss < 60))) return { hh, mm, ss }; }
  return null;
}
function excelSerialToDate(serial: number): Date | null { const excelEpoch = new Date(Date.UTC(1899, 11, 30)); const millis = Math.round(serial * 24 * 60 * 60 * 1000); const d = new Date(excelEpoch.getTime() + millis); return isNaN(d.getTime()) ? null : d; }

async function buildPayloadFromUserCode(
  rawRows: any[],
  headerMap: Record<FieldKey, string | "">
): Promise<Array<{ userId: string; timestamp: string }>> {
  if (!rawRows.length) throw new Error("Chưa đọc được dữ liệu từ file. Hãy chọn file trước.");
  const dateCol = headerMap.date;
  const codeCol = headerMap.userCode;
  if (!dateCol || !codeCol) throw new Error("Thiếu cột bắt buộc: date hoặc userCode");

  // 1) tạo danh sách tạm { userCode, timestamp }
  const temp: { userCode: string; timestamp: string }[] = [];
  for (const row of rawRows) {
    const code = String(row[codeCol] ?? "").trim();
    if (!code) continue;
    const dateCell = row[dateCol];
    for (let i = 1; i <= 6; i++) {
      const key = `time${i}` as FieldKey;
      const timeCol = headerMap[key];
      const timeCell = timeCol ? row[timeCol] : "";
      if (!timeCell) continue;
      const ts = combineDateAndTime(dateCell, timeCell);
      if (ts) temp.push({ userCode: code, timestamp: ts });
    }
  }
  if (!temp.length) return [];

  // 2) prefetch userId theo mã
  const codeToUserId = await prefetchAssignmentsByCode(temp.map(r => r.userCode));

  // 3) build payload, loại bỏ dòng không map được
  const seen = new Set<string>();
  const payload = temp
    .map(r => ({ userId: codeToUserId.get(r.userCode) || "", timestamp: r.timestamp }))
    .filter(x => x.userId && x.timestamp)
    .filter(x => {
      const k = `${x.userId}|${x.timestamp}`;
      if (seen.has(k)) return false; // trùng trong payload
      seen.add(k);
      return true;
    });

  return payload;
}

async function prefetchAssignmentsByCode(codes: string[]) {
  const unique = Array.from(new Set(codes.filter(Boolean)));
  const codeToUserId = new Map<string, string>();

  await Promise.all(
    unique.map(async (code) => {
      const resp = await fetch(`${API_BASE}/user-assignments/code/${encodeURIComponent(code)}`, {
        credentials: "include",
      });
      if (!resp.ok) return;
      try {
        const data = await resp.json();
        const uid =
          String(data.userId?._id) || "";
        if (uid) codeToUserId.set(code, uid);
      } catch { }
    })
  );

  return codeToUserId;
}