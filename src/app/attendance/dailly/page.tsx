"use client";

import React, { useEffect, useMemo, useState } from "react";
import {AT_STATUS, STATUS_OPTIONS_AT} from '@/i18n/attendance.vi'

// Env
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// --- Types khớp backend mới ---
interface DailySessionActual {
  checkIn?: string | null;
  checkOut?: string | null;
  checkIn_Edit?: string | null; // nếu backend trả
  checkOut_Edit?: string | null; // nếu backend trả
  workedMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  fulfilled?: boolean;
  firstIn?: string | null;
  lastOut?: string | null;
}

interface DailyRow {
  userId: string;
  dateKey: string;
  status?: string;
  workedMinutes?: number;
  actualPresenceMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  shiftType?: string;
  am?: DailySessionActual;
  pm?: DailySessionActual;
  ov?: DailySessionActual; // NEW
  isManualEdit?: boolean;  // NEW (ở cấp ngày)
  editNote?: string;       // NEW (ở cấp ngày)
  [key: string]: any;
}

interface UserLite { _id: string; fullName: string; email?: string }

// --- fetch util ---
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

  // No content / empty body handling (e.g., PUT/DELETE 204 No Content)
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

const dailyFetcher = (path: string) => api(path);

export default function DailyAttendancePage() {
  const [userId, setUserId] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<DailyRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const tz = "Asia/Bangkok";
  const todayKey = useMemo(() => toDateKeyLocal(new Date(), tz), []);
  const [filterFrom, setFilterFrom] = useState<string>(firstDayOfMonth(todayKey));
  const [filterTo, setFilterTo] = useState<string>(todayKey);

  // State chỉnh sửa per-session + note
  const [editTimes, setEditTimes] = useState<{
    date: string;
    shiftType: string;
    amIn: string; amOut: string;
    pmIn: string; pmOut: string;
    ovIn: string; ovOut: string; // cho phép nhập >24: "26:30"
    editNote: string;
  }>({ date: "", shiftType: "REGULAR", amIn: "", amOut: "", pmIn: "", pmOut: "", ovIn: "", ovOut: "", editNote: "" });

  // Users
  const { data: users, isLoading: isLoadingUsers } = useSWR<UserLite[]>("/users/by-organization", api);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateRange = useMemo(() => ({ from: "2024-01-01", to: today }), [today]);

  // Daily
  const swrKey = useMemo(() => {
    if (!userId) return null;
    const params = new URLSearchParams({ userId, from: filterFrom, to: filterTo });
    return `/attendance/daily?${params.toString()}`;
  }, [userId, filterFrom, filterTo]);


  const { data: dailyData, isLoading: isLoadingDaily, error, mutate } = useSWR<{ data: DailyRow[] }>(swrKey, dailyFetcher);
  const dailyRows: DailyRow[] = useMemo(() => {
    const arr = (dailyData as any)?.data || dailyData;
    const rows = Array.isArray(arr) ? [...arr] : [];
    return rows.reverse();
  }, [dailyData]);

  const openEdit = (row: DailyRow) => {
    setSelectedRow(row);

    const canAM = !!row.am;
    const canPM = !!row.pm;
    const canOV = !!row.ov;

    const amIn = canAM ? pickDisplayTime(row.am?.checkIn_Edit, row.am?.firstIn) : "";
    const amOut = canAM ? pickDisplayTime(row.am?.checkOut_Edit, row.am?.lastOut) : "";
    const pmIn = canPM ? pickDisplayTime(row.pm?.checkIn_Edit, row.pm?.firstIn) : "";
    const pmOut = canPM ? pickDisplayTime(row.pm?.checkOut_Edit, row.pm?.lastOut) : "";

    // OV: nếu ISO thuộc ngày hôm sau → hiển thị HH:mm overflow (cộng 24h)
    const ovIn = canOV ? toOverflowDisplay(row.dateKey, row.ov?.checkIn_Edit || row.ov?.firstIn) : "";
    const ovOut = canOV ? toOverflowDisplay(row.dateKey, row.ov?.checkOut_Edit || row.ov?.lastOut) : "";

    setEditTimes({
      date: row.dateKey,
      shiftType: row.shiftType || "REGULAR",
      amIn, amOut,
      pmIn, pmOut,
      ovIn, ovOut,
      editNote: row.editNote || "",
    });
  };


  const closeEdit = () => { setSelectedRow(null); setSaveError(null); setSaving(false); };

  const saveTimes = async () => {
    if (!selectedRow) return;
    setSaving(true); setSaveError(null);

    // Validate HH:mm (chỉ validate các code tồn tại trong ngày)
    const invalids: string[] = [];
    const check = (label: string, v: string, opts?: { ovOut?: boolean }) => {
      if (!v) return;
      if (!isValidHHmm(v)) invalids.push(`${label} phải là HH:mm`);
      if (opts?.ovOut && !isValidOvOut(v)) invalids.push(`${label} (OV) phải > 24:00 (VD: 26:30)`);
    };
    if (selectedRow.am) { check('AM In', editTimes.amIn); check('AM Out', editTimes.amOut); }
    if (selectedRow.pm) { check('PM In', editTimes.pmIn); check('PM Out', editTimes.pmOut); }
    if (selectedRow.ov) { check('OV In', editTimes.ovIn); check('OV Out', editTimes.ovOut, { ovOut: true }); }

    if (invalids.length) { setSaving(false); setSaveError(invalids.join('; ')); return; }

    // Xây payload times theo code có trong sessions
    const times: any = {};
    if (selectedRow.am && (editTimes.amIn || editTimes.amOut)) times["AM"] = withPair(editTimes.amIn, editTimes.amOut);
    if (selectedRow.pm && (editTimes.pmIn || editTimes.pmOut)) times["PM"] = withPair(editTimes.pmIn, editTimes.pmOut);
    if (selectedRow.ov && (editTimes.ovIn || editTimes.ovOut)) times["OV"] = withPair(editTimes.ovIn, editTimes.ovOut);

    const payload = {
      userId: selectedRow.userId,
      dateKey: selectedRow.dateKey,
      shiftType: editTimes.shiftType,
      times,
      editNote: editTimes.editNote,
      isManualEdit: true,
    };

    try {
      await api(`/attendance/times`, { method: "PUT", body: payload });
      mutate();
      closeEdit();
    } catch (e: any) {
      setSaveError(e.message || "Lưu thất bại");
    } finally { setSaving(false); }
  };


  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-3 flex items-center gap-3">
          Bảng Chấm Công Hàng Ngày
        </h1>

        {/* User picker */}
        <div className="mb-6 flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl shadow-md">
          <label className="text-gray-700 font-medium">Chọn Nhân viên:</label>
          {isLoadingUsers ? (
            <div className="text-gray-500 p-2">Đang tải danh sách…</div>
          ) : (
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn nhân viên --</option>
              {(users || []).map((u) => (
                <option key={String(u._id)} value={String(u._id)}>
                  {u.fullName}{u.email ? ` — ${u.email}` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="text-sm text-gray-600">Khoảng:</span>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg"
            />
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => { setFilterFrom(firstDayOfMonth(todayKey)); setFilterTo(todayKey); }}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-gray-50"
                title="Đầu tháng → hôm nay"
              >Theo tháng</button>
              <button
                type="button"
                onClick={() => { setFilterFrom(firstDayOfWeek(todayKey)); setFilterTo(todayKey); }}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-gray-50"
                title="Thứ 2 tuần này → hôm nay"
              >Theo tuần</button>
              <button
                type="button"
                onClick={() => { setFilterFrom(todayKey); setFilterTo(todayKey); }}
                className="px-3 py-1.5 text-sm rounded-lg border bg-white hover:bg-gray-50"
                title="Chỉ hôm nay"
              >Theo ngày</button>
            </div>
          </div>

        </div>

        {/* Content */}
        {!userId ? (
          <div className="p-8 text-center text-gray-600 bg-white rounded-xl shadow-lg border">
            Vui lòng chọn một nhân viên để xem dữ liệu.
          </div>
        ) : (
          <>
            {isLoadingDaily && (
              <div className="flex items-center justify-center p-8 bg-white rounded-xl shadow text-blue-600">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0a12 12 0 100 24v-4z" />
                </svg>
                Đang tải dữ liệu…
              </div>
            )}

            {!isLoadingDaily && dailyRows.length > 0 && (
              <div className="overflow-x-auto bg-white rounded-xl shadow border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Ngày</th>
                      <th className="px-4 py-3 text-left">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Giờ hợp lệ</th>
                      <th className="px-4 py-3 text-center">Ca sáng (Vào/Ra)</th>
                      <th className="px-4 py-3 text-center">Ca chiều (Vào/Ra)</th>
                      <th className="px-4 py-3 text-center">Ca quá ngày (Vào/Ra)</th>
                      <th className="px-4 py-3 text-right">Đi muộn</th>
                      <th className="px-4 py-3 text-right">Về sớm</th>
                      <th className="px-4 py-3 text-right">Note</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyRows.map((row) => (
                      <tr key={row.dateKey} className="hover:bg-blue-50/40">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                          {row.dateKey}
                          {row.isManualEdit && (
                            <span title={row.editNote || "Sửa tay"} className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              ✍️ Sửa tay
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold ${getStatusColor(row.status)}`}>{STATUS_OPTIONS_AT.find(option => option.value === row.status)?.label|| "N/A"}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{minsToHHmm(row.workedMinutes)}</td>
                        <td className="px-4 py-3 text-xs text-center">
                          <span className="font-semibold">{toHHmmLocal(row.am?.checkIn_Edit || row.am?.firstIn)}</span>
                          {" / "}
                          <span className="text-gray-500">{toHHmmLocal(row.am?.checkOut_Edit || row.am?.lastOut)}</span>
                          {row.am?.fulfilled && <span className="text-green-500 ml-1">✅</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-center">
                          <span className="font-semibold">{toHHmmLocal(row.pm?.checkIn_Edit || row.pm?.firstIn)}</span>
                          {" / "}
                          <span className="text-gray-500">{toHHmmLocal(row.pm?.checkOut_Edit || row.pm?.lastOut)}</span>
                          {row.pm?.fulfilled && <span className="text-green-500 ml-1">✅</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-center">
                          <span className="font-semibold">{toHHmmLocal(row.ov?.checkIn_Edit || row.ov?.firstIn)}</span>
                          {" / "}
                          <span className="text-gray-500">{toHHmmLocal(row.ov?.checkOut_Edit || row.ov?.lastOut)}</span>
                          {row.ov?.fulfilled && <span className="text-green-500 ml-1">✅</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{minsToHHmm(row.lateMinutes)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{minsToHHmm(row.earlyLeaveMinutes)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{row.editNote}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEdit(row)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm bg-blue-50 px-3 py-1 rounded-full">Sửa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoadingDaily && dailyRows.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow">
                Không có dữ liệu.
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal chỉnh theo từng code */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl space-y-4">
            <h2 className="text-xl font-bold border-b pb-2 text-gray-800 flex items-center gap-2">
              Chỉnh sửa giờ ({selectedRow.dateKey})
              {selectedRow.isManualEdit && (
                <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200" title={selectedRow.editNote || "Sửa tay"}>
                  ✍️ Sửa tay
                </span>
              )}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* AM */}
              {/* AM */}
              {selectedRow?.am && (
                <SessionEditor
                  title="AM"
                  inValue={editTimes.amIn}
                  outValue={editTimes.amOut}
                  onChange={(inValue, outValue) => setEditTimes((p) => ({ ...p, amIn: inValue, amOut: outValue }))}
                />
              )}

              {/* PM */}
              {selectedRow?.pm && (
                <SessionEditor
                  title="PM"
                  inValue={editTimes.pmIn}
                  outValue={editTimes.pmOut}
                  onChange={(inValue, outValue) => setEditTimes((p) => ({ ...p, pmIn: inValue, pmOut: outValue }))}
                />
              )}

              {/* OV */}
              {selectedRow?.ov && (
                <SessionEditor
                  title="OV"
                  inValue={editTimes.ovIn}
                  outValue={editTimes.ovOut}
                  placeholderOutHint="Cho phép >24h, ví dụ 26:30"
                  onChange={(inValue, outValue) => setEditTimes((p) => ({ ...p, ovIn: inValue, ovOut: outValue }))}
                />
              )}



              {/* Note chung cấp ngày */}
              <div className="md:col-span-3">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Ghi chú chỉnh tay (hiển thị ở cấp ngày)</label>
                <textarea
                  value={editTimes.editNote}
                  onChange={(e) => setEditTimes((p) => ({ ...p, editNote: e.target.value }))}
                  className="p-3 border border-gray-300 rounded-lg w-full focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Lý do/ghi chú khi sửa tay…"
                />
              </div>
            </div>

            {saveError && <div className="p-3 text-red-600 bg-red-100 rounded-lg text-sm">{saveError}</div>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setSelectedRow(null)} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100">Hủy</button>
              <button
                onClick={saveTimes}
                disabled={saving || isEmptyEdits(editTimes, selectedRow)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Lưu & Tính lại"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Session editor component ---
function SessionEditor({ title, inValue, outValue, onChange, placeholderOutHint }: {
  title: "AM" | "PM" | "OV";
  inValue: string;
  outValue: string;
  onChange: (inVal: string, outVal: string) => void;
  placeholderOutHint?: string;
}) {
  const isOV = title === "OV";
  return (
    <div className="bg-gray-50 rounded-lg border p-3">
      <div className="font-semibold text-gray-800 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">
            Check In (HH:mm{isOV ? " — OV có thể >24h" : ""})
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder={isOV ? "HH:mm (VD: 25:10)" : "HH:mm"}
            value={inValue}
            onChange={(e) => onChange(e.target.value, outValue)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">
            Check Out (HH:mm{isOV ? " — OV >24:00" : ""})
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder={isOV ? (placeholderOutHint || "VD: 26:30 (OV)") : (placeholderOutHint || "HH:mm")}
            value={outValue}
            onChange={(e) => onChange(inValue, e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
          {isOV && (
            <p className="text-[10px] text-gray-500 mt-1">
              Check Out của OV có thể &gt; 24:00 (ví dụ 26:30)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


// --- helpers ---
function pickDisplayTime(edit?: string | null, raw?: string | null) {
  const v = edit || raw || "";
  const hhmm = toHHmmLocal(v);
  return hhmm === "---" ? "" : hhmm;
}

function getStatusColor(status?: string | null) {
  switch (status) {
    case "FULL": return "text-green-600";
    case "HALF_AM":
    case "HALF_PM":
    case "PRESENT": return "text-yellow-600";
    case "ABSENT": return "text-red-600";
    default: return "text-gray-500";
  }
}

function toHHmmLocal(iso?: string | null) {
  if (!iso) return "---";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "---";
  try {
    const formatted = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Bangkok",
    }).format(d);
    return formatted;
  } catch {
    return "---";
  }
}

function minsToHHmm(mins?: number) {
  if (mins === undefined || mins === null || isNaN(mins)) return "0:00";
  const abs = Math.abs(mins);
  const sign = mins < 0 ? "-" : "";
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

function isEmptyEdits(
  e: { amIn: string; amOut: string; pmIn: string; pmOut: string; ovIn: string; ovOut: string; },
  row?: DailyRow
) {
  // Chỉ xét các code tồn tại trong ngày
  const wantAM = !!row?.am && (e.amIn || e.amOut);
  const wantPM = !!row?.pm && (e.pmIn || e.pmOut);
  const wantOV = !!row?.ov && (e.ovIn || e.ovOut);  
  return !(wantAM || wantPM || wantOV);
}

function withPair(inHHmm: string, outHHmm: string) {
  const mk = (v: string | undefined) => (v && v.trim() !== "" ? v : undefined);
  const obj: any = {};
  const ci = mk(inHHmm);
  const co = mk(outHHmm);
  if (ci) obj.checkIn = ci; // backend sẽ parse HH:mm theo dateKey+tz
  if (co) obj.checkOut = co; // cho phép >24h cho OV
  return obj;
}

function isValidHHmm(v: string) {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const hh = +m[1], mm = +m[2];
  return hh >= 0 && mm >= 0 && mm < 60; // cho phép >24 (OV kiểm riêng)
}

function isValidOvOut(v: string) {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const hh = +m[1], mm = +m[2];
  if (mm < 0 || mm >= 60) return false;
  // OV yêu cầu strictly > 24:00
  return (hh > 24) || (hh === 24 && mm > 0);
}

/** Nếu iso (local theo TZ) rơi vào ngày sau dateKey → hiển thị HH:mm +24h (overflow). */
function toOverflowDisplay(dateKey: string, iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const tz = "Asia/Bangkok";
  const localDay = localDateInTz(d, tz); // 'YYYY-MM-DD'
  if (localDay > dateKey) {
    const hh = +new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d);
    const mm = +new Intl.DateTimeFormat("en-GB", { timeZone: tz, minute: "2-digit" }).format(d);
    return `${hh + 24}:${String(mm).padStart(2, "0")}`;
  }
  // cùng ngày → trả về HH:mm bình thường
  return toHHmmLocal(iso).trim();
}

function localDateInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d); // 'YYYY-MM-DD'
}

// Date helpers cho bộ lọc
function toDateKeyLocal(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d); // YYYY-MM-DD
}
function firstDayOfMonth(dateKey: string) {
  return dateKey.slice(0, 8) + '01';
}
function firstDayOfWeek(dateKey: string) {
  // Tuần bắt đầu Thứ 2 (ISO) theo Asia/Bangkok
  const [Y, M, D] = dateKey.split('-').map(Number);
  const baseUTC = new Date(Date.UTC(Y, M - 1, D));
  // chuyển sang local Bangkok (UTC+7) để tính thứ trong tuần
  const bangkok = new Date(baseUTC.getTime() + 7 * 60 * 60 * 1000);
  const dow = bangkok.getUTCDay();        // 0=CN..6=Th7
  const iso = dow === 0 ? 7 : dow;        // 1..7
  const diff = iso - 1;                   // lùi về Thứ 2
  const startLocal = new Date(bangkok.getTime() - diff * 24 * 60 * 60 * 1000);
  const backToUTC = new Date(startLocal.getTime() - 7 * 60 * 60 * 1000);
  return toDateKeyLocal(backToUTC, 'Asia/Bangkok');
}




