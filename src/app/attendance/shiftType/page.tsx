'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Clock, User, Calendar, Search, AlertTriangle } from 'lucide-react';

// --- Hằng số và Hàm tiện ích từ effective-range.ts ---

const FROM_MIN = '0001-01-01';
const TO_MAX   = '9999-12-31';

/** Chuẩn hóa effectiveFrom */
const normFrom = (v?: string | null) => {
    return v && v.trim() ? v : FROM_MIN;
};

/** Chuẩn hóa effectiveTo (null hoặc rỗng -> TO_MAX) */
const normTo = (v?: string | null) => {
    // API server sẽ coi null là vô thời hạn. Client cũng nên chuẩn hóa để check overlap.
    return v && v.trim() ? v : TO_MAX;
};

/** Kiểm tra A[from,to] và B[from,to] có chồng lắp không? (khoảng đóng) */
const overlaps = (
    aFrom?: string | null, aTo?: string | null,
    bFrom?: string | null, bTo?: string | null
) => {
    const af = normFrom(aFrom), at = normTo(aTo);
    const bf = normFrom(bFrom), bt = normTo(bTo);
    // Xảy ra overlap nếu KHÔNG phải (aTo < bFrom HOẶC bTo < aFrom)
    return !(at < bf || bt < af);
};

// --- API Client Helpers (Áp dụng Exponential Backoff từ file trước) ---

// Vui lòng thay đổi URL API thực tế của bạn
const USER_POLICY_BASE_URL = 'http://localhost:4000/user-policy-bindings';
const SHIFT_TYPE_BASE_URL = 'http://localhost:4000/shift-types'; 
const MAX_RETRIES = 3;

// Enum cho Policy Type
const UserPolicyType = {
    SHIFT_TYPE: 'SHIFT_TYPE',
};

// --- Định nghĩa Types (Dựa trên DTO và Schema) ---

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
    effectiveTo?: string | null; // YYYY-MM-DD
    createdAt: string;
    // Client side calculated status
    isConflicting?: boolean;
    conflictsWith?: string[];
}

// Kiểu dữ liệu cho Create DTO
interface CreatePolicyBindingDto {
    userId: string;
    policyType: string;
    policyCode: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
}


/**
 * Hàm chờ (delay)
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generic Fetcher với Exponential Backoff để tăng độ ổn định.
 */
async function fetcher<T>(url: string, options: RequestInit = {}, retries: number = 0): Promise<T> {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorDetail = 'Lỗi không xác định';
            try {
                const errorBody = await response.json();
                errorDetail = errorBody.message || errorDetail;
            } catch {
                errorDetail = response.statusText;
            }
            throw new Error(`API Error ${response.status}: ${errorDetail}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json() as T;
        }
        return {} as T; 
    } catch (error) {
        if (retries < MAX_RETRIES) {
            const nextDelay = Math.pow(2, retries) * 1000;
            console.warn(`[API] Lỗi: ${(error as Error).message}. Thử lại sau ${nextDelay}ms... (lần ${retries + 1}/${MAX_RETRIES})`);
            await delay(nextDelay);
            return fetcher(url, options, retries + 1);
        }
        console.error("[API] Thất bại sau nhiều lần thử lại:", error);
        throw error;
    }
}

/**
 * Client cho UserPolicyBinding API
 */
const userPolicyApi = {
    // GET /user-policy-bindings?userId=...&policyType=SHIFT_TYPE
    findAll: async (userId: string): Promise<{ items: UserPolicyBinding[] }> => {
        const searchParams = new URLSearchParams({ 
            userId, 
            policyType: UserPolicyType.SHIFT_TYPE 
        });
        return fetcher<{ items: UserPolicyBinding[] }>(`${USER_POLICY_BASE_URL}?${searchParams.toString()}`);
    },

    // POST /user-policy-bindings
    create: async (data: CreatePolicyBindingDto): Promise<UserPolicyBinding> => {
        return fetcher<UserPolicyBinding>(USER_POLICY_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    // PATCH /user-policy-bindings/:id
    update: async (id: string, data: Partial<CreatePolicyBindingDto>): Promise<UserPolicyBinding> => {
        return fetcher<UserPolicyBinding>(`${USER_POLICY_BASE_URL}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    // DELETE /user-policy-bindings/:id
    delete: async (id: string): Promise<void> => {
        return fetcher<void>(`${USER_POLICY_BASE_URL}/${id}`, {
            method: 'DELETE',
        });
    },
};

/**
 * Client cho ShiftType API (để lấy danh sách Policy Code)
 */
const shiftTypeApi = {
    // GET /shift-types (chỉ cần lấy code và name, không cần pagination vì số lượng thường ít)
    findAllCodes: async (): Promise<ShiftType[]> => {
        // Giả định API /shift-types trả về object { items: ShiftType[] }
        const response = await fetcher<{ items: ShiftType[] }>(SHIFT_TYPE_BASE_URL + '?limit=1000'); 
        return response.items;
    }
}

// --- Component: Form Tạo/Sửa Binding ---

interface PolicyFormProps {
    userId: string;
    shiftTypes: ShiftType[];
    bindings: UserPolicyBinding[]; // Danh sách bindings hiện tại để kiểm tra xung đột
    initialData?: UserPolicyBinding | null;
    onClose: () => void;
    onSave: (data: CreatePolicyBindingDto, id?: string) => Promise<void>;
}

const PolicyForm: React.FC<PolicyFormProps> = ({ userId, shiftTypes, bindings, initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState<CreatePolicyBindingDto>({
        userId,
        policyType: UserPolicyType.SHIFT_TYPE,
        policyCode: initialData?.policyCode || (shiftTypes.length > 0 ? shiftTypes[0].code : ''),
        effectiveFrom: initialData?.effectiveFrom || new Date().toISOString().substring(0, 10), // YYYY-MM-DD
        effectiveTo: initialData?.effectiveTo || '', // null
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEdit = !!initialData;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null); // Clear error on input change
    };
    
    // Xử lý trường effectiveTo
    const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setFormData(prev => ({ ...prev, effectiveTo: value === '' ? null : value }));
        setError(null);
    }

    // --- LOGIC KIỂM TRA XUNG ĐỘT (OVERLAP) ---
    const conflictMessage = useMemo(() => {
        const currentId = initialData?._id;
        const currentFrom = formData.effectiveFrom;
        const currentTo = formData.effectiveTo;
        
        if (!currentFrom) {
            return "Ngày 'Hiệu lực Từ' không được để trống.";
        }

        if (currentTo && currentFrom > currentTo) {
             return "Ngày 'Hiệu lực Từ' phải nhỏ hơn hoặc bằng 'Hiệu lực Đến'.";
        }
        
        let conflictDetails: string[] = [];

        for (const existingBinding of bindings) {
            // Bỏ qua chính binding đang được chỉnh sửa
            if (isEdit && existingBinding._id === currentId) {
                continue;
            }

            // Kiểm tra xung đột với binding hiện tại
            const hasOverlap = overlaps(
                currentFrom, currentTo,
                existingBinding.effectiveFrom, existingBinding.effectiveTo
            );

            if (hasOverlap) {
                const code = existingBinding.policyCode;
                const existingFrom = existingBinding.effectiveFrom || FROM_MIN;
                const existingTo = existingBinding.effectiveTo === null || existingBinding.effectiveTo === TO_MAX 
                    ? 'Vô thời hạn' 
                    : existingBinding.effectiveTo;
                    
                conflictDetails.push(
                    `[${code}] từ ${existingFrom} đến ${existingTo}`
                );
            }
        }

        if (conflictDetails.length > 0) {
            return `Xung đột thời gian với ${conflictDetails.length} ràng buộc hiện có: ${conflictDetails.join(', ')}. Vui lòng điều chỉnh khoảng thời gian.`;
        }

        return null;
    }, [formData.effectiveFrom, formData.effectiveTo, bindings, initialData, isEdit]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (conflictMessage) {
            setError(conflictMessage);
            return;
        }

        setIsLoading(true);
        setError(null);

        // Lọc bỏ effectiveTo rỗng
        const finalData = {
            ...formData,
            effectiveTo: formData.effectiveTo === '' ? null : formData.effectiveTo,
        } as CreatePolicyBindingDto;

        try {
            await onSave(finalData, initialData?._id);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Lưu thất bại. Vui lòng kiểm tra dữ liệu và console.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-800">{isEdit ? 'Sửa Ràng Buộc Ca' : 'Tạo Ràng Buộc Ca Mới'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 border rounded-lg">
                        <User className="w-5 h-5 text-indigo-500" />
                        <span className="font-medium text-gray-700">User ID:</span>
                        <code className="text-sm font-mono bg-white p-1 rounded text-indigo-800 break-all">{userId}</code>
                    </div>

                    {/* Policy Code (Mã Ca) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã Ca Làm (Shift Type Code) <span className="text-red-500">*</span></label>
                        <select
                            name="policyCode"
                            value={formData.policyCode}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            required
                            disabled={isEdit} // Thường không cho phép sửa code, chỉ sửa hiệu lực
                        >
                            {shiftTypes.length === 0 && <option value="">Đang tải mã ca...</option>}
                            {shiftTypes.map(st => (
                                <option key={st.code} value={st.code}>
                                    {st.code} - {st.name}
                                </option>
                            ))}
                        </select>
                        {isEdit && <p className="text-xs text-gray-500 mt-1">Mã ca không thể thay đổi khi chỉnh sửa.</p>}
                        {shiftTypes.length === 0 && <p className="text-xs text-red-500 mt-1">Lưu ý: Không tìm thấy Shift Type nào. Vui lòng tạo Shift Type trước.</p>}
                    </div>

                    {/* Effective Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hiệu lực Từ (From) <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                name="effectiveFrom"
                                value={formData.effectiveFrom}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hiệu lực Đến (To)</label>
                            <input
                                type="date"
                                name="effectiveTo"
                                value={formData.effectiveTo || ''}
                                onChange={handleDateToChange}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Để trống nếu vô thời hạn"
                            />
                            <p className="text-xs text-gray-500 mt-1">Để trống = Vô thời hạn ({TO_MAX}).</p>
                        </div>
                    </div>

                    {/* Conflict Message */}
                    {conflictMessage && (
                        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 rounded" role="alert">
                            <p className="font-bold flex items-center">
                                <AlertTriangle className="w-5 h-5 mr-2" /> Cảnh báo Xung Đột Thời Gian!
                            </p>
                            <p className="text-sm">{conflictMessage}</p>
                        </div>
                    )}
                    
                    {/* API/Submit Error */}
                    {error && !conflictMessage && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded" role="alert">
                            <p className="font-bold">Lỗi</p>
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || shiftTypes.length === 0 || !!conflictMessage}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:bg-indigo-400 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Đang lưu...' : (isEdit ? 'Cập Nhật' : 'Tạo Mới')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main Page Component ---

const UserShiftPolicyPage: React.FC = () => {
    // Giá trị userId giả lập. Trong ứng dụng thực tế, giá trị này sẽ được lấy từ Auth/Context.
    // Lưu ý: User ID phải là ObjectId hợp lệ (24 ký tự hex) để NestJS/Mongoose chấp nhận.
    const [userId, setUserId] = useState('65f3f9829e32a24d2d46e297'); 
    
    const [bindings, setBindings] = useState<UserPolicyBinding[]>([]);
    const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]); // Danh sách Policy Code
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBinding, setEditingBinding] = useState<UserPolicyBinding | null>(null);
    const [inputUserId, setInputUserId] = useState(userId); // Dùng để nhập
    const [isUserIdValid, setIsUserIdValid] = useState(true);

    const isMongoId = (str: string) => /^[0-9a-fA-F]{24}$/.test(str);

    // Tải danh sách Shift Types (Policy Code)
    const fetchShiftTypes = useCallback(async () => {
        try {
            const types = await shiftTypeApi.findAllCodes();
            setShiftTypes(types);
        } catch (err: any) {
            console.error('Lỗi tải Shift Types:', err);
            // Không set global error, chỉ cảnh báo
        }
    }, []);
    
    // Tải danh sách Bindings theo userId và Kiểm tra xung đột (tính toán client-side)
    const fetchBindings = useCallback(async (currentUserId: string) => {
        if (!isMongoId(currentUserId)) {
            setBindings([]);
            setError("User ID không hợp lệ (cần 24 ký tự hex).");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // API Call: GET /user-policy-bindings?userId=...&policyType=SHIFT_TYPE
            const data = await userPolicyApi.findAll(currentUserId);
            
            // Sắp xếp theo effectiveFrom
            const sortedItems = data.items.sort((a, b) => 
                (a.effectiveFrom || FROM_MIN).localeCompare(b.effectiveFrom || FROM_MIN)
            );

            // --- CLIENT-SIDE OVERLAP CHECK (Sau khi tải dữ liệu) ---
            const bindingsWithConflictStatus: UserPolicyBinding[] = sortedItems.map((bindingA, index) => {
                let conflictsWith: string[] = [];

                for (let i = 0; i < sortedItems.length; i++) {
                    const bindingB = sortedItems[i];
                    if (bindingA._id === bindingB._id) continue; // Bỏ qua chính nó

                    const hasOverlap = overlaps(
                        bindingA.effectiveFrom, bindingA.effectiveTo,
                        bindingB.effectiveFrom, bindingB.effectiveTo
                    );

                    if (hasOverlap) {
                        conflictsWith.push(bindingB.policyCode);
                    }
                }
                
                // Loại bỏ trùng lặp và gán trạng thái
                const uniqueConflicts = Array.from(new Set(conflictsWith));
                return {
                    ...bindingA,
                    isConflicting: uniqueConflicts.length > 0,
                    conflictsWith: uniqueConflicts,
                };
            });


            setBindings(bindingsWithConflictStatus);

        } catch (err: any) {
            console.error(err);
            setError(`Không thể tải ràng buộc: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Effect khởi tạo
    useEffect(() => {
        fetchShiftTypes();
    }, [fetchShiftTypes]);

    // Effect tải bindings khi userId thay đổi
    useEffect(() => {
        if (isMongoId(userId)) {
            fetchBindings(userId);
        }
    }, [userId, fetchBindings]);


    const handleSave = async (data: CreatePolicyBindingDto, id?: string) => {
        if (!isMongoId(data.userId)) {
            throw new Error("User ID không hợp lệ.");
        }
        
        if (id) {
            // API Call: PATCH /user-policy-bindings/:id
            await userPolicyApi.update(id, data);
        } else {
            // API Call: POST /user-policy-bindings
            await userPolicyApi.create(data);
        }
        await fetchBindings(userId);
    };

    const handleDelete = async (id: string) => {
        // Thay thế window.confirm bằng modal UI tùy chỉnh trong ứng dụng thực tế
        const confirmed = window.confirm('Bạn có chắc chắn muốn xóa Ràng buộc chính sách này không?');

        if (confirmed) {
            try {
                // API Call: DELETE /user-policy-bindings/:id
                await userPolicyApi.delete(id);
                await fetchBindings(userId);
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
        if (!isMongoId(userId)) {
             setError("Vui lòng nhập một User ID hợp lệ (24 ký tự hex) trước khi tạo.");
             return;
        }
        setIsModalOpen(true);
    };
    
    const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputUserId(value);
        setIsUserIdValid(isMongoId(value));
        if (isMongoId(value)) {
            setError(null);
            setUserId(value); // Cập nhật userId chính thức và trigger fetch
        }
    };


    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-4 sm:mb-0">
                    <Clock className="w-7 h-7 inline-block mr-2 text-indigo-600" /> Gán Ca Làm Cho Người Dùng
                </h1>
                <button
                    onClick={handleCreate}
                    disabled={!isUserIdValid || shiftTypes.length === 0}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400"
                >
                    <Plus className="w-5 h-5 mr-2" /> Gán Ca Mới
                </button>
            </header>

            {/* User ID Input */}
            <div className="mb-6 p-4 bg-white rounded-xl shadow-lg border border-indigo-200">
                <label className="block text-lg font-semibold text-gray-800 mb-2 flex items-center">
                    <User className="w-5 h-5 mr-2 text-indigo-500" /> 
                    Người Dùng Đang Quản Lý
                </label>
                <input
                    type="text"
                    value={inputUserId}
                    onChange={handleUserIdChange}
                    placeholder="Nhập User ID (MongoDB ObjectId 24 ký tự)"
                    className={`w-full p-3 border rounded-lg font-mono text-sm shadow-inner transition ${
                        isUserIdValid ? 'border-gray-300 focus:border-indigo-500' : 'border-red-500 focus:border-red-500'
                    }`}
                />
                {!isUserIdValid && inputUserId.length > 0 && (
                     <p className="text-sm text-red-500 mt-2">⚠️ User ID phải là 24 ký tự hex hợp lệ (MongoDB ObjectId).</p>
                )}
                {shiftTypes.length === 0 && (
                     <p className="text-sm text-yellow-600 mt-2">⚠️ Cần tạo Shift Types trước khi gán ca làm.</p>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6" role="alert">
                    <p className="font-bold">Lỗi Dữ Liệu</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="bg-white shadow-xl rounded-xl overflow-hidden mt-8">
                <div className="bg-gray-100 p-4 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">
                        Danh Sách Ràng Buộc Ca Làm (Policy Type: SHIFT_TYPE)
                    </h3>
                    <p className="text-sm text-gray-500">Hiển thị các ca làm được gán cho User ID: <code className="font-mono text-sm">{userId}</code></p>
                </div>
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Đang tải dữ liệu ràng buộc...</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/4">Mã Ca (Policy Code)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/4">Tên Ca</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/4">Hiệu Lực Từ (From)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/4">Hiệu Lực Đến (To)</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-1/12">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {bindings.length > 0 ? (
                                bindings.map((binding) => {
                                    const shiftType = shiftTypes.find(st => st.code === binding.policyCode);
                                    const effectTo = binding.effectiveTo === TO_MAX || binding.effectiveTo === null
                                        ? 'Vô thời hạn' 
                                        : binding.effectiveTo;
                                        
                                    return (
                                        <tr 
                                            key={binding._id} 
                                            className={`hover:bg-gray-50 transition ${binding.isConflicting ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' : ''}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700">
                                                {binding.isConflicting && <AlertTriangle className="w-4 h-4 inline-block mr-2 text-red-500" title={`Xung đột với: ${binding.conflictsWith?.join(', ')}`} />}
                                                {binding.policyCode}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {shiftType ? shiftType.name : <span className="text-red-500 italic">Code không tồn tại</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                <Calendar className="w-4 h-4 inline-block mr-2 text-green-500" />
                                                {binding.effectiveFrom || FROM_MIN}
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
                                        Không có ràng buộc ca làm nào cho User ID này.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Form */}
            {isModalOpen && (
                <PolicyForm
                    userId={userId}
                    shiftTypes={shiftTypes}
                    bindings={bindings} // Truyền danh sách bindings để check overlap
                    initialData={editingBinding}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default UserShiftPolicyPage;
