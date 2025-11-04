'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Clock, User, Calendar, Search, ChevronDown, ChevronUp } from 'lucide-react';
//import { headers } from 'next/headers';
import { UserWithOrganization } from "@/types";
import { Organization as OrganizationType } from "@/types/organization";
import { getOrganizations } from "@/lib/api/organizations";
import { getUsersUnderOrganizations, getUserWithOrganizationUnder } from "@/lib/api/users";


// --- API Client Helpers (Áp dụng Exponential Backoff) ---

// Vui lòng thay đổi URL API thực tế của bạn
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const USER_POLICY_BASE_URL = `${API_BASE}/user-policy-bindings`;
const SHIFT_TYPE_BASE_URL = `${API_BASE}/shift-types`;
// Thêm API endpoint cho User
const USER_BASE_URL = `${API_BASE}/users`;

const MAX_RETRIES = 3;

// Enum cho Policy Type (Lấy từ file user-policy-type.enum.ts)
const UserPolicyType = {
    SHIFT_TYPE: 'SHIFT_TYPE',
};

// Hàm delay (giả lập)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm fetcher cơ bản với exponential backoff
const fetcher = async <T,>(url: string): Promise<T> => {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) {
                // Nếu là lỗi 4xx/5xx, throw ngay để không retry
                const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`HTTP Error ${response.status}: ${errorBody.message}`);
            }
            return response.json() as Promise<T>;
        } catch (error) {
            if (i === MAX_RETRIES - 1) {
                throw error;
            }
            const delayTime = Math.pow(2, i) * 1000;
            console.warn(`Fetch thất bại cho ${url}. Thử lại sau ${delayTime}ms...`);
            await delay(delayTime);
        }
    }
    throw new Error("Không thể kết nối đến máy chủ API.");
};

// --- Định nghĩa Types (Dựa trên DTO và Schema) ---

// Kiểu dữ liệu UserLite (Người dùng đơn giản) - Mới được thêm
interface UserLite {
    _id: string; // ID người dùng thực tế
    fullName: string; // Tên hiển thị
}

// Kiểu dữ liệu ShiftType (để làm danh sách Policy Code)
interface ShiftType {
    _id: string;
    code: string; // Đây là policyCode
    name: string;
}

// Kiểu dữ liệu Binding (Dựa trên UserPolicyBinding Schema)
interface UserPolicyBinding {
    _id: string;
    userId: string; // Types.ObjectId
    policyType: string; // Luôn là SHIFT_TYPE
    policyCode: string; // Mã ca làm (ví dụ: REGULAR)
    effectiveFrom?: string; // YYYY-MM-DD
    effectiveTo?: string; // YYYY-MM-DD
    createdAt: string;
    updatedAt: string;
}

// Kiểu dữ liệu DTO cho Create/Update
interface CreatePolicyBindingDto {
    userId: string;
    policyType: string;
    policyCode: string;
    effectiveFrom: string;
    effectiveTo: string;
}

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

    if (res.status === 204) return null;
    let txt = "";
    try { txt = await res.text(); } catch { return null; }
    if (!txt || !txt.trim()) return null;

    if (isJson) {
        try { return JSON.parse(txt); } catch { return { data: txt }; }
    }
    return { data: txt };
}

/**
 * Custom Hook SWR đơn giản
 * @param key Khóa SWR, có thể là string URL hoặc object
 * @param fetcher Hàm fetch dữ liệu
 */
function useSWR<T>(key: any, fetcher: (key: any) => Promise<any>) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!key);
    const [error, setError] = useState<any>(null);
    // Sử dụng JSON.stringify cho key là object/array, key là string thì dùng trực tiếp
    const fetchKey = typeof key === "string" ? key : JSON.stringify(key);

    useEffect(() => {
        // Nếu key không hợp lệ (null, undefined, string rỗng), dừng fetch
        if (!fetchKey || fetchKey === "null" || (typeof key === 'string' && key.trim() === '')) {
            setData(null); setIsLoading(false); setError(null); return;
        }

        let cancelled = false;
        setIsLoading(true); setError(null);

        // Bọc fetcher để đảm bảo kiểu trả về là T (dùng key làm tham số)
        fetcher(key)
            .then((res: any) => {
                if (!cancelled) {
                    // Xử lý response nếu API trả về cấu trúc { items: T[] } hoặc { data: T }
                    const result = Array.isArray(res) ? res : res;
                    setData(result as T);
                }
            })
            .catch((e: any) => {
                if (!cancelled) {
                    console.error("SWR Fetch Error:", e);
                    setError(e);
                }
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, [fetchKey, fetcher]);

    // mutate là hàm dùng để re-fetch, ở đây ta tạo một hàm rỗng đơn giản
    // Trong ứng dụng thực tế, hàm này sẽ kích hoạt useEffect bằng cách thay đổi state nội bộ
    const mutate = useCallback(() => {
        // Giả lập re-fetch bằng cách thay đổi một state key
        // Trong môi trường SWR thực, nó sẽ kích hoạt lại useEffect
        // Ở đây, ta chỉ cần gọi lại fetchBindings thủ công trong component chính
    }, []);

    return { data, isLoading, error, mutate };
}


/**
 * Client cho User API (Mới được thêm)
 */
const userApi = {
    // Giả định API GET /users trả về { items: UserLite[] }
    findAllUsers: async (): Promise<UserLite[]> => {
        // Sử dụng endpoint /users/by-organization như yêu cầu hoặc endpoint chung
        const response = await fetcher<UserLite[]>(`${USER_BASE_URL}/by-organization?limit=1000`);
        return response;
    }
}


/**
 * Client cho User Policy Binding API
 */
const userPolicyApi = {
    // API GET /user-policy-bindings?userId=...&policyType=SHIFT_TYPE
    findAll: async (userId: string): Promise<UserPolicyBinding[]> => {
        const url = `${USER_POLICY_BASE_URL}?userId=${userId}&policyType=${UserPolicyType.SHIFT_TYPE}`;
        return fetcher(url);
    },

    // API POST /user-policy-bindings
    create: async (dto: CreatePolicyBindingDto): Promise<UserPolicyBinding> => {
        const response = await fetch(USER_POLICY_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
            throw new Error(`Tạo thất bại: ${errorBody.message}`);
        }
        return response.json();
    },

    // API PUT /user-policy-bindings/:id
    update: async (id: string, dto: CreatePolicyBindingDto): Promise<UserPolicyBinding> => {
        const response = await fetch(`${USER_POLICY_BASE_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
            throw new Error(`Cập nhật thất bại: ${errorBody.message}`);
        }
        return response.json();
    },

    // API DELETE /user-policy-bindings/:id
    delete: async (id: string): Promise<void> => {
        const response = await fetch(`${USER_POLICY_BASE_URL}/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
            throw new Error(`Xóa thất bại: ${errorBody.message}`);
        }
    },
};

/**
 * Client cho Shift Type API
 */
const shiftTypeApi = {
    // Giả định API GET /shift-types trả về { items: ShiftType[] }
    findAllCodes: async (): Promise<ShiftType[]> => {
        const response = await fetcher<{ items: ShiftType[] }>(`${SHIFT_TYPE_BASE_URL}?limit=1000`);
        return response.items;
    },
};

// --- Form Modal Component ---

interface PolicyFormProps {
    userId: string; // Mới: Nhận userId đã chọn
    shiftTypes: ShiftType[];
    initialData: UserPolicyBinding | null;
    onClose: () => void;
    onSave: (data: CreatePolicyBindingDto, id?: string) => Promise<void>;
}

const PolicyForm: React.FC<PolicyFormProps> = ({ userId, shiftTypes, initialData, onClose, onSave }) => {
    const [policyCode, setPolicyCode] = useState(initialData?.policyCode || (shiftTypes[0]?.code || ''));
    const [effectiveFrom, setEffectiveFrom] = useState(initialData?.effectiveFrom || new Date().toISOString().substring(0, 10));
    const [effectiveTo, setEffectiveTo] = useState(initialData?.effectiveTo && initialData.effectiveTo !== '9999-12-31' ? initialData.effectiveTo : '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const title = initialData ? 'Chỉnh Sửa Ràng Buộc' : 'Tạo Ràng Buộc Ca Làm Mới';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        setIsSaving(true);

        // Chuẩn hóa effectiveTo: nếu rỗng, gán '9999-12-31' (vô thời hạn)
        const finalEffectiveTo = effectiveTo.trim() === '' ? '9999-12-31' : effectiveTo;

        if (new Date(effectiveFrom) > new Date(finalEffectiveTo)) {
            setSaveError("Ngày hiệu lực BẮT ĐẦU không được sau ngày hiệu lực KẾT THÚC.");
            setIsSaving(false);
            return;
        }

        try {
            const dto: CreatePolicyBindingDto = {
                userId: userId, // Dùng userId được truyền vào
                policyType: UserPolicyType.SHIFT_TYPE,
                policyCode: policyCode,
                effectiveFrom: effectiveFrom,
                effectiveTo: finalEffectiveTo,
            };
            await onSave(dto, initialData?._id);
            onClose();
        } catch (err: any) {
            setSaveError(err.message || 'Lưu thất bại. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
                <header className="p-5 border-b flex justify-between items-center bg-indigo-600 text-white">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-white hover:text-indigo-100 transition">
                        <X className="w-6 h-6" />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <p className="text-sm text-gray-600 bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                        Gán cho User ID: <code className="font-mono text-xs font-semibold text-indigo-800">{userId}</code>
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ca Làm (Policy Code)</label>
                        <select
                            value={policyCode}
                            onChange={(e) => setPolicyCode(e.target.value)}
                            required
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition"
                        >
                            {shiftTypes.map(type => (
                                <option key={type.code} value={type.code}>{type.name} ({type.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex space-x-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hiệu Lực Từ (YYYY-MM-DD)</label>
                            <input
                                type="date"
                                value={effectiveFrom}
                                onChange={(e) => setEffectiveFrom(e.target.value)}
                                required
                                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hiệu Lực Đến (Để trống là Vô thời hạn)</label>
                            <input
                                type="date"
                                value={effectiveTo}
                                onChange={(e) => setEffectiveTo(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition"
                            />
                        </div>
                    </div>

                    {saveError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Lỗi:</strong>
                            <span className="block sm:inline ml-2">{saveError}</span>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
                            disabled={isSaving}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition disabled:bg-indigo-400"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Đang Lưu...' : (initialData ? 'Cập Nhật' : 'Tạo Mới')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main Page Component ---

const UserShiftPolicyPage: React.FC = () => {

    // 1. Tải danh sách người dùng bằng useSWR
    // Key: USER_BASE_URL để đảm bảo refetch khi cần (mặc dù ở đây ta không dùng mutate)
    // const { 
    //     data: users, 
    //     isLoading: isLoadingUsers, 
    //     error: usersError, 
    //     mutate: mutateUsers 
    // } = useSWR<UserLite[]>(USER_BASE_URL, userApi.findAllUsers);

    // 2. State cho User ID được chọn
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const [bindings, setBindings] = useState<UserPolicyBinding[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
    const [isLoadingBindings, setIsLoadingBindings] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBinding, setEditingBinding] = useState<UserPolicyBinding | null>(null);


    const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(''); // Rỗng là "Tất cả"   
    const EMPTY_USERS: UserWithOrganization[] = React.useMemo(() => [], []);
    const EMPTY_ORGS: OrganizationType[] = React.useMemo(() => [], []);
    const [nameFilter, setNameFilter] = useState<string>('');

    const [usersLoading, setUsersLoading] = useState(false);
    
    const { data: users, isLoading: isLoadingUsers } = useSWR<UserWithOrganization[]>("/users/withOrganizationName", api);
    const { data: orgsData, isLoading: isLoadingOrganizations } = useSWR<OrganizationType[]>("/organizations/under", api);

    const allUsers = users ?? EMPTY_USERS;
    const organizations = orgsData ?? EMPTY_ORGS;

    const filteredUsers = useMemo(() => {
        let userData = allUsers;

        // 1. Lọc theo Organization
        if (selectedOrganizationId) {
            userData = userData.filter(user => user.organizationId === selectedOrganizationId);
        }

        // 2. Lọc theo Tên
        if (nameFilter) {
            const lowerCaseFilter = nameFilter.toLowerCase();
            userData = userData.filter(user => user.fullName.toLowerCase().includes(lowerCaseFilter));
        }

        return userData;
    }, [users, selectedOrganizationId, nameFilter]);

    // Tải danh sách Shift Types (Policy Code)
    const fetchShiftTypes = useCallback(async () => {
        try {
            const types = await shiftTypeApi.findAllCodes();
            setShiftTypes(types);
        } catch (err: any) {
            console.error('Lỗi tải Shift Types:', err);
        }
    }, []);

    // Tải danh sách Bindings theo userId
    const fetchBindings = useCallback(async (currentUserId: string | null) => {
        if (!currentUserId) {
            setBindings([]);
            setError("Vui lòng chọn một người dùng.");
            return;
        }

        setIsLoadingBindings(true);
        setError(null);
        try {
            // API Call: GET /user-policy-bindings?userId=...&policyType=SHIFT_TYPE
            const data = await userPolicyApi.findAll(currentUserId);
            console.log('data', data);

            // Sắp xếp theo effectiveFrom
            const sortedItems = data.length
                ? data.sort((a, b) =>
                    (a.effectiveFrom || '0001-01-01').localeCompare(b.effectiveFrom || '0001-01-01')
                )
                : [];
            setBindings(sortedItems);
        } catch (err: any) {
            console.error(err);
            setError(`Không thể tải ràng buộc: ${err.message}`);
        } finally {
            setIsLoadingBindings(false);
        }
    }, []);

    // Effect khởi tạo: Tải Shift Types
    useEffect(() => {
        fetchShiftTypes();
    }, [fetchShiftTypes]);

    // Effect: Set User ID mặc định sau khi users được tải
    useEffect(() => {
        if (users && users.length > 0 && !selectedUserId) {
            setSelectedUserId(users[0]._id);
        }
    }, [users, selectedUserId]);

    // Effect: Tải bindings khi selectedUserId thay đổi
    useEffect(() => {
        if (selectedUserId) {
            fetchBindings(selectedUserId);
        } else {
            setBindings([]); // Xóa bindings khi không có user được chọn
        }
    }, [selectedUserId, fetchBindings]);


    const handleSave = async (data: CreatePolicyBindingDto, id?: string) => {
        if (!selectedUserId) {
            setError("Lỗi: Không có người dùng nào được chọn.");
            throw new Error("Không có người dùng nào được chọn.");
        }

        // userId đã được thêm vào data trong PolicyForm (nhưng ta kiểm tra lần nữa)
        const finalData = { ...data, userId: selectedUserId };

        if (id) {
            await userPolicyApi.update(id, finalData);
        } else {
            await userPolicyApi.create(finalData);
        }
        // Re-fetch bindings sau khi lưu thành công
        await fetchBindings(selectedUserId);
    };

    const handleDelete = async (id: string) => {
        // Thay window.confirm bằng modal UI thực tế
        if (typeof window !== 'undefined' && !window.confirm('Bạn có chắc chắn muốn xóa Ràng buộc chính sách này không?')) {
            return;
        }

        if (selectedUserId) {
            try {
                await userPolicyApi.delete(id);
                // Re-fetch bindings sau khi xóa thành công
                await fetchBindings(selectedUserId);
            } catch (err: any) {
                console.error('Xóa thất bại:', err);
                setError(`Xóa thất bại: ${err.message}`);
            }
        }
    };

    const handleEdit = (binding: UserPolicyBinding) => {
        setEditingBinding(binding);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingBinding(null);
        if (!selectedUserId) {
            setError("Vui lòng chọn một người dùng trước khi tạo.");
            return;
        }
        setIsModalOpen(true);
    };

    // Hàm xử lý thay đổi người dùng
    const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newUserId = e.target.value;
        setSelectedUserId(newUserId === '' ? null : newUserId);
        setError(null);
    };


    const selectedUser = users?.find(u => u._id === selectedUserId);    

    // UI Loading tổng thể
    if (isLoadingUsers && !users) {
        return (
            <div className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                <p className="ml-4 text-indigo-600 font-medium">Đang tải dữ liệu khởi tạo...</p>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-4 sm:mb-0">
                    <Clock className="w-7 h-7 inline-block mr-2 text-indigo-600" /> Quản Lý Ca Làm Người Dùng
                </h1>
                <button
                    onClick={handleCreate}
                    // Chỉ cho phép tạo khi đã chọn User và có Shift Type
                    disabled={!selectedUserId || shiftTypes.length === 0}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400"
                >
                    <Plus className="w-5 h-5 mr-2" /> Gán Ca Mới
                </button>
            </header>

            {/* User Selector (Mới) */}
            <div className="mb-6 p-4 bg-white rounded-xl shadow-lg border border-indigo-200">
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
                            <option key={org._id} value={org._id}>
                                {org.name}
                            </option>
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
                <label className="block text-lg font-semibold text-gray-800 mb-2 flex items-center">
                    <User className="w-5 h-5 mr-2 text-indigo-500" />
                    Chọn Người Dùng Để Quản Lý
                </label>
                <div className="relative">
                    <select
                        value={selectedUserId || ''}
                        onChange={handleUserChange}
                        className="w-full p-3 border border-gray-300 rounded-lg font-medium text-base shadow-inner transition appearance-none pr-10 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        disabled={isLoadingUsers || !users || users.length === 0}
                    >
                        {isLoadingUsers && <option value="">Đang tải danh sách người dùng...</option>}
                        {(!filteredUsers || filteredUsers.length === 0) && <option value="">Không tìm thấy người dùng</option>}
                        {!selectedUserId && filteredUsers && filteredUsers.length > 0 && <option value="">-- Chọn Người Dùng --</option>}
                        {filteredUsers?.map(filteredUsers => (
                            <option key={filteredUsers._id} value={filteredUsers._id}>
                                {filteredUsers.fullName} ({filteredUsers._id})
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>

                {selectedUser && (
                    <p className="text-sm text-gray-500 mt-2">
                        Người dùng được chọn: <code className="font-mono text-xs bg-gray-100 p-1 rounded break-all font-semibold text-indigo-700">{selectedUser.fullName}</code>
                    </p>
                )}
                {shiftTypes.length === 0 && (
                    <p className="text-sm text-yellow-600 mt-2">⚠️ Cần tạo Shift Types (Policy Code) trước khi gán ca làm.</p>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                    <strong className="font-bold">Lỗi:</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                </div>
            )}

            <div className="bg-white shadow-xl rounded-xl overflow-hidden mt-8">
                <div className="bg-gray-100 p-4 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">
                        Danh Sách Ràng Buộc Ca Làm
                    </h3>
                    <p className="text-sm text-gray-500">
                        Hiển thị các ca làm được gán cho User: <code className="font-bold text-indigo-800">{selectedUser ? selectedUser.fullName : 'Chưa chọn'}</code>
                    </p>
                </div>
                {isLoadingBindings ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 inline-block"></div>
                        <p className="mt-2">Đang tải dữ liệu ràng buộc...</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Mã Ca Làm (Code)
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tên Ca Làm
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Hiệu Lực Từ
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Hiệu Lực Đến
                                </th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Hành Động
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {bindings.length > 0 ? (
                                bindings.map((binding) => {
                                    const shiftType = shiftTypes.find(st => st.code === binding.policyCode);
                                    const effectTo = binding.effectiveTo === '9999-12-31' || binding.effectiveTo === null
                                        ? 'Vô thời hạn'
                                        : binding.effectiveTo;

                                    return (
                                        <tr key={binding._id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700">{binding.policyCode}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {shiftType ? shiftType.name : <span className="text-red-500 italic">Code không tồn tại</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                <Calendar className="w-4 h-4 inline-block mr-2 text-green-500" />
                                                {binding.effectiveFrom || '0001-01-01'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                <Calendar className="w-4 h-4 inline-block mr-2 text-red-500" />
                                                {effectTo}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                <div className="flex justify-center space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(binding)}
                                                        className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50 transition"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Pencil className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(binding._id)}
                                                        className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        {selectedUserId ? 'Không có ràng buộc ca làm nào cho người dùng này.' : 'Vui lòng chọn người dùng để xem ràng buộc.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Form */}
            {isModalOpen && selectedUserId && ( // Chỉ mở modal khi có selectedUserId
                <PolicyForm
                    userId={selectedUserId} // Truyền userId đã chọn
                    shiftTypes={shiftTypes}
                    initialData={editingBinding}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default UserShiftPolicyPage;