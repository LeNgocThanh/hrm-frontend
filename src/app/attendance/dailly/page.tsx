"use client";

import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;
import { User } from '@/types';
import { apiClient } from '@/lib/api';
import useSWR, { mutate } from 'swr';
type ObjectId = string;

// Types — adjust to your daily schema
interface DailyRow {
  userId: string;
  date: string; // YYYY-MM-DD (local date key)
  status?: string; // e.g., PRESENT, ABSENT, LATE, etc.
  checkIn?: string | null; // ISO
  checkOut?: string | null; // ISO
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  shiftType?: string; // REGULAR, ...
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

function resolveUser(u: any, map: Map<string, UserLite>) {
    if (typeof u === 'string') return map.get(u)?.fullName || u;
    const id = String(u?._id ?? '');
    return u?.fullName || map.get(id)?.fullName || id;
}

export default function AttendanceDailyPage() {
  // filters
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // data
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  // edit modal state
  const [editing, setEditing] = useState<DailyRow | null>(null);
  const [editIn, setEditIn] = useState<string>(""); // HH:mm or empty
  const [editOut, setEditOut] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: users } = useSWR<UserLite[]>('/users/by-organization', p => fetcher(p), { revalidateOnFocus: false });
  const userMap = useMemo(() => new Map((users || []).map(u => [String(u._id), u])), [users]);

  async function fetchDaily() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${API_BASE}/attendance/daily?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: DailyRow[] = Array.isArray(data) ? data : (data.items ?? []);
      // normalize some fields
      const norm = items.map((d) => ({
        ...d,
        date: d.date ?? (d.dateKey ?? d._id?.date ?? ""),
        checkIn: d.checkIn ? new Date(d.checkIn).toISOString() : null,
        checkOut: d.checkOut ? new Date(d.checkOut).toISOString() : null,
      }));
      setRows(norm);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(r: DailyRow) {
    setEditing(r);
    setSaveError(null);
    setEditIn(r.checkIn ? toHHmmLocal(r.checkIn) : "");
    setEditOut(r.checkOut ? toHHmmLocal(r.checkOut) : "");
  }

  function closeEdit() {
    setEditing(null);
    setEditIn("");
    setEditOut("");
    setSaveError(null);
  }

  async function saveTimes() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      // build ISO from date + HH:mm (local)
      const body: any = {
        userId: editing.userId,
        workDate: editing.workDate, // YYYY-MM-DD
      };
      console.log('editIn', editIn, 'editOut', editOut);      
      if (editIn) body.checkIn = combineDateTimeISO(editing.workDate, editIn);
      if (editOut) body.checkOut = combineDateTimeISO(editing.workDate, editOut);

      console.log('body', body);

      const res = await fetch(`${API_BASE}/attendance/daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // optimistic update
      const updated = await res.json().catch(() => null);
      setRows((prev) => prev.map((x) => {
        if (x.userId === editing.userId && (x.date === editing.date)) {
          return {
            ...x,
            checkIn: body.checkIn ?? x.checkIn ?? null,
            checkOut: body.checkOut ?? x.checkOut ?? null,           
            ...(updated ?? {}),
          };
        }
        return x;
      }));

      closeEdit();
    } catch (e: any) {
      setSaveError(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance · Daily</h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchDaily} className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90">Tải dữ liệu</button>
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
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Đến ngày</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600"> </label>
          <button onClick={fetchDaily} className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:opacity-90">Lọc & Tải</button>
        </div>
      </section>

      {/* Table */}
      <section className="border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3">Công</th>
                <th className="px-4 py-3">Trễ/Ra sớm</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6" colSpan={9}>Đang tải…</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-6 text-red-600" colSpan={9}>{error}</td></tr>
              ) : paged.length === 0 ? (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={9}>Không có dữ liệu</td></tr>
              ) : (
                paged.map((r, idx) => (
                  <tr key={`${r.userId}-${r.workDate}-${idx}`} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-2">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-2">{r.workDate}</td>
                    <td className="px-4 py-2 font-medium">{resolveUser(r.userId, userMap)}</td>
                    <td className="px-4 py-2">{r.checkIn ? formatLocal(r.checkIn) : "—"}</td>
                    <td className="px-4 py-2">{r.checkOut ? formatLocal(r.checkOut) : "—"}</td>
                    <td className="px-4 py-2">{minsToHHmm(r.workedMinutes)}</td>
                    <td className="px-4 py-2">{minsToHHmm(r.lateMinutes)} / {minsToHHmm(r.earlyLeaveMinutes)}</td>
                    <td className="px-4 py-2">{r.status || ""}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => openEdit(r)} className="px-2 py-1 rounded-lg border hover:bg-gray-50">Sửa</button>
                    </td>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-2 rounded-xl border disabled:opacity-50" disabled={page <= 1}>Trước</button>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="px-3 py-2 rounded-xl border disabled:opacity-50" disabled={page >= pageCount}>Sau</button>
          </div>
        </div>
      </section>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Sửa thời gian · {editing.userId} · {editing.date}</h2>
              <button onClick={closeEdit} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600">Check-in (HH:mm)</label>
                <input type="time" value={editIn} onChange={(e) => setEditIn(e.target.value)} className="px-3 py-2 rounded-xl border" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600">Check-out (HH:mm)</label>
                <input type="time" value={editOut} onChange={(e) => setEditOut(e.target.value)} className="px-3 py-2 rounded-xl border" />
              </div>
            </div>

            {saveError && <div className="text-sm text-red-600">{saveError}</div>}

            <div className="flex items-center justify-end gap-2">
              <button onClick={closeEdit} className="px-3 py-2 rounded-xl border">Hủy</button>
              <button onClick={saveTimes} disabled={saving} className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Helpers =====
function formatLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function toHHmmLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function minsToHHmm(mins?: number) {
  if (!mins || mins <= 0) return "0:00";
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function combineDateTimeISO(dateKey: string, hhmm: string) {
  // dateKey: YYYY-MM-DD (local)
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const dt = new Date(y, (m - 1), d, hh, mm, 0, 0); // local time
  return dt.toISOString();
}
