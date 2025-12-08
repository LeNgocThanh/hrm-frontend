'use client'
import React, { useState, useMemo, useEffect } from 'react';
import useSWR, { Fetcher } from 'swr';
import { ChevronDown, Loader2, Calendar, Users, Briefcase, User } from 'lucide-react';

// --- CONSTANTS AND API BASE ---
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// --- TYPE DEFINITIONS ---
interface OrganizationType {
  _id: string;
  name: string;
  path: string;
}

interface UserWithOrganization {
  _id: string;
  name: string;
  fullName: string;
  organizationId: string;
  organizationName: string;
  organizationPath: string;
}

// Định nghĩa Fetcher với Generic Type
const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
};

// --- UTILS VÀ HELPER DATE FUNCTIONS ---

const pad = (num: number): string => String(num).padStart(2, '0');

/** Chuyển Date object sang key 'YYYY-MM-DD' (ISO Date Key) */
const dateKey = (date: Date): string => {
  const d = new Date(date);
  // Date.prototype.toISOString() trả về UTC, cần điều chỉnh múi giờ trước khi định dạng
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Chuyển Date object sang key 'YYYY-MM' (Month Key) */
const monthKey = (date: Date): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

/** Lấy ngày đầu tiên của tháng */
const getFirstDayOfMonth = (date: Date): string => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return dateKey(d);
};

/** Lấy ngày cuối cùng của tháng */
const getLastDayOfMonth = (date: Date): string => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return dateKey(d);
};

/** Lấy ngày đầu tiên của tuần (Thứ Hai) */
const getStartOfWeek = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Điều chỉnh để bắt đầu từ Thứ Hai
  d.setDate(diff);
  return dateKey(d);
};

/** Lấy ngày cuối cùng của tuần (Chủ Nhật) */
const getEndOfWeek = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  // Nếu là Chủ Nhật (0) thì diff là 0, nếu không thì 7 - day
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  d.setDate(diff);
  return dateKey(d);
};


// --- CÁC COMPONENT CON (UI/Logic) ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  // Sửa lỗi: Đặt 'loading' là optional hoặc cung cấp giá trị mặc định cho nó trong component
  loading?: boolean;
  primary?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, loading = false, primary = true, ...props }) => (
  <button
    onClick={onClick}
    disabled={loading || props.disabled}
    className={`
      px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-200
      shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed
      ${primary
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }
    `}
    {...props}
  >
    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : children}
  </button>
);

interface UserSelectionSectionProps {
  allUsers: UserWithOrganization[];
  organizations: OrganizationType[];
  selectedOrganizationId: string;
  setSelectedOrganizationId: (id: string) => void;
  nameFilter: string;
  setNameFilter: (name: string) => void;
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  filteredUsers: UserWithOrganization[];
  isLoadingUsers: boolean;
  isLoadingOrganizations: boolean;
}

const UserSelectionSection: React.FC<UserSelectionSectionProps> = ({
  allUsers,
  organizations,
  selectedOrganizationId,
  setSelectedOrganizationId,
  nameFilter,
  setNameFilter,
  selectedUserId,
  setSelectedUserId,
  filteredUsers,
  isLoadingUsers,
  isLoadingOrganizations
}) => {
  const isLoading = isLoadingUsers || isLoadingOrganizations;
  const EMPTY_ORGS: OrganizationType[] = useMemo(() => [], []);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl space-y-4">
      <h2 className="text-2xl font-bold flex items-center text-blue-700">
        <Users className="w-6 h-6 mr-2" />
        1. Chọn Người Dùng
      </h2>

      {isLoading && <p className="text-blue-500 flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />Đang tải dữ liệu người dùng...</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lọc theo Phòng Ban */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Briefcase className="w-4 h-4 inline mr-1 text-gray-500" />
            Phòng Ban
          </label>
          <select
            value={selectedOrganizationId}
            onChange={(e) => setSelectedOrganizationId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150"
          >
            <option value="">-- Tất Cả Phòng Ban --</option>
            {(organizations ?? EMPTY_ORGS).map((org) => (
              <option key={org._id} value={org._id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Lọc theo Tên */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <User className="w-4 h-4 inline mr-1 text-gray-500" />
            Tìm theo Tên
          </label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Nhập tên người dùng..."
            className="w-full p-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150"
          />
        </div>

        {/* Chọn Người Dùng Cụ Thể */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <User className="w-4 h-4 inline mr-1 text-gray-500" />
            Người Dùng Cần Chạy Job
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            disabled={isLoading}
          >
            <option value="">-- Chọn Người Dùng --</option>
            {filteredUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {user.fullName} ({user.organizationName})
              </option>
            ))}
          </select>
          <p className="text-xs mt-1 text-gray-500">
            Đang hiển thị: {filteredUsers.length} người dùng
          </p>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT CHÍNH ---

const AttendanceJobsRunner: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');

  // States cho Job Monthly Summary
  const initialMonthKey = monthKey(new Date());
  const [monthKeySummary, setMonthKeySummary] = useState<string>(initialMonthKey);
  const [isMonthlyJobLoading, setIsMonthlyJobLoading] = useState<boolean>(false);
  const [monthlyJobResult, setMonthlyJobResult] = useState<string>('');
  const [monthlyAllUsers, setMonthlyAllUsers] = useState<boolean>(false); // Checkbox cho "Tất cả user"

  // States cho Job Logs Over Night
  const todayKey = dateKey(new Date());
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [rangeFrom, setRangeFrom] = useState<string>(dateKey(thirtyDaysAgo));
  const [rangeTo, setRangeTo] = useState<string>(todayKey);
  const [isLogsJobLoading, setIsLogsJobLoading] = useState<boolean>(false);
  const [logsJobResult, setLogsJobResult] = useState<string>('');
  const [logsAllUsers, setLogsAllUsers] = useState<boolean>(false); // Checkbox cho "Tất cả user"

  // --- SWR Data Fetching (Mocking exam.txt structure) ---
  const EMPTY_USERS: UserWithOrganization[] = useMemo(() => [], []);
  const EMPTY_ORGS: OrganizationType[] = useMemo(() => [], []);

  const [isDailyBatchJobLoading, setIsDailyBatchJobLoading] = useState<boolean>(false);
  const [dailyBatchJobResult, setDailyBatchJobResult] = useState<string>('');

  const getAllSegmentsFromString = (fullString?: string) => {
    return fullString?.split('/').filter(Boolean) ?? [];
  };


  // Mock SWR for Users
  const { data: usersData, isLoading: isLoadingUsers } = useSWR<UserWithOrganization[]>(
    `${API_BASE}/users/withOrganizationName`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const allUsers = usersData ?? EMPTY_USERS;

  // Mock SWR for Organizations
  const { data: orgsData, isLoading: isLoadingOrganizations } = useSWR<OrganizationType[]>(
    `${API_BASE}/organizations/under`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const organizations = orgsData ?? EMPTY_ORGS;

  // --- Logic Lọc Người Dùng (Dựa trên exam.txt) ---
  const filteredUsers = useMemo<UserWithOrganization[]>(() => {
    let users = allUsers;

    // 1. Lọc theo Organization
    if (selectedOrganizationId) {
      users = users.filter(user => {
        const segments = getAllSegmentsFromString(user.organizationPath);
        if (user.organizationId) {
          segments.push(user.organizationId);
        }
        return segments.includes(selectedOrganizationId);
      });
    }

    // 2. Lọc theo Name (case-insensitive)
    if (nameFilter) {
      const lowerCaseFilter = nameFilter.toLowerCase();
      users = users.filter(user => user.fullName.toLowerCase().includes(lowerCaseFilter));
    }

    // Nếu người dùng đã chọn trước đó không còn trong danh sách lọc, reset
    if (selectedUserId && !users.some(u => u._id === selectedUserId)) {
      setSelectedUserId('');
    }

    return users;
  }, [allUsers, selectedOrganizationId, nameFilter, selectedUserId]);

  // --- HANDLERS CHẠY JOB ---



  const showJobStatus = (
    key: 'monthly' | 'logs' | 'dailyBatch',
    result: any,
    isError: boolean = false,
  ) => {
    const statusText = isError
      ? `LỖI: ${result.message || JSON.stringify(result)}`
      : `THÀNH CÔNG: ${JSON.stringify(result)}`;

    if (key === 'monthly') {
      setMonthlyJobResult(statusText);
    } else if (key === 'logs') {
      setLogsJobResult(statusText);
    } else if (key === 'dailyBatch') {
      setDailyBatchJobResult(statusText);
    }
  };

  const handleRunJob = async (
    endpoint: string,
    payload: any,
    jobKey: 'monthly' | 'logs' | 'dailyBatch',
  ) => {
    const setLoading =
      jobKey === 'monthly'
        ? setIsMonthlyJobLoading
        : jobKey === 'logs'
          ? setIsLogsJobLoading
          : setIsDailyBatchJobLoading;

    setLoading(true);

    try {
      // Nếu endpoint bắt đầu bằng '/', coi là path đầy đủ; nếu không thì gắn vào /attendance-job
      const url = endpoint.startsWith('/')
        ? `${API_BASE}${endpoint}`
        : `${API_BASE}/attendance-job/${endpoint}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Cố gắng đọc lỗi JSON từ body
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { message: `Lỗi HTTP ${res.status}: ${res.statusText}` };
        }
        showJobStatus(jobKey, errorData, true);
        return;
      }

      const result = await res.json();
      showJobStatus(jobKey, result, false);

    } catch (error: any) {
      console.error(`Error running job ${endpoint}:`, error);
      showJobStatus(jobKey, { message: error.message || 'Lỗi mạng hoặc server không phản hồi.' }, true);
    } finally {
      setLoading(false);
    }
  };

  // 1. Run Monthly Summary
  const handleRunMonthlySummary = (): void => {
    if (!monthlyAllUsers && !selectedUserId) {
      setMonthlyJobResult('Vui lòng chọn người dùng hoặc chọn "Tất cả Người Dùng".');
      return;
    }

    const payload: { monthKey: string; userId?: string } = {
      monthKey: monthKeySummary,
    };
    if (!monthlyAllUsers && selectedUserId) {
      payload.userId = selectedUserId;
    }

    handleRunJob('runMonthlySummary', payload, 'monthly');
  };

  // 2. Run Logs Over Night To Daily Manual
  const handleRunLogsOverNight = (): void => {
    if (!logsAllUsers && !selectedUserId) {
      setLogsJobResult('Vui lòng chọn người dùng hoặc chọn "Tất cả Người Dùng".');
      return;
    }

    // Kiểm tra from/to là MANDATORY cho chạy thủ công
    if (!rangeFrom || !rangeTo) {
      setLogsJobResult('Vui lòng chọn đầy đủ ngày Bắt Đầu và Kết Thúc (YYYY-MM-DD).');
      return;
    }

    // Đảm bảo from <= to
    if (rangeFrom > rangeTo) {
      setLogsJobResult('LỖI: Ngày Bắt Đầu không được lớn hơn Ngày Kết Thúc.');
      return;
    }

    const payload: { from: string; to: string; userId?: string } = {
      from: rangeFrom,
      to: rangeTo,
    };
    if (!logsAllUsers && selectedUserId) {
      payload.userId = selectedUserId;
    }

    handleRunJob('runLogsOverNightToDailyManual', payload, 'logs');
  };

  const handleRunDailyRecomputeRange = (): void => {
    // bắt buộc from/to
    if (!rangeFrom || !rangeTo) {
      setDailyBatchJobResult('Vui lòng chọn đầy đủ ngày Bắt Đầu và Kết Thúc (YYYY-MM-DD).');
      return;
    }

    if (rangeFrom > rangeTo) {
      setDailyBatchJobResult('LỖI: Ngày Bắt Đầu không được lớn hơn Ngày Kết Thúc.');
      return;
    }

    // Nếu có selectedUserId -> chỉ chạy user đó; nếu không -> lấy tất cả user đang được filter
    const userIds = selectedUserId
      ? [selectedUserId]
      : filteredUsers.map((u) => u._id);

    if (!userIds.length) {
      setDailyBatchJobResult('Không có người dùng nào trong danh sách lọc hiện tại.');
      return;
    }

    const payload = {
      userIds,
      from: rangeFrom,
      to: rangeTo,
    };

    // gọi endpoint batch bên backend: POST /attendance-daily/recompute-range-batch
    handleRunJob('/attendance/recompute', payload, 'dailyBatch');
  };

  // --- UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <h1 className="text-3xl font-extrabold text-gray-800 mb-8 border-b-4 border-blue-500 pb-2">
        Công Cụ Chạy Jobs Tính lương Thủ Công
      </h1>

      {/* 1. User Selection Section */}
      <UserSelectionSection
        allUsers={allUsers}
        organizations={organizations}
        selectedOrganizationId={selectedOrganizationId}
        setSelectedOrganizationId={setSelectedOrganizationId}
        nameFilter={nameFilter}
        setNameFilter={setNameFilter}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        filteredUsers={filteredUsers}
        isLoadingUsers={isLoadingUsers}
        isLoadingOrganizations={isLoadingOrganizations}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* 2. Monthly Summary Job */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 space-y-4">
          <h2 className="text-2xl font-bold flex items-center text-green-700 border-b pb-2">
            <Calendar className="w-6 h-6 mr-2" />
            Job: Tổng Hợp từ chấm công ngày thành tháng
          </h2>

          {/* Time Picker */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              <ChevronDown className="w-4 h-4 inline mr-1 text-gray-500" />
              Chọn Tháng (YYYY-MM)
            </label>
            <input
              type="month"
              value={monthKeySummary}
              onChange={(e) => setMonthKeySummary(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl focus:ring-green-500 focus:border-green-500 transition duration-150"
            />
          </div>

          {/* User Option */}
          <div className="flex items-center space-x-4 pt-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={monthlyAllUsers}
                onChange={(e) => {
                  setMonthlyAllUsers(e.target.checked);
                  // Khi chọn "Tất cả Users", ta bỏ chọn cá nhân để tránh gửi cả 2
                  if (e.target.checked) setSelectedUserId('');
                }}
                className="rounded text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">Tất cả Người Dùng</span>
            </label>
            <span className="text-sm text-gray-500">
              (UserId: {monthlyAllUsers ? 'Tất cả' : (selectedUserId || 'Chưa chọn')})
            </span>
          </div>

          {/* Run Button */}
          <Button
            onClick={handleRunMonthlySummary}
            loading={isMonthlyJobLoading}
            primary={true}
            disabled={!monthlyAllUsers && !selectedUserId}
          >
            Chạy Job Monthly Summary
          </Button>

          {/* Status */}
          <div className="mt-4 p-3 bg-gray-100 rounded-xl text-sm break-words whitespace-pre-wrap">
            <p className="font-semibold text-gray-700">Trạng Thái Job:</p>
            <p className={`${monthlyJobResult.startsWith('LỖI') ? 'text-red-500' : 'text-gray-900'}`}>
              {monthlyJobResult || 'Chưa chạy...'}
            </p>
          </div>
        </div>

        {/* 3. Logs Over Night To Daily Manual Job */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 space-y-4">
          <h2 className="text-2xl font-bold flex items-center text-orange-700 border-b pb-2">
            <Calendar className="w-6 h-6 mr-2" />
            Job: Chạy dữ liệu chấm công để tính ngày công
          </h2>



          {/* Time Range Pickers */}
          <div className="space-y-3">
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Từ Ngày (From)</label>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500 transition duration-150"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Đến Ngày (To)</label>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500 transition duration-150"
                />
              </div>
            </div>

            {/* Quick Range Selectors (Month/Week) */}
            <div className="flex gap-2 text-xs">
              <Button
                // Sửa lỗi: Thêm loading={false} vào các button không liên quan đến state loading của job
                loading={false}
                primary={false}
                onClick={() => {
                  setRangeFrom(getFirstDayOfMonth(new Date()));
                  setRangeTo(getLastDayOfMonth(new Date()));
                }}
                className="py-1 px-3 text-xs"
              >
                Tháng Hiện Tại
              </Button>
              <Button
                // Sửa lỗi: Thêm loading={false} vào các button không liên quan đến state loading của job
                loading={false}
                primary={false}
                onClick={() => {
                  setRangeFrom(getStartOfWeek(new Date()));
                  setRangeTo(getEndOfWeek(new Date()));
                }}
                className="py-1 px-3 text-xs"
              >
                Tuần Hiện Tại
              </Button>
            </div>
          </div>

          {/* User Option */}
          <div className="flex items-center space-x-4 pt-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={logsAllUsers}
                onChange={(e) => {
                  setLogsAllUsers(e.target.checked);
                  // Khi chọn "Tất cả Users", ta bỏ chọn cá nhân để tránh gửi cả 2
                  if (e.target.checked) setSelectedUserId('');
                }}
                className="rounded text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Tất cả Người Dùng</span>
            </label>
            <span className="text-sm text-gray-500">
              (UserId: {logsAllUsers ? 'Tất cả' : (selectedUserId || 'Chưa chọn')})
            </span>
          </div>

          {/* Run Button */}
          <Button
            onClick={handleRunLogsOverNight}
            loading={isLogsJobLoading}
            primary={true}
            disabled={!logsAllUsers && !selectedUserId}
          >
            Chạy Job Logs To Daily
          </Button>

          {/* Status */}
          <div className="mt-4 p-3 bg-gray-100 rounded-xl text-sm break-words whitespace-pre-wrap">
            <p className="font-semibold text-gray-700">Trạng Thái Job:</p>
            <p className={`${logsJobResult.startsWith('LỖI') ? 'text-red-500' : 'text-gray-900'}`}>
              {logsJobResult || 'Chưa chạy...'}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white p-6 rounded-2xl shadow-xl border border-blue-100 space-y-4">
        <h2 className="text-2xl font-bold flex items-center text-purple-700 border-b pb-2">
          <Calendar className="w-6 h-6 mr-2" />
          Job: Tính lại công theo khoảng ngày (batch Daily)
        </h2>

        <p className="text-sm text-gray-600">
          - Nếu chọn <b>một nhân viên</b> ở trên: job sẽ chỉ chạy cho nhân viên đó. <br />
          - Nếu <b>không chọn nhân viên</b>: job sẽ chạy cho <b>toàn bộ nhân viên trong danh sách lọc</b>
          (theo Phòng ban + Tên).
        </p>

        {/* Dùng lại khoảng ngày rangeFrom / rangeTo */}
        <div className="space-y-3">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Từ Ngày (From)
              </label>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 transition duration-150"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Đến Ngày (To)
              </label>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-purple-500 transition duration-150"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Có thể dùng lại khoảng ngày giống Job Logs To Daily phía trên.
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Người đang chọn:{' '}
            {selectedUserId
              ? filteredUsers.find((u) => u._id === selectedUserId)?.fullName || selectedUserId
              : 'Không - sẽ chạy cho toàn bộ danh sách lọc'}
          </span>
          <span>Đang lọc: {filteredUsers.length} người dùng</span>
        </div>

        <Button
          onClick={handleRunDailyRecomputeRange}
          loading={isDailyBatchJobLoading}
          primary={true}
        >
          Chạy Job Tính Lại Công (Daily Batch)
        </Button>

        <div className="mt-4 p-3 bg-gray-100 rounded-xl text-sm break-words whitespace-pre-wrap">
          <p className="font-semibold text-gray-700">Trạng Thái Job:</p>
          <p
            className={
              dailyBatchJobResult.startsWith('LỖI') ? 'text-red-500' : 'text-gray-900'
            }
          >
            {dailyBatchJobResult || 'Chưa chạy...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceJobsRunner;