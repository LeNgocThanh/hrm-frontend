"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import * as XLSX from "xlsx";

// ==== CONFIG ====
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;
type ObjectId = string;

type UserLite = {
  _id: ObjectId;
  fullName: string;
  email?: string;
  userCode?: string;
  organizationId?: string;
  organizationPath?: string;
};

type OrganizationType = {
  _id: ObjectId;
  name: string;
};

type AssignmentRow = {
  userId: string;
  userCode?: string;
  userName: string;
  dateKey: string; // YYYY-MM-DD
  shiftSessionCodes: string[];
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
};

async function api(path: string, opts: any = {}) {
  const { method = "GET", query, body, headers } = opts;
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v != null && v !== "") {
        url.searchParams.append(
          k,
          typeof v === "object" ? JSON.stringify(v) : String(v)
        );
      }
    });
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": body ? "application/json" : "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const txt = await res.text();
      if (txt) {
        try {
          msg = JSON.parse(txt).message || msg;
        } catch {
          msg = txt;
        }
      }
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  const txt = await res.text();
  if (!txt || !txt.trim()) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return { data: txt };
  }
}

export default function ShiftAssignmentsPage() {
  // ===== Filters =====
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [userCodeFilter, setUserCodeFilter] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // chọn 1 user cụ thể (nếu muốn); nếu không chọn → dùng toàn bộ filteredUsers
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Users & Organizations
  const { data: usersData, error: usersError, isLoading: isLoadingUsers } =
    useSWR<UserLite[]>(`${API_BASE}/users/withOrganizationName`, fetcher, {
      revalidateOnFocus: false,
    });

  const {
    data: orgsData,
    error: orgsError,
    isLoading: isLoadingOrganizations,
  } = useSWR<OrganizationType[]>(
    `${API_BASE}/organizations/under`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const users = usersData ?? [];
  const organizations = orgsData ?? [];

  const getAllSegmentsFromString = (fullString?: string) => {
    return fullString?.split("/").filter(Boolean) ?? [];
  };

  const filteredUsers = useMemo(() => {
    let userData = users;
    if (selectedOrganizationId) {
      userData = userData.filter((user) => {
        const segments = getAllSegmentsFromString(user.organizationPath);
        if (user.organizationId) segments.push(user.organizationId);
        return segments.includes(selectedOrganizationId);
      });
    }
    if (nameFilter) {
      const lower = nameFilter.toLowerCase();
      userData = userData.filter((u) =>
        u.fullName.toLowerCase().includes(lower)
      );
    }
    if (userCodeFilter) {
      const code = userCodeFilter.trim().toLowerCase();
      userData = userData.filter((u) =>
        (u.userCode || "").toLowerCase().includes(code)
      );
    }
    return userData;
  }, [users, selectedOrganizationId, nameFilter, userCodeFilter]);

  const userMap = useMemo(
    () => new Map(users.map((u) => [String(u._id), u])),
    [users]
  );

  // ===== Assignments state =====
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(
    1,
    Math.ceil(assignments.length / PAGE_SIZE) || 1
  );
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return assignments.slice(start, start + PAGE_SIZE);
  }, [assignments, page]);

  function resolveUserName(userId: string) {
    return userMap.get(userId)?.fullName || userId;
  }

  // ===== Fetch assignments (BODY: userIds + from + to) =====
  async function fetchAssignments() {
    setLoading(true);
    setLoadError(null);

    try {
      if (!from || !to) {
        throw new Error("Vui lòng chọn khoảng ngày From / To.");
      }
      if (from > to) {
        throw new Error("Ngày From không được lớn hơn ngày To.");
      }

      let userIds: string[] = [];
      if (selectedUserId) {
        userIds = [selectedUserId];
      } else {
        userIds = filteredUsers.map((u) => String(u._id));
      }

      if (!userIds.length) {
        throw new Error(
          "Không có nhân viên nào trong kết quả lọc để gửi userIds."
        );
      }

      const body = {
        userIds,
        from,
        to,
      };

      // Gọi endpoint BODY-based, ví dụ: POST /user-shift-sessions/query
      const data: any = await api("/user-shift-sessions", {
        method: "POST",
        body,
      });

      const items: any[] = Array.isArray(data) ? data : data?.items ?? [];

      const normalized: AssignmentRow[] = items.map((r: any) => {
        const userId = String(
          r.userId?._id ?? r.userId ?? r.user?._id ?? r.user?._id ?? ""
        );
        const user = userMap.get(userId);
        return {
          userId,
          userCode:
            r.userCode ?? user?.userCode ?? r.user?.userCode ?? undefined,
          userName:
            r.userName ?? user?.fullName ?? r.user?.fullName ?? "N/A",
          dateKey: r.dateKey ?? r.date ?? "",
          shiftSessionCodes:
            r.shiftSessionCodes ??
            r.shifts ??
            r.shiftCodes ??
            ([] as string[]),
        };
      });

      normalized.sort((a, b) => {
        const byName = a.userName.localeCompare(b.userName, "vi");
        if (byName !== 0) return byName;
        return a.dateKey.localeCompare(b.dateKey);
      });

      setAssignments(normalized);
      setPage(1);
    } catch (e: any) {
      setLoadError(e?.message || "Lỗi tải dữ liệu gán ca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // để trống, anh tự quyết auto-load hay không
  }, []);

  // ===== Import Excel (by userCode) =====
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload() {
    setImportError(null);
    setImportResult(null);
    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) throw new Error("Chưa chọn file.");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE}/user-shift-sessions/import-excel`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      if (!res.ok) {
        let msg = res.statusText;
        try {
          const txt = await res.text();
          if (txt) {
            try {
              msg = JSON.parse(txt).message || msg;
            } catch {
              msg = txt;
            }
          }
        } catch {}
        throw new Error(msg || `HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (data && typeof data === "object") {
        const { totalRows, successCount, errorCount } = data as any;
        setImportResult(
          `Import xong: tổng ${totalRows ?? "?"} dòng, thành công ${
            successCount ?? "?"
          }, lỗi ${errorCount ?? 0}.`
        );
      } else {
        setImportResult("Import thành công.");
      }

      // reload danh sách cho khớp (nếu đang có from/to + filter)
      if (from && to) {
        await fetchAssignments();
      }
    } catch (e: any) {
      setImportError(e?.message || "Upload thất bại.");
    }
  }

  function resetImport() {
    setImportError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Download template: userCode, date, shifts
  function downloadTemplate() {
    const rows = [
      {
        userCode: "NV001",
        date: "2025-12-01",
        shifts: "CaSang_1,CaChieu_1",
      },
      {
        userCode: "NV002",
        date: "2025-12-01",
        shifts: "CaDem_OV",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["userCode", "date", "shifts"],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "user_shift_sessions_template.xlsx");
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Gán ca theo nhân viên
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Hiển thị và import phân ca theo từng nhân viên (dùng mã
            <span className="font-semibold"> userCode </span> trong file Excel).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={downloadTemplate}
            className="px-3 py-2 rounded-xl border hover:bg-gray-50"
          >
            File mẫu (Excel)
          </button>
          <button
            onClick={() => {
              resetImport();
              setShowImport(true);
            }}
            className="px-3 py-2 rounded-xl border hover:bg-gray-50"
          >
            Import phân ca
          </button>
          <button
            onClick={fetchAssignments}
            className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90"
          >
            Tải dữ liệu
          </button>
        </div>
      </header>

      {/* Filters */}
      {usersError && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          Lỗi tải danh sách nhân viên: {String(usersError)}
        </div>
      )}
      {orgsError && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          Lỗi tải danh sách tổ chức: {String(orgsError)}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-3 bg-white p-4 rounded-xl shadow-sm">
        {/* Tổ chức */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Tổ chức
          </label>
          <select
            value={selectedOrganizationId}
            onChange={(e) => {
              setSelectedOrganizationId(e.target.value);
              setSelectedUserId(""); // reset chọn user nếu đổi phòng
            }}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoadingOrganizations}
          >
            <option value="">Tất cả</option>
            {organizations.map((org) => (
              <option key={org._id} value={org._id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tên */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Tên nhân viên
          </label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => {
              setNameFilter(e.target.value);
              setSelectedUserId("");
            }}
            placeholder="Nhập tên…"
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* userCode */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Mã nhân viên (userCode)
          </label>
          <input
            type="text"
            value={userCodeFilter}
            onChange={(e) => {
              setUserCodeFilter(e.target.value);
              setSelectedUserId("");
            }}
            placeholder="VD: NV001"
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Từ ngày */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Từ ngày
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Đến ngày + nút */}
        <div className="flex flex-col justify-end">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Đến ngày
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={fetchAssignments}
              className="whitespace-nowrap px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Lọc & Tải
            </button>
          </div>
        </div>
      </section>

      {/* Danh sách người sau khi filter + chọn 1 người (tuỳ chọn) */}
      <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Đang lọc được{" "}
            <span className="font-semibold">{filteredUsers.length}</span>{" "}
            nhân viên.
          </p>
          <p className="text-xs text-gray-500">
            {selectedUserId
              ? `Đang chọn: ${
                  filteredUsers.find((u) => u._id === selectedUserId)
                    ?.fullName || selectedUserId
                }`
              : "Chưa chọn nhân viên nào → sẽ gửi toàn bộ userIds đã lọc."}
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto border rounded-xl mt-1">
          {filteredUsers.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">
              Không có nhân viên nào khớp bộ lọc.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const isSelected = selectedUserId === u._id;
                return (
                  <li key={u._id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedUserId((prev) =>
                          prev === u._id ? "" : u._id
                        )
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm ${
                        isSelected ? "bg-indigo-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {u.fullName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {u.userCode || "Chưa có userCode"}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <span className="h-2 w-2 bg-white rounded-full" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-1">
          - Nếu <b>chọn 1 nhân viên</b> ở trên: body gửi <code>userIds</code> chỉ chứa
          user đó. <br />
          - Nếu <b>không chọn</b>: body gửi <code>userIds</code> của toàn bộ nhân viên đã lọc.
        </p>
      </section>

      {/* Table */}
      <section className="border rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Mã nhân viên</th>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Các ca</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6" colSpan={5}>
                    Đang tải…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td
                    className="px-4 py-6 text-red-600 whitespace-pre-wrap"
                    colSpan={5}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={5}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : (
                paged.map((r, idx) => (
                  <tr
                    key={`${r.userId}-${r.dateKey}`}
                    className="odd:bg-white even:bg-gray-50"
                  >
                    <td className="px-4 py-2">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {r.userName || resolveUserName(r.userId)}
                    </td>
                    <td className="px-4 py-2">{r.userCode || ""}</td>
                    <td className="px-4 py-2">{r.dateKey}</td>
                    <td className="px-4 py-2 whitespace-pre-wrap">
                      {r.shiftSessionCodes?.join(", ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-gray-600">
            Trang {page}/{pageCount} — Tổng {assignments.length} dòng
          </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Import phân ca (Excel)</h2>
                <p className="mt-1 text-xs text-gray-600">
                  File cần có các cột: <b>userCode</b>, <b>date</b>,{" "}
                  <b>shifts</b> (mã ca cách nhau dấu phẩy).
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImport(false);
                  resetImport();
                }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="block w-full text-sm"
              />

              {importError && (
                <div className="text-sm text-red-600 whitespace-pre-wrap">
                  {importError}
                </div>
              )}
              {importResult && (
                <div className="text-sm text-emerald-700 whitespace-pre-wrap">
                  {importResult}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowImport(false);
                    resetImport();
                  }}
                  className="px-3 py-2 rounded-xl border"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpload}
                  //disabled={!fileInputRef.current?.files?.length}
                  className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
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
