"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AT_STATUS, STATUS_OPTIONS_AT } from '@/i18n/attendance.vi'
import { getDayNameFromDate } from '@/utils/date-helpers'

// Env
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// --- Types Khớp Backend Mới ---
enum SessionCode {
  AM = 'AM',
  PM = 'PM',
  OV = 'OV',
}

interface ShiftSession {
  code: SessionCode;
  start: string; // HH:mm
  end: string;   // HH:mm
  required: boolean;
  graceInMins?: number;
  graceOutMins?: number;
  breakMinutes?: number;
  maxCheckInEarlyMins?: number;
  maxCheckOutLateMins?: number;
}

interface WeeklyRules {
  '0'?: ShiftSession[];
  '1'?: ShiftSession[];
  '2'?: ShiftSession[];
  '3'?: ShiftSession[];
  '4'?: ShiftSession[];
  '5'?: ShiftSession[];
  '6'?: ShiftSession[];
}

interface ShiftType {
  _id?: string;
  code: string;
  name: string;
  timezone?: string;
  weeklyRules: WeeklyRules;
  isCheckTwoTimes?: boolean;
}

// Enum tương ứng với TimeEntryType bên backend
enum TimeEntryType {
  LEAVE = 'LEAVE',
  OVERTIME = 'OVERTIME',
  ATTENDANCE = 'ATTENDANCE',
}

// Interface cho các bản ghi nghỉ phép/tăng ca
interface UserTimeEntry {
  _id: string;
  userId: string;
  type: TimeEntryType;
  startAt: string; // ISO string
  endAt: string;   // ISO string
  refId: string;
}

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

// Tổng hợp thời gian nghỉ phép và tăng ca cho một ngày
interface TimeEntrySummary {
  leaveMinutes: number;
  overtimeMinutes: number;
  leaveDetails: UserTimeEntry[];
  overtimeDetails: UserTimeEntry[];
}

// Interface chính cho 1 dòng dữ liệu ngày
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
  // TRƯỜNG MỚI ĐƯỢC THÊM VÀO SAU KHI TỔNG HỢP TIME ENTRIES
  timeEntrySummary?: TimeEntrySummary;
  [key: string]: any;
}

// UserLite bây giờ là interface cho người dùng từ API /users/by-organization
interface UserLite {
  _id: string;
  name?: string; // Dùng làm fallback
  fullName: string; // Tên hiển thị chính
  timezone: string;
}

// Loại bỏ hằng số ALL_USERS giả lập
// const ALL_USERS: UserLite[] = [...];

const DEFAULT_TIMEZONE = 'Asia/Bangkok';

// --- Date/Time Helpers (Giữ nguyên) ---

function toHHmmLocal(iso: string, tz: string = DEFAULT_TIMEZONE) {
  if (!iso) return '-';
  const d = new Date(iso);
  // Sử dụng new Intl.DateTimeFormat để tránh lỗi múi giờ
  const options: Intl.DateTimeFormatOptions = { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  try {
    const timeStr = new Intl.DateTimeFormat("en-GB", options).format(d);
    return timeStr.replace(':', ':'); // Trả về HH:mm
  } catch (e) {
    console.error("Lỗi format thời gian local:", e, "cho ISO:", iso);
    return '---';
  }
}

function toHHmmOverNight(iso: string, checkInIso: string, tz: string = DEFAULT_TIMEZONE) {
  if (!iso || !checkInIso) return '-';
  const checkInDate = new Date(checkInIso);
  const checkOutDate = new Date(iso);

  // So sánh ngày theo múi giờ địa phương
  const checkInDateKey = localDateInTz(checkInDate, tz);
  const checkOutDateKey = localDateInTz(checkOutDate, tz);

  if (checkInDateKey !== checkOutDateKey) {
    // Nếu qua đêm, tính phút chênh lệch
    const baseTime = toHHmmLocal(iso, tz).split(':').map(Number);
    const totalMinutes = baseTime[0] * 60 + baseTime[1];
    const totalHours = Math.floor(totalMinutes / 60);
    const minutesRemainder = totalMinutes % 60;

    // Nếu qua ngày, hiển thị giờ > 24h
    return `${String(totalHours + 24).padStart(2, '0')}:${String(minutesRemainder).padStart(2, '0')}`;
  }
  // cùng ngày → trả về HH:mm bình thường
  return toHHmmLocal(iso, tz).trim();
}

function localDateInTz(d: Date, tz: string = DEFAULT_TIMEZONE): string {
  // Trả về 'YYYY-MM-DD'
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
}

// Date helpers cho bộ lọc - ĐÃ THÊM MÚI GIỜ MẶC ĐỊNH
function toDateKeyLocal(d: Date, tz: string = DEFAULT_TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d); // YYYY-MM-DD
}

function firstDayOfMonth(dateKey: string): string {
  // dateKey là YYYY-MM-DD
  return dateKey.slice(0, 8) + '01';
}

function addDays(dateKey: string, days: number, tz: string = DEFAULT_TIMEZONE): string {
  const [Y, M, D] = dateKey.split('-').map(Number);
  // Khởi tạo ngày theo múi giờ UTC, sau đó chỉnh sửa
  const d = new Date(Date.UTC(Y, M - 1, D));
  d.setDate(d.getDate() + days);
  // Trả về theo múi giờ địa phương
  return localDateInTz(d, tz);
}

function getStartOfDayInTz(dateKey: string, tz: string = DEFAULT_TIMEZONE): string {
  // Trả về ISO string của 00:00:00 của dateKey theo múi giờ tz
  // Ví dụ: getStartOfDayInTz('2023-10-25', 'Asia/Bangkok') trả về 2023-10-24T17:00:00.000Z (nếu múi giờ là +7)
  return new Date(dateKey + 'T00:00:00').toISOString();
}

function getEndOfDayInTz(dateKey: string, tz: string = DEFAULT_TIMEZONE): string {
  // Trả về ISO string của 00:00:00 ngày hôm sau để lấy hết ngày
  const nextDayKey = addDays(dateKey, 1, tz);
  return new Date(nextDayKey + 'T00:00:00').toISOString();
}
// --- Hết Date/Time Helpers ---

// Hàm nhóm và tổng hợp Time Entries
const groupAndSummarizeTimeEntries = (entries: UserTimeEntry[], tz: string): Map<string, TimeEntrySummary> => {
  // ... (Logic giữ nguyên)
  const map = new Map<string, TimeEntrySummary>();

  entries.forEach(entry => {
    // Logic: Lặp qua từng ngày mà bản ghi LEAVE/OVERTIME bao phủ
    let currentDayKey = localDateInTz(new Date(entry.startAt), tz);

    // Nếu endAt là 00:00 của ngày X, thì chỉ tính đến ngày X-1
    const end = new Date(entry.endAt).getTime();

    // Vòng lặp này duyệt qua từng ngày mà bản ghi này có giao với nó
    while (true) {

      const dayStart = new Date(getStartOfDayInTz(currentDayKey, tz)).getTime();
      const nextDayStart = new Date(getEndOfDayInTz(currentDayKey, tz)).getTime(); // Tương đương 00:00 ngày hôm sau

      // Khoảng thời gian giao nhau: [max(Entry.startAt, Day.startAt), min(Entry.endAt, Day.endAt)]
      const intersectionStart = Math.max(new Date(entry.startAt).getTime(), dayStart);
      const intersectionEnd = Math.min(end, nextDayStart);

      let minutes = 0;
      if (intersectionStart < intersectionEnd) {
        minutes = Math.round((intersectionEnd - intersectionStart) / (1000 * 60));
      }

      if (minutes > 0) {
        if (!map.has(currentDayKey)) {
          map.set(currentDayKey, {
            leaveMinutes: 0,
            overtimeMinutes: 0,
            leaveDetails: [],
            overtimeDetails: [],
          });
        }

        const summary = map.get(currentDayKey)!;

        if (entry.type === TimeEntryType.LEAVE) {
          summary.leaveMinutes += minutes;
          // Chỉ thêm chi tiết nếu chưa có (để tránh trùng lặp nếu logic lặp lại bị lỗi)
          if (!summary.leaveDetails.some(d => d._id === entry._id)) {
            summary.leaveDetails.push(entry);
          }
        } else if (entry.type === TimeEntryType.OVERTIME) {
          summary.overtimeMinutes += minutes;
          if (!summary.overtimeDetails.some(d => d._id === entry._id)) {
            summary.overtimeDetails.push(entry);
          }
        }
      }

      // Chuẩn bị cho ngày tiếp theo
      const nextDayKey = addDays(currentDayKey, 1, tz);

      // Dừng nếu ngày tiếp theo đã ngoài phạm vi của bản ghi
      if (new Date(getStartOfDayInTz(nextDayKey, tz)).getTime() >= end) {
        break;
      }

      currentDayKey = nextDayKey;

      if (currentDayKey > localDateInTz(new Date(end + 1), tz)) break;

    }
  });

  return map;
}


// --- Main Component ---
export default function DailyAttendancePage() {

  // State mới để lưu danh sách người dùng từ API
  const [allUsers, setAllUsers] = useState<UserLite[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const now = new Date();
  const currentDayKey = toDateKeyLocal(now, DEFAULT_TIMEZONE);
  const firstDayKey = firstDayOfMonth(currentDayKey);

  // Lấy ID người dùng đầu tiên (hoặc mặc định rỗng nếu chưa có)
  const initialUserId = allUsers.length > 0 ? allUsers[0]._id : '';
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId);

  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // KHỞI TẠO AN TOÀN
  const [filterFrom, setFilterFrom] = useState(firstDayKey);
  const [filterTo, setFilterTo] = useState(currentDayKey);

  const [shiftTypes, setShiftTypes] = useState<Record<string, ShiftType>>({});

  // useEffect để tải danh sách người dùng
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE}/users/by-organization`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error("Lỗi khi lấy danh sách người dùng.");
        }
        const users: UserLite[] = await response.json();
        setAllUsers(users);

        // Chọn người dùng đầu tiên nếu danh sách không rỗng
        if (users.length > 0) {
          setSelectedUserId(users[0]._id);
        }
      } catch (error) {
        console.error("Lỗi fetch user: ", error);
        // Có thể set lỗi ở đây
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Cập nhật selectedUserId nếu allUsers thay đổi và chưa được chọn
  useEffect(() => {
    if (allUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(allUsers[0]._id);
    }
  }, [allUsers, selectedUserId]);

  const fetchShiftType = async (code: string) => {
    if (!code || shiftTypes[code]) return;

    try {
      const response = await fetch(`${API_BASE}/shift-types/by-code/${code}`);
      if (!response.ok) {
        throw new Error("Lỗi khi lấy thông tin ca làm việc");
      }
      const shiftType: ShiftType = await response.json();
      setShiftTypes(prev => ({ ...prev, [code]: shiftType }));
    } catch (error) {
      console.error("Lỗi fetch shift type: ", error);
    }
  };

  useEffect(() => {
    if (dailyRows.length > 0) {
      const uniqueShiftTypes = [...new Set(dailyRows.map(row => row.shiftType).filter(Boolean))];
      uniqueShiftTypes.forEach(code => {
        if (code) fetchShiftType(code);
      });
    }
  }, [dailyRows]);

  const getSessionsForDate = (dateKey: string, shiftTypeCode: string | undefined) => {
  if (!shiftTypeCode || !shiftTypes[shiftTypeCode]) return [];
  
  const shiftType = shiftTypes[shiftTypeCode];
  const date = new Date(dateKey);
  const dayOfWeek = date.getDay().toString(); // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
  
  return shiftType.weeklyRules[dayOfWeek as keyof WeeklyRules] || [];
};


  const currentUserTz = useMemo(() => {
    return allUsers.find(u => u._id === selectedUserId)?.timezone || DEFAULT_TIMEZONE;
  }, [selectedUserId, allUsers]);

  const fetchAttendanceDaily = async (userId: string, from: string, to: string) => {
    if (!userId || !from || !to) return;

    setIsLoading(true);

    // Dùng ISO string của 0h00 ngày đầu tiên đến 0h00 ngày cuối cùng + 1
    const startAtISO = getStartOfDayInTz(from, currentUserTz);
    const endAtISO = getEndOfDayInTz(to, currentUserTz);

    try {
      // 1. Lấy dữ liệu chấm công hàng ngày
      const attendanceResponse = await fetch(`${API_BASE}/attendance/daily?userId=${userId}&from=${startAtISO}&to=${endAtISO}`);

      if (!attendanceResponse.ok) {
        throw new Error("Lỗi khi lấy dữ liệu chấm công hàng ngày");
      }
      const attendanceData: DailyRow[] = await attendanceResponse.json();

      // 2. Lấy dữ liệu nghỉ phép/tăng ca (LEAVE & OVERTIME)
      const params = new URLSearchParams({
        userId: userId,
        startAt: startAtISO,
        endAt: endAtISO,
      });
      const timeEntryResponse = await fetch(`${API_BASE}/user-time-entries/by-user-and-time?${params.toString()}`);

      if (!timeEntryResponse.ok) {
        console.error("Lỗi khi lấy dữ liệu nghỉ phép/tăng ca.");
        setDailyRows(attendanceData);
        return;
      }

      const timeEntries: UserTimeEntry[] = await timeEntryResponse.json();

      // 3. Xử lý và nhóm Time Entries theo ngày
      const groupedTimeEntries = groupAndSummarizeTimeEntries(timeEntries, currentUserTz);

      // 4. Kết hợp dữ liệu chấm công và time entries
      const combinedRows = attendanceData.map(row => {
        const dateKey = row.dateKey;
        const summary = groupedTimeEntries.get(dateKey) || {
          leaveMinutes: 0,
          overtimeMinutes: 0,
          leaveDetails: [],
          overtimeDetails: [],
        };
        return {
          ...row,
          timeEntrySummary: summary,
        };
      });

      setDailyRows(combinedRows);

    } catch (error) {
      console.error("Lỗi: ", error);
      setDailyRows([]);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    // Chỉ gọi fetchAttendanceDaily khi danh sách người dùng đã được tải VÀ đã chọn được UserId
    if (!isLoadingUsers && selectedUserId) {
      fetchAttendanceDaily(selectedUserId, filterFrom, filterTo);
    }
  }, [selectedUserId, filterFrom, filterTo, currentUserTz, isLoadingUsers]);

  // Handler cho bộ lọc
  const handleFilterChange = (type: 'from' | 'to', value: string) => {
    if (type === 'from') {
      setFilterFrom(value);
    } else {
      setFilterTo(value);
    }
  };

  const selectedUser = allUsers.find(u => u._id === selectedUserId);

  // Hiển thị trạng thái đang tải danh sách người dùng
  if (isLoadingUsers) {
    return (
      <div className="text-center py-20 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-indigo-800 mb-6">Bảng Chấm Công Hàng Ngày</h1>
        <div className="text-center py-12 text-lg text-indigo-600">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mr-2"></div>
          Đang tải danh sách nhân viên...
        </div>
      </div>
    );
  }

  // Xử lý trường hợp không có người dùng nào
  if (allUsers.length === 0) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-indigo-800 mb-6">Bảng Chấm Công Hàng Ngày</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg text-center text-gray-500">
          Không tìm thấy nhân viên nào trong tổ chức của bạn.
        </div>
      </div>
    );
  }


  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-indigo-800 mb-6">Bảng Chấm Công Hàng Ngày</h1>

      <div className="bg-white p-4 rounded-xl shadow-lg mb-6 flex flex-wrap gap-4 items-end">
        {/* Lựa chọn người dùng */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Nhân Viên</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="mt-1 block w-64 p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoadingUsers}
          >
            {allUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {user.fullName || user.name} {/* Hiển thị fullName, fallback là name */}
              </option>
            ))}
          </select>
        </div>

        {/* Lựa chọn ngày bắt đầu */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Từ Ngày</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => handleFilterChange('from', e.target.value)}
            className="mt-1 block w-40 p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Lựa chọn ngày kết thúc */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Đến Ngày</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => handleFilterChange('to', e.target.value)}
            className="mt-1 block w-40 p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Nút làm mới */}
        <button
          onClick={() => fetchAttendanceDaily(selectedUserId, filterFrom, filterTo)}
          disabled={isLoading || !selectedUserId}
          className={`px-4 py-2 text-white font-semibold rounded-lg shadow-md transition duration-150 ${isLoading || !selectedUserId ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
        >
          {isLoading ? 'Đang Tải...' : 'Xem Dữ Liệu'}
        </button>
      </div>

      <DailyTable dailyRows={dailyRows} currentUserTz={currentUserTz} isLoading={isLoading} getSessionsForDate={getSessionsForDate}/>
    </div>
  );
}

// --- Component Bảng Hiển Thị Dữ Liệu ---

interface DailyTableProps {
  dailyRows: DailyRow[];
  currentUserTz: string;
  isLoading: boolean;
  getSessionsForDate: (dateKey: string, shiftTypeCode: string | undefined) => ShiftSession[];
  
}

const DailyTable: React.FC<DailyTableProps> = ({ dailyRows, currentUserTz, isLoading, getSessionsForDate }) => {
  if (isLoading) {
    return (
      <div className="text-center py-12 text-lg text-indigo-600">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mr-2"></div>
        Đang tải dữ liệu chấm công...
      </div>
    );
  }

  if (dailyRows.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg text-center text-gray-500">
        Không có dữ liệu chấm công trong khoảng thời gian đã chọn.
      </div>
    );
  }

  const getDayOfWeek = (dateKey: string): number => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay(); // 0 (Chủ Nhật) đến 6 (Thứ Bảy)
  };

  const formatMinutes = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === 0) return '-';
    const absMinutes = Math.abs(minutes);
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${h > 0 ? h + 'h' : ''}${m > 0 ? m + 'm' : ''}`;
  };

  const getStatusStyle = (status: string | undefined) => {
    switch (status) {
      case AT_STATUS.OK: return 'bg-green-100 text-green-800 border-green-300';
      case AT_STATUS.LATE_EARLY: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case AT_STATUS.ABSENT: return 'bg-red-100 text-red-800 border-red-300';
      case AT_STATUS.MANUAL_EDIT: return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case AT_STATUS.WEEKEND: return 'bg-gray-100 text-gray-500 border-gray-300';
      default: return 'bg-white text-gray-600 border-gray-300';
    }
  };

  // Hàm tạo tooltip chi tiết cho cột mới
  const getCombinedTimeEntryTooltip = (summary: TimeEntrySummary) => {
    let tooltip = 'Chi tiết các bản ghi ngoài:\n';

    if (summary.leaveMinutes > 0) {
      tooltip += `--- NGHỈ PHÉP (${formatMinutes(summary.leaveMinutes)}) ---\n`;
      // Sắp xếp theo startAt
      summary.leaveDetails.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).forEach(d => {
        tooltip += `* ${toHHmmLocal(d.startAt, currentUserTz)} - ${toHHmmLocal(d.endAt, currentUserTz)} (Ref: ${d.refId})\n`;
      });
    }

    if (summary.overtimeMinutes > 0) {
      if (summary.leaveMinutes > 0) tooltip += '\n';
      tooltip += `--- TĂNG CA (${formatMinutes(summary.overtimeMinutes)}) ---\n`;
      // Sắp xếp theo startAt
      summary.overtimeDetails.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).forEach(d => {
        tooltip += `* ${toHHmmLocal(d.startAt, currentUserTz)} - ${toHHmmLocal(d.endAt, currentUserTz)} (Ref: ${d.refId})\n`;
      });
    }

    return tooltip.trim();
  }

  const renderSession = (session: DailySessionActual | undefined) => {
    if (!session || (!session.firstIn && !session.lastOut && !session.checkIn_Edit && !session.checkOut_Edit)) {
      return (
        <span className="text-xs text-gray-400">-</span>
      );
    }
    const checkIn = session.checkIn_Edit || session.firstIn;
    const checkOut = session.checkOut_Edit || session.lastOut;

    // Logic cho ca qua đêm chỉ áp dụng cho checkOut (so với checkIn)
    const checkOutTime = checkOut ? toHHmmOverNight(checkOut, checkIn || checkOut, currentUserTz) : '---';

    return (
      <div className="flex flex-col text-xs space-y-0.5">
        <span className={checkIn && session.checkIn_Edit ? 'text-indigo-600 font-medium' : 'text-gray-700'}>
          {checkIn ? toHHmmLocal(checkIn, currentUserTz) : '---'}
        </span>
        <span className={checkOut && session.checkOut_Edit ? 'text-indigo-600 font-medium' : 'text-gray-700'}>
          {checkOutTime}
        </span>
      </div>
    );
  };


  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-24 sm:w-32">
              Ngày
            </th>
            {/* <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ca
            </th> */}
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sáng (IN/OUT)
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Chiều (IN/OUT)
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quá ngày (IN/OUT)
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
             Ca thực tế
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tổng Giờ Làm
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Đi Trễ/Về Sớm
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Trạng Thái
            </th>
            {/* CỘT MỚI: NGHỈ PHÉP & TĂNG CA NGOÀI */}
            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Nghỉ Phép/Tăng Ca Khác
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dailyRows.map((row) => (
            <tr key={row.dateKey} className="hover:bg-gray-50 transition duration-100">
              {/* Ngày (Sticky) */}
              <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-white hover:bg-gray-50 z-10 w-24 sm:w-32">
                <div className="flex flex-col text-sm">
                  <span className="font-semibold text-gray-900">{row.dateKey.split('-').reverse().join('/')}</span>
                  <span className="text-xs text-gray-500">{getDayNameFromDate(row.dateKey)}</span>
                </div>
              </td>
              {/* Ca */}
              {/* <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                {row.shiftType || 'N/A'}
              </td> */}
              {/* Sáng */}
              <td className="px-3 py-3 whitespace-nowrap text-center">
                {renderSession(row.am)}
              </td>
              {/* Chiều */}
              <td className="px-3 py-3 whitespace-nowrap text-center">
                {renderSession(row.pm)}
              </td>
              {/* Tăng Ca */}
              <td className="px-3 py-3 whitespace-nowrap text-center">
                {renderSession(row.ov)}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-center">
  {(() => {
    const sessions = getSessionsForDate(row.dateKey, row.shiftType);
    if (sessions.length === 0) return '-';
    
    return (
      <div className="flex flex-col space-y-1 text-xs">
        {sessions.map((session, index) => (
          <div 
            key={index}
            title={`${session.code}: ${session.start} - ${session.end}${session.breakMinutes ? ` (Nghỉ: ${session.breakMinutes}p)` : ''}`}
            className="cursor-help"
          >
            {session.code}: {session.start}-{session.end}
          </div>
        ))}
      </div>
    );
  })()}
</td>
              {/* Tổng Giờ Làm */}
              <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-medium">
                {formatMinutes(row.workedMinutes)}
              </td>
              {/* Đi Trễ/Về Sớm */}
              <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-red-500 font-medium">
                {(row.lateMinutes || 0) > 0 || (row.earlyLeaveMinutes || 0) > 0
                  ? `${formatMinutes(row.lateMinutes)} / ${formatMinutes(row.earlyLeaveMinutes)}`
                  : '-'
                }
              </td>
              {/* Trạng Thái */}
              <td className="px-3 py-3 whitespace-nowrap text-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(row.status)}`}>
                  {STATUS_OPTIONS_AT.find(option => option.value === row.status)?.label || "N/A"}
                  {row.isManualEdit && (
                    <span title={row.editNote} className="ml-1 text-sm cursor-help">
                      [E]
                    </span>
                  )}
                </span>
              </td>
              {/* CỘT MỚI: NGHỈ PHÉP & TĂNG CA NGOÀI */}
              <td className="px-3 py-3 whitespace-nowrap text-center">
                {row.timeEntrySummary && (row.timeEntrySummary.leaveMinutes > 0 || row.timeEntrySummary.overtimeMinutes > 0) ? (
                  <div title={getCombinedTimeEntryTooltip(row.timeEntrySummary)} className="flex flex-col items-center cursor-help">
                    {row.timeEntrySummary.leaveMinutes > 0 && (
                      <span className="text-sm font-medium text-blue-600">
                        Nghỉ: {formatMinutes(row.timeEntrySummary.leaveMinutes)}
                      </span>
                    )}
                    {row.timeEntrySummary.overtimeMinutes > 0 && (
                      <span className="text-sm font-medium text-purple-600">
                        OT: {formatMinutes(row.timeEntrySummary.overtimeMinutes)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4 text-xs text-gray-500 border-t">
        <p>Lưu ý: [E] là bản ghi được chỉnh sửa thủ công.</p>
        <p>Giờ check-out có thêm "+24h" nghĩa là ca làm việc qua đêm sang ngày hôm sau.</p>
        <p className="text-blue-600">Mục "Nghỉ Phép/Tăng Ca Khác" tổng hợp thời gian Nghỉ Phép (LEAVE) và Tăng Ca (OVERTIME) từ các bản ghi ngoài chấm công chính. Chi tiết hiển thị khi di chuột lên.</p>
      </div>
    </div>
  );
};


