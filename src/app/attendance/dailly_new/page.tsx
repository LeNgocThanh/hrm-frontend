"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";

// Thay thế bằng cấu hình môi trường thực tế của bạn
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PAGE_SIZE = 20;

// Dùng SWR và fetch cơ bản cho mục đích minh họa
type ObjectId = string;
// Giả lập hàm fetcher cơ bản cho danh sách users
const fetcher = (path: string) => api(path);

// Dùng SWR và fetch cơ bản cho mục đích minh họa
function useSWR<T>(key: any, fetcher: any, opts: any = {}) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dependency key cho useEffect, đảm bảo không re-fetch nếu key không thay đổi
  const fetchKey = typeof key === 'string' ? key : JSON.stringify(key);

  useEffect(() => {
    if (!fetchKey || fetchKey === 'null') { // Nếu key là null hoặc chuỗi 'null'
        setData(null);
        setIsLoading(false);
        setError(null);
        return;
    }

    setIsLoading(true);
    setError(null);
    
    // Hàm fetcher thực thi với key đã được truyền
    fetcher(key) 
      .then((res: any) => setData(res.data || res)) // Giả định API trả về { data: [...] } hoặc []
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [fetchKey, fetcher]);
  return { data, error, isLoading, mutate: () => {} };
}
const mutate = () => {};

// --- Types dựa trên Schema và Logic mới ---

interface DailySessionActual {
  checkIn_Edit?: string | null;
  checkOut_Edit?: string | null;
  checkIn?: string | null; 
  checkOut?: string | null; 
  workedMinutes?: number;
  lateMinutes?: number;      
  earlyLeaveMinutes?: number; 
  fulfilled?: boolean;       
}

interface DailyRow {
  userId: string;
  dateKey: string; // 'YYYY-MM-DD' (local date key)
  status?: 'ABSENT' | 'HALF_AM' | 'HALF_PM' | 'FULL' | 'PRESENT' | string;
  workedMinutes?: number;         // Tổng giờ làm hợp lệ (overlap)
  actualPresenceMinutes?: number; // TỔNG THỜI GIAN CÓ MẶT THỰC TẾ (KPI)
  lateMinutes?: number;           // Tổng đi muộn
  earlyLeaveMinutes?: number;     // Tổng về sớm
  shiftType?: string; // REGULAR, ...
  am?: DailySessionActual;        // Chi tiết phiên sáng
  pm?: DailySessionActual;   
  editNote?: string; 
  isManualEdit?: boolean,    // Chi tiết phiên chiều
  [key: string]: any;
}

type UserLite = { _id: ObjectId; fullName: string; email?: string };


// Hàm fetch API cơ bản
async function api(path: string, opts: any = {}) {
    const { method = 'GET', query, body, headers } = opts;
    const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
    
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v != null && v !== '') url.searchParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
    }

    const response = await fetch(url.toString(), {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials : 'include',
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorBody.message || 'Lỗi từ Server');
    }

    const jsonResponse = await response.json();
    return jsonResponse;
}

// Fetcher cho SWR Daily Data: giờ chỉ nhận 1 path string
const dailyFetcher = (path: string) => {
    // Path đã chứa tất cả query params, chỉ cần gọi API
    return api(path);
};

export default function DailyAttendancePage() {
  const [userId, setUserId] = useState<string>(''); 
  const [selectedRow, setSelectedRow] = useState<DailyRow | null>(null);
  const [editTimes, setEditTimes] = useState<{ date: string; checkIn: string; checkOut: string; shiftType: string, editNote: string }>({ date: '', checkIn: '', checkOut: '', shiftType: '', editNote: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lấy danh sách người dùng
  const { data: users, isLoading: isLoadingUsers } = useSWR<UserLite[]>('/users/by-organization', fetcher, { revalidateOnFocus: false });
  
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  
  // Dùng ngày cố định hoặc tính toán range
  const dateRange = useMemo(() => ({
    from: '2024-01-01', // Ví dụ: Bắt đầu năm hiện tại
    to: today,
  }), [today]);

  // SWR Key for Daily Data: Chỉ thay đổi khi userId, from, hoặc to thay đổi.
  // Điều chỉnh API endpoint thành /attendance/daily/range như trong lần trước
  const swrKey = useMemo(() => {
    if (!userId) return null;
    // URLSearchParams đảm bảo thứ tự tham số không làm thay đổi key một cách không cần thiết
    const params = new URLSearchParams({ 
        userId, 
        from: dateRange.from, 
        to: dateRange.to 
    });
    return `/attendance/daily?${params.toString()}`;
  }, [userId, dateRange.from, dateRange.to]);


  const { data: dailyData, error, isLoading: isLoadingDaily, mutate: mutateDaily } = useSWR<{ data: DailyRow[] }>(
    swrKey, // Key ổn định (dựa trên useMemo)
    dailyFetcher // Fetcher ổn định
  ); 
  
  const dailyRows: DailyRow[] = useMemo(() => {  
    const dataArray = (dailyData as any)?.data || dailyData;    
    // Đảm bảo dataArray là một mảng và tạo bản sao trước khi reverse để tránh mutation
    const rows = Array.isArray(dataArray) ? [...dataArray] : [];    
    // Hiển thị dữ liệu mới nhất lên trên cùng
    return rows.reverse();
  }, [dailyData]);  

  const openEdit = (row: DailyRow) => {
    setSelectedRow(row);
    // Lấy giờ check-in sớm nhất (AM) và check-out muộn nhất (PM)
    const amIn = row.am?.checkIn ? toHHmmLocal(row.am.checkIn) : '';
    const pmOut = row.pm?.checkOut ? toHHmmLocal(row.pm.checkOut) : '';
    
    setEditTimes({
      date: row.dateKey,
      checkIn: amIn === '---' ? '' : amIn, 
      checkOut: pmOut === '---' ? '' : pmOut,
      shiftType: row.shiftType || 'REGULAR',
      editNote: row.editNote? row.editNote : '',
    });
  };

  const closeEdit = () => {
    setSelectedRow(null);
    setSaveError(null);
    setSaving(false);
  };
  
  const handleTimeChange = (field: 'checkIn' | 'checkOut' | 'shiftType', value: string) => {
    setEditTimes(prev => ({ ...prev, [field]: value }));
  };

  const handleNoteChange = (value: string) => {
    setEditTimes(prev => ({ ...prev, editNote: value }));
  };
  
  const saveTimes = async () => {
    if (!selectedRow) return;
    setSaving(true);
    setSaveError(null);

    const dateKey = selectedRow.dateKey;
    // Chuyển HH:mm về ISO String của ngày đó (phải có cả ngày tháng để ISO String hợp lệ)
    const checkInISO = editTimes.checkIn ? new Date(`${dateKey}T${editTimes.checkIn}:00`).toISOString() : undefined;
    const checkOutISO = editTimes.checkOut ? new Date(`${dateKey}T${editTimes.checkOut}:00`).toISOString() : undefined;

    const payload = {
        userId: selectedRow.userId,
        date: dateKey,
        checkIn: checkInISO,
        checkOut: checkOutISO,
        shiftType: editTimes.shiftType,
        editNote: editTimes.editNote,
    };

    try {
        // Endpoint cập nhật giờ làm (sẽ kích hoạt việc tính toán lại Daily)
        await api(`/attendance/times`, { method: 'PUT', body: payload });
        mutateDaily(); // Tải lại dữ liệu sau khi lưu
        closeEdit();
    } catch (e: any) {
        setSaveError(`Lỗi: ${e.message}`);
    } finally {
        setSaving(false);
    }
  };


  if (error) return <div className="p-4 text-red-600 bg-red-100 rounded-xl">Lỗi tải dữ liệu chấm công: </div>;

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="max-w-7xl mx-auto">
        
        <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-3">Bảng Chấm Công Hàng Ngày</h1>
        
        {/* User Selection */}
        <div className="mb-6 flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl shadow-md">
            <label className="text-gray-700 font-medium whitespace-nowrap">Chọn Nhân viên:</label>
            
            {isLoadingUsers ? (
                <div className="text-gray-500 p-2">Đang tải danh sách...</div>
            ) : (
                <select
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
                    disabled={!users}
                >
                    <option value="">-- Chọn nhân viên --</option>
                    {(users || []).map((u) => (
                        <option key={String(u._id)} value={String(u._id)}>
                            {u.fullName}{u.email ? ` — ${u.email}` : ""}
                        </option>
                    ))}
                </select>
            )}
            
            <div className="text-sm text-gray-500 ml-auto pt-2 md:pt-0">Dữ liệu từ: **{dateRange.from}** đến **{dateRange.to}**</div>
        </div>
        
        {/* Conditional Content */}
        {!userId ? (
            <div className="p-8 text-center text-gray-600 bg-white rounded-xl shadow-lg border border-blue-200">
                Vui lòng chọn một nhân viên để xem dữ liệu chấm công chi tiết.
            </div>
        ) : (
          <>
            {/* Loading Indicator */}
            {isLoadingDaily && (
              <div className="flex items-center justify-center p-8 bg-white rounded-xl shadow-lg text-blue-500">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang tải dữ liệu chấm công...
              </div>
            )}

            {/* Attendance Table */}
            {!isLoadingDaily && dailyRows.length > 0 && (
              <div className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Ngày</th>
                      <th className="px-4 py-3 text-left">Trạng thái</th>
                      <th className="px-4 py-3 text-right">T.Gian Có Mặt (KPI)</th>
                      <th className="px-4 py-3 text-right">Giờ làm Hợp lệ</th>
                      <th className="px-4 py-3 text-center">AM (Vào/Ra)</th>
                      <th className="px-4 py-3 text-center">PM (Vào/Ra)</th>
                      <th className="px-4 py-3 text-right">Đi Muộn</th>
                      <th className="px-4 py-3 text-right">Về Sớm</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyRows.map((row) => (
                      <tr key={row.dateKey} className="hover:bg-blue-50/50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.dateKey}</td>
                        
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${getStatusColor(row.status)}`}>
                            {row.status || 'N/A'}
                        </td>
                        
                        {/* actualPresenceMinutes for KPI */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right font-semibold">
                            {minsToHHmm(row.actualPresenceMinutes)}
                        </td>

                        {/* workedMinutes */}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                            {minsToHHmm(row.workedMinutes)}
                        </td>
                        
                        {/* AM Session Detail */}
                        <td className="px-4 py-3 text-xs text-center">
                            <span className="font-semibold">{toHHmmLocal(row.am?.checkIn_Edit ? row.am?.checkIn_Edit : row.am?.checkIn)}</span> / <span className="text-gray-500">{toHHmmLocal(row.am?.checkOut_Edit ? row.am?.checkOut_Edit : row.am?.checkOut)}</span>
                            {row.am?.fulfilled && <span className="text-green-500 ml-1" title="Phiên làm việc đầy đủ">✅</span>}
                        </td>

                        {/* PM Session Detail */}
                        <td className="px-4 py-3 text-xs text-center">
                            <span className="font-semibold">{toHHmmLocal(row.pm?.checkIn_Edit ? row.pm?.checkIn_Edit : row.pm?.checkIn)}</span> / <span className="text-gray-500">{toHHmmLocal(row.pm?.checkOut_Edit ? row.pm?.checkOut_Edit : row.pm?.checkOut)}</span>
                            {row.pm?.fulfilled && <span className="text-green-500 ml-1" title="Phiên làm việc đầy đủ">✅</span>}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-medium text-right">
                            {minsToHHmm(row.lateMinutes)}
                        </td>
                        
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-medium text-right">
                            {minsToHHmm(row.earlyLeaveMinutes)}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button 
                            onClick={() => openEdit(row)} 
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm bg-blue-50 px-3 py-1 rounded-full transition duration-150 ease-in-out"
                          >
                            Sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!isLoadingDaily && dailyRows.length === 0 && (
                <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-lg">
                    Không tìm thấy dữ liệu chấm công cho nhân viên này trong khoảng thời gian đã chọn.
                </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg space-y-4 transform scale-100 transition-transform">
            <h2 className="text-xl font-bold border-b pb-2 text-gray-800">Chỉnh sửa giờ làm ({selectedRow.dateKey})</h2>
            
            <div className="grid grid-cols-2 gap-4">
                {/* Check In */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Check In Sớm Nhất (HH:mm)</label>
                    <input 
                        type="time" 
                        value={editTimes.checkIn} 
                        onChange={(e) => handleTimeChange('checkIn', e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500" 
                    />
                </div>
                
                {/* Check Out */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Check Out Muộn Nhất (HH:mm)</label>
                    <input 
                        type="time" 
                        value={editTimes.checkOut} 
                        onChange={(e) => handleTimeChange('checkOut', e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500" 
                    />
                </div>

                {/* Shift Type */}
                <div className="flex flex-col col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1">Ca làm (Shift Type)</label>
                    <select 
                        value={editTimes.shiftType} 
                        onChange={(e) => handleTimeChange('shiftType', e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500" 
                    >
                        <option value="REGULAR">REGULAR (Thứ 2 - Thứ 7)</option>
                        <option value="ONLY_2_TO_6">ONLY_2_TO_6 (Chỉ Thứ 2 - Thứ 6)</option>
                    </select>
                </div>

                <div className="flex flex-col col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1">Note</label>
                    <textarea 
                        value={editTimes.editNote} 
                        onChange={(e) => handleNoteChange(e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500" 
                    >                       
                    </textarea>
                </div>
            </div>

            {saveError && <div className="p-3 text-red-600 bg-red-100 rounded-lg text-sm">{saveError}</div>}

            <div className="flex items-center justify-end gap-2 pt-4">
              <button onClick={closeEdit} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition">Hủy</button>
              <button 
                onClick={saveTimes} 
                disabled={saving || (!editTimes.checkIn && !editTimes.checkOut)} // Disable nếu cả 2 trường time đều trống
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Đang lưu…' : 'Lưu & Tính lại'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Helpers =====
// Phân biệt màu sắc cho Status
function getStatusColor(status?: string | null) {
    switch (status) {
        case 'FULL':
            return 'text-green-600';
        case 'HALF_AM':
        case 'HALF_PM':
        case 'PRESENT':
            return 'text-yellow-600';
        case 'ABSENT':
            return 'text-red-600';
        default:
            return 'text-gray-500';
    }
}

// Chuyển ISO thành HH:mm (theo Local Time)
function toHHmmLocal(iso?: string | null) {
  if (!iso) return "---";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "---";
  
  // Dùng Intl.DateTimeFormat để định dạng múi giờ
  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Bangkok' // Giả sử múi giờ của server/database
  };
  // Đảm bảo không return giá trị rỗng nếu format thất bại
  try {
    const formattedTime = new Intl.DateTimeFormat("vi-VN", formatOptions).format(d);
    return formattedTime;
  } catch (e) {
    console.error("Lỗi format giờ:", e);
    return "---";
  }
}

// Chuyển số phút thành định dạng H:mm
function minsToHHmm(mins?: number) {
  if (mins === undefined || mins === null || isNaN(mins)) return "0:00";
  // Xử lý cả giá trị âm (ví dụ: lateMinutes có thể là âm nếu grace > 0)
  const absMins = Math.abs(mins);
  const sign = mins < 0 ? '-' : ''; // Giữ dấu nếu cần
  const h = Math.floor(absMins / 60);
  const mm = Math.round(absMins % 60);
  return `${sign}${h}:${String(mm).padStart(2, '0')}`;
}