"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { User } from '@/types';
import { apiClient } from '@/lib/api';
import useSWR, { mutate } from 'swr';
// ==== CONFIG ====
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const USE_MULTIPART = false; // true => send raw file to backend; false => send normalized JSON rows
const PAGE_SIZE = 20;
type ObjectId = string;

// Minimal types
interface LogRow {
    userId: string;
    timestamp: string; // ISO string (được ghép từ date + time)
    kind?: "IN" | "OUT"; // dùng để preview
    [key: string]: any;
}

type UserLite = { _id: ObjectId; fullName: string; email?: string };

async function api(path: string, opts: any = {}) {
    const { method, query, body, headers } = opts;
    const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
    const qs = query ? '?' + new URLSearchParams(Object.entries(query).reduce((a, [k, v]) => {
        if (v == null) return a; a[k] = typeof v === 'object' ? JSON.stringify(v) : String(v); return a;
    }, {} as Record<string, string>)).toString() : '';
    const res = await fetch(`${url}${qs}`, {
        method: method || (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
const fetcher = (p: string, q?: Record<string, any>) => api(p, { query: q });
async function fetchList<T = any>(p: string, q?: Record<string, any>): Promise<T[]> {
    const data = await fetcher(p, q);
    return Array.isArray(data) ? data : (data?.items ?? []);
}

function resolveUser(u: any, map: Map<string, UserLite>) {
    if (typeof u === 'string') return map.get(u)?.fullName || u;
    const id = String(u?._id ?? '');
    return u?.fullName || map.get(id)?.fullName || id;
}



// Column mapping keys we expect
const REQUIRED_FIELDS = ["userId", "date"] as const;
const OPTIONAL_FIELDS = ["timeIn", "timeOut"] as const; // có thể chọn 1 hoặc 2
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

type FieldKey = (typeof ALL_FIELDS)[number];

export default function AttendanceLogsPage() {
    // Filters
    const [userId, setUserId] = useState("");
    const [from, setFrom] = useState<string>(""); // yyyy-mm-dd
    const [to, setTo] = useState<string>("");
    const { data: users } = useSWR<UserLite[]>('/users/by-organization', p => fetcher(p), { revalidateOnFocus: false });
    const userMap = useMemo(() => new Map((users || []).map(u => [String(u._id), u])), [users]);

    // Logs state
    const [logs, setLogs] = useState<LogRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination (client-side)
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
    const pagedLogs = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return logs.slice(start, start + PAGE_SIZE);
    }, [logs, page]);

    // Import dialog state
    const [showImport, setShowImport] = useState(false);
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<any[]>([]);
    const [headerMap, setHeaderMap] = useState<Record<FieldKey, string | "">>({
        userId: "",
        date: "",
        timeIn: "",
        timeOut: "",
    });
    const [importError, setImportError] = useState<string | null>(null);
    const [previewRows, setPreviewRows] = useState<LogRow[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Fetch logs
    async function fetchLogs() {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (userId) params.set("userId", userId);
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            const res = await fetch(`${API_BASE}/attendance/logs?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // Accept both array or {items: []}
            const items = Array.isArray(data) ? data : data.items || [];
            // Normalize minimal shape
            const normalized: LogRow[] = items.map((r: any) => ({
                userId: String(r.userId ?? r.user_id ?? ""),
                timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : "",
                source: r.source ?? r.device ?? r.machine ?? "",
                _raw: r,
            }));
            setLogs(normalized);
            setPage(1);
        } catch (e: any) {
            setError(e?.message || "Fetch failed");
        } finally {
            setLoading(false);
        }
    }

    // Build preview from header map
    useEffect(() => {
        if (!rawRows.length || !rawHeaders.length) {
            setPreviewRows([]);
            return;
        }
        try {
            const out: LogRow[] = [];
            for (const row of rawRows) {
                const uid = headerMap.userId ? String(row[headerMap.userId]).trim() : "";
                const dateCell = headerMap.date ? row[headerMap.date] : "";
                const timeInCell = headerMap.timeIn ? row[headerMap.timeIn] : "";
                const timeOutCell = headerMap.timeOut ? row[headerMap.timeOut] : "";

                if (!uid || !dateCell) continue;

                if (timeInCell) {
                    const ts = combineDateAndTime(dateCell, timeInCell);
                    if (ts) out.push({ userId: uid, timestamp: ts, kind: "IN" });
                }
                if (timeOutCell) {
                    const ts = combineDateAndTime(dateCell, timeOutCell);
                    if (ts) out.push({ userId: uid, timestamp: ts, kind: "OUT" });
                }
            }
            setPreviewRows(out);
            setImportError(null);
        } catch (e: any) {
            setImportError(e?.message || "Mapping failed");
            setPreviewRows([]);
        }
    }, [rawRows, rawHeaders, headerMap]);

    // Import: upload to backend
    async function handleUpload() {
        setImportError(null);
        try {
            if (USE_MULTIPART) {
                // Send the original file to backend (backend parses itself)
                const file = fileInputRef.current?.files?.[0];
                if (!file) throw new Error("Chưa chọn file");
                const form = new FormData();
                form.set("file", file);
                const res = await fetch(`${API_BASE}/attendance/logs/import`, {
                    method: "POST",
                    body: form,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            } else {
                // Send normalized JSON rows
                // Validate required fields
                const bad = previewRows.filter((r) => !r.userId || !r.timestamp);
                if (bad.length) {
                    throw new Error(`Thiếu trường bắt buộc ở ${bad.length} dòng (userId/timestamp)`);
                }
                const payload = previewRows.map(({ userId, timestamp }) => ({ userId, timestamp }));
                const res = await fetch(`${API_BASE}/attendance/logs/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
            // Refresh table
            await fetchLogs();
            // Close dialog
            setShowImport(false);
            resetImport();
        } catch (e: any) {
            setImportError(e?.message || "Upload thất bại");
        }
    }

    function resetImport() {
        setRawHeaders([]);
        setRawRows([]);
        setHeaderMap({ userId: "", date: "", timeIn: "", timeOut: "" });;
        setPreviewRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    // Parse local file (xlsx/csv)
    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        setImportError(null);
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const { headers, rows } = await parseSpreadsheet(file);
            setRawHeaders(headers);
            setRawRows(rows);
            // naive auto-detect
            const lowerHeaders = headers.map((h) => ({ h, k: h.toLowerCase() }));
            const find = (keys: string[]) =>
                lowerHeaders.find(({ k }) => keys.some((kk) => k.includes(kk)))?.h || "";

            setHeaderMap({
                userId: find(["userid", "user_id", "ma nv", "manv", "employee", "uid", "mã nhân viên", "nhân viên", "id"]),
                date: find(["date", "ngay", "ngày", "yyyy", "tháng", "day"]),
                timeIn: find(["in", "gio vao", "giờ vào", "check in", "time in", "vào"]),
                timeOut: find(["out", "gio ra", "giờ ra", "check out", "time out", "ra"]),
            });
        } catch (e: any) {
            setImportError(e?.message || "Không đọc được file");
            resetImport();
        }
    }

    return (
        <div className="mx-auto max-w-7xl p-6 space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold tracking-tight">Attendance · Logs</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowImport(true)}
                        className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                    >
                        Import Logs
                    </button>
                    <button
                        onClick={fetchLogs}
                        className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90"
                    >
                        Tải dữ liệu
                    </button>
                </div>
            </header>

            {/* Filters */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Nhân viên</label>
                    <select
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2"
                        disabled={!users}  // khi chưa tải xong
                    >
                        <option value="">Tất cả nhân viên</option>
                        {(users || []).map((u) => (
                            <option key={String(u._id)} value={String(u._id)}>
                                {u.fullName}{u.email ? ` — ${u.email}` : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Từ ngày</label>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Đến ngày</label>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600"> </label>
                    <button
                        onClick={fetchLogs}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:opacity-90"
                    >
                        Lọc & Tải
                    </button>
                </div>
            </section>

            {/* Table */}
            <section className="border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr className="text-left">
                                <th className="px-4 py-3">#</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td className="px-4 py-6" colSpan={3}>Đang tải…</td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td className="px-4 py-6 text-red-600" colSpan={3}>{error}</td>
                                </tr>
                            ) : pagedLogs.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-6 text-gray-500" colSpan={3}>Không có dữ liệu</td>
                                </tr>
                            ) : (
                                pagedLogs.map((r, idx) => (
                                    <tr key={`${r.userId}-${r.timestamp}-${idx}`} className="odd:bg-white even:bg-gray-50">
                                        <td className="px-4 py-2">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td className="px-4 py-2 font-medium">{resolveUser(r.userId, userMap)}</td>
                                        <td className="px-4 py-2">{formatLocal(r.timestamp)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
                    <div className="text-sm text-gray-600">Trang {page}/{pageCount}</div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-2 rounded-xl border disabled:opacity-50"
                            disabled={page <= 1}
                        >
                            Trước
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                            className="px-3 py-2 rounded-xl border disabled:opacity-50"
                            disabled={page >= pageCount}
                        >
                            Sau
                        </button>
                    </div>
                </div>
            </section>

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <h2 className="text-lg font-semibold">Import Logs</h2>
                            <button onClick={() => { setShowImport(false); resetImport(); }} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
                        </div>

                        <div className="space-y-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFile}
                                className="block w-full text-sm"
                            />
                            {importError && (
                                <div className="text-sm text-red-600">{importError}</div>
                            )}

                            {/* Column Mapper */}
                            {!!rawHeaders.length && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    {(ALL_FIELDS as ReadonlyArray<FieldKey>).map((field) => (
                                        <div key={field} className="flex flex-col gap-1">
                                            <label className="text-sm text-gray-600">
                                                Map to <span className="font-medium">{field}</span>
                                                {REQUIRED_FIELDS.includes(field as any) && (
                                                    <span className="ml-1 text-red-600">*</span>
                                                )}
                                            </label>
                                            <select
                                                value={headerMap[field]}
                                                onChange={(e) => setHeaderMap((m) => ({ ...m, [field]: e.target.value }))}
                                                className="px-3 py-2 rounded-xl border"
                                            >
                                                <option value="">— Chọn cột —</option>
                                                {rawHeaders.map((h) => (
                                                    <option key={`${field}-${h}`} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Preview */}
                            {!!previewRows.length && (
                                <div className="border rounded-xl overflow-hidden">
                                    <div className="p-3 text-sm text-gray-600">
                                        Xem trước {previewRows.length} dòng (hiện tối đa 50)
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr className="text-left">
                                                    <th className="px-3 py-2">#</th>
                                                    <th className="px-3 py-2">userId</th>
                                                    <th className="px-3 py-2">timestamp</th>
                                                    <th className="px-3 py-2">Loại</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewRows.slice(0, 5).map((r, idx) => (
                                                    <tr key={`prev-${idx}`} className="odd:bg-white even:bg-gray-50">
                                                        <td className="px-3 py-2">{idx + 1}</td>
                                                        <td className="px-3 py-2">{String(r.userId || "")}</td>
                                                        <td className="px-3 py-2">{r.timestamp ? formatLocal(r.timestamp) : ""}</td>
                                                        <td className="px-3 py-2">{r.kind || ""}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => { setShowImport(false); resetImport(); }}
                                    className="px-3 py-2 rounded-xl border"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
                                    disabled={USE_MULTIPART ? !fileInputRef.current?.files?.length : previewRows.length === 0}
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
function formatLocal(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "medium",
    }).format(d);
}

function toIsoFromCell(v: any): string | null {
    // Try:
    // - native Date
    // - Excel serial number
    // - parseable string
    if (v == null) return null;
    // number => maybe Excel serial date
    if (typeof v === "number") {
        const d = excelSerialToDate(v);
        return d ? d.toISOString() : null;
    }
    // Date
    if (v instanceof Date) {
        return isNaN(v.getTime()) ? null : v.toISOString();
    }
    // string
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
    // Try dd/mm/yyyy hh:mm or dd-mm-yyyy hh:mm
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const dd = Number(m[1]);
        const MM = Number(m[2]) - 1;
        const yyyy = Number(m[3].length === 2 ? "20" + m[3] : m[3]);
        const hh = Number(m[4] || 0);
        const mm = Number(m[5] || 0);
        const ss = Number(m[6] || 0);
        const d2 = new Date(yyyy, MM, dd, hh, mm, ss, 0);
        return isNaN(d2.getTime()) ? null : d2.toISOString();
    }
    return null;
}

function excelSerialToDate(serial: number): Date | null {
    // Excel's epoch: 1899-12-30 for Windows (with 1900 leap-year bug)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = Math.round(serial * 24 * 60 * 60 * 1000);
    const d = new Date(excelEpoch.getTime() + millis);
    return isNaN(d.getTime()) ? null : d;
}

// ===== XLSX/CSV parsing without import errors =====
async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: any[] }> {
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".csv")) {
        const text = await file.text();
        return parseCsv(text);
    }
    // XLSX/XLS using dynamic import (works in Next.js client)
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
        const cell = ws[addr];
        headers.push(cell ? String(cell.v) : `Column_${C + 1}`);
    }
    return headers;
}

function parseCsv(text: string): { headers: string[]; rows: any[] } {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = splitCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
        const cells = splitCsvLine(line);
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
        return obj;
    });
    return { headers, rows };
}

function splitCsvLine(line: string): string[] {
    // very naive CSV split; for robust cases use PapaParse
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === "," && !inQ) {
            out.push(cur); cur = "";
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out.map((s) => s.trim());
}

function combineDateAndTime(dateCell: any, timeCell: any): string | null {
    const datePart = toDateFromCell(dateCell);
    const timePart = toTimePartsFromCell(timeCell);
    if (!datePart || !timePart) return null;
    const d = new Date(datePart);
    d.setHours(timePart.hh, timePart.mm, timePart.ss ?? 0, 0);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateFromCell(v: any): Date | null {
    if (v == null) return null;
    if (typeof v === "number") {
        const base = excelSerialToDate(v);
        if (!base) return null;
        base.setHours(0, 0, 0, 0);
        return base;
    }
    if (v instanceof Date) {
        const d = new Date(v); d.setHours(0, 0, 0, 0); return isNaN(d.getTime()) ? null : d;
    }
    const s = String(v).trim();
    if (!s) return null;
    // dd/mm/yyyy hoặc yyyy-mm-dd
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m1) {
        const dd = Number(m1[1]); const MM = Number(m1[2]) - 1; const yyyy = Number(m1[3].length === 2 ? "20" + m1[3] : m1[3]);
        const d = new Date(yyyy, MM, dd, 0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
    return null;
}

function toTimePartsFromCell(v: any): { hh: number; mm: number; ss?: number } | null {
    if (v == null) return null;
    if (typeof v === "number") {
        // Excel time-of-day dạng phần của 1 ngày (0.5 = 12:00)
        const totalSeconds = Math.round(v * 24 * 60 * 60);
        const hh = Math.floor(totalSeconds / 3600);
        const mm = Math.floor((totalSeconds % 3600) / 60);
        const ss = totalSeconds % 60;
        return { hh, mm, ss };
    }
    if (v instanceof Date) {
        return { hh: v.getHours(), mm: v.getMinutes(), ss: v.getSeconds() };
    }
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
        const hh = Number(m[1]); const mm = Number(m[2]); const ss = m[3] ? Number(m[3]) : undefined;
        if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60 && (ss == null || (ss >= 0 && ss < 60))) return { hh, mm, ss };
    }
    return null;
}


