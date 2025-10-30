'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Clock, AlertTriangle, Save, Calendar, Globe, Layers, Copy, ChevronDown, ChevronUp, ClipboardPaste, Sparkles, ArrowRight, CheckSquare, Scissors } from 'lucide-react';

// --- Hằng số và Cấu hình ---
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DAYS_OF_WEEK = [
  { key: '1', name: 'Thứ 2' },
  { key: '2', name: 'Thứ 3' },
  { key: '3', name: 'Thứ 4' },
  { key: '4', name: 'Thứ 5' },
  { key: '5', name: 'Thứ 6' },
  { key: '6', name: 'Thứ 7' },
  { key: '0', name: 'Chủ Nhật' },
];
const SESSION_CODES = ['AM', 'PM', 'OV']; // Ví dụ về các code phiên

// --- Types (khớp với shift-type.schema.ts) ---
interface ShiftSession {
  _id?: string;
  code: string;
  start: string; // HH:mm
  end: string; // HH:mm
  required: boolean;
  graceInMins?: number;
  graceOutMins?: number;
  breakMinutes?: number;
  maxCheckInEarlyMins?: number;
  maxCheckOutLateMins?: number;
}

interface WeeklyRules {
  [key: string]: ShiftSession[]; // key là '0' đến '6'
}

interface ShiftType {
  _id?: string;
  code: string;
  name: string;
  timezone?: string; // e.g., 'Asia/Bangkok'
  weeklyRules: WeeklyRules;
  isActive?: boolean; // Tạm thêm để hiển thị
  isCheckTwoTimes?: boolean;
  [key: string]: any;
}

// --- Utils (fetcher mini SWR) ---
async function api(path: string, opts: any = {}) {
  const { method = 'GET', query, body, headers } = opts;
  const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v != null && v !== '')
        url.searchParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const txt = await res.text();
      if (isJson && txt) msg = JSON.parse(txt).message || msg;
      else if (txt) msg = txt;
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  let txt = '';
  try {
    txt = await res.text();
  } catch {
    return null;
  }
  if (!txt || !txt.trim()) return null;
  if (isJson) {
    try {
      return JSON.parse(txt);
    } catch {
      return { data: txt };
    }
  }
  return { data: txt };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function useShiftTypes() {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShiftTypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api('/shift-types');
      const rawShifts: ShiftType[] = res.items || res || [];
      const normalizedShifts = rawShifts.map((shift) => ({
        ...shift,
        weeklyRules: normalizeWeeklyRules(shift.weeklyRules),
      }));
      setShiftTypes(normalizedShifts);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải dữ liệu Shift Types');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShiftTypes();
  }, [fetchShiftTypes]);

  const handleSave = useCallback(
    async (data: ShiftType) => {
      const method = data._id ? 'PATCH' : 'POST';
      const url = data._id ? `/shift-types/${data._id}` : '/shift-types';
      try {
        const result = await api(url, { method, body: data });
        fetchShiftTypes();
        return result;
      } catch (err: any) {
        throw new Error(err.message || `Lỗi khi ${data._id ? 'cập nhật' : 'tạo mới'} Shift Type`);
      }
    },
    [fetchShiftTypes]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api(`/shift-types/${id}`, { method: 'DELETE' });
        fetchShiftTypes();
      } catch (err: any) {
        throw new Error(err.message || 'Lỗi khi xóa Shift Type');
      }
    },
    [fetchShiftTypes]
  );

  return { shiftTypes, isLoading, error, handleSave, handleDelete };
}

// --- Component Form cho ShiftType ---
const ShiftTypeForm = ({ initialData, onClose, onSave }: { initialData?: ShiftType | null; onClose: () => void; onSave: (data: ShiftType) => Promise<any> }) => {
  // Chuẩn bị weeklyRules đủ 7 ngày
  const initialWeeklyRules: WeeklyRules = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.key] = initialData?.weeklyRules?.[day.key] || [];
    return acc;
  }, {} as WeeklyRules);

  const defaultShift: ShiftType = {
    code: '',
    name: '',
    isCheckTwoTimes: false,
    weeklyRules: initialWeeklyRules,
  };

  const [form, setForm] = useState<ShiftType>(initialData || defaultShift);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string>(DAYS_OF_WEEK[0].key);
  const [copiedDayBuffer, setCopiedDayBuffer] = useState<ShiftSession[] | null>(null);

  const isEdit = !!initialData?._id;

  useEffect(() => {
    if (initialData) setForm(initialData);
    else setForm(defaultShift);
  }, [initialData]);

  // Keyboard shortcuts for power users
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // Ctrl/Cmd + C : copy current day
        e.preventDefault();
        handleCopyDay(activeDay);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Ctrl/Cmd + V : paste to current day
        e.preventDefault();
        handlePasteToDay(activeDay);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        // Ctrl/Cmd + D : duplicate first session in day
        e.preventDefault();
        handleDuplicateFirstSession(activeDay);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeDay, form]);

  // Basic field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name } = target;
    let value: string | boolean;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') value = target.checked;
    else value = target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Add session quick templates
  const addSessionTemplate = (template: 'AM' | 'PM' | 'OV') => {
    const presets: Record<'AM' | 'PM' | 'OV', ShiftSession> = {
      AM: { code: 'AM', start: '09:00', end: '12:00', required: true, graceInMins: 0, graceOutMins: 0, breakMinutes: 0, maxCheckInEarlyMins: 0, maxCheckOutLateMins: 0 },
      PM: { code: 'PM', start: '13:00', end: '17:00', required: true, graceInMins: 0, graceOutMins: 0, breakMinutes: 0, maxCheckInEarlyMins: 0, maxCheckOutLateMins: 0 },
      OV: { code: 'OV', start: '20:00', end: '06:00', required: true, graceInMins: 0, graceOutMins: 0, breakMinutes: 0, maxCheckInEarlyMins: 0, maxCheckOutLateMins: 0 },
    };
    const newSession = presets[template];
    setForm((prev) => ({
      ...prev,
      weeklyRules: { ...prev.weeklyRules, [activeDay]: [...(prev.weeklyRules[activeDay] || []), newSession] },
    }));
  };

  const handleAddSession = () => addSessionTemplate('AM');

  // Session mutators
  const handleSessionChange = (dayKey: string, index: number, field: keyof ShiftSession, value: string | number | boolean) => {
    const sessions = form.weeklyRules[dayKey] || [];
    const updatedSessions = sessions.map((session, i) => {
      if (i === index) {
        return {
          ...session,
          [field]: field === 'required' ? value : typeof value === 'string' && ['graceInMins', 'graceOutMins', 'breakMinutes', 'maxCheckInEarlyMins', 'maxCheckOutLateMins'].includes(field as string) ? parseInt(value, 10) : value,
        } as ShiftSession;
      }
      return session;
    });
    setForm((prev) => ({ ...prev, weeklyRules: { ...prev.weeklyRules, [dayKey]: updatedSessions } }));
  };

  const handleRemoveSession = (dayKey: string, index: number) => {
    const sessions = form.weeklyRules[dayKey] || [];
    const updatedSessions = sessions.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, weeklyRules: { ...prev.weeklyRules, [dayKey]: updatedSessions } }));
  };

  const handleMoveSession = (dayKey: string, index: number, direction: 'up' | 'down') => {
    const sessions = [...(form.weeklyRules[dayKey] || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sessions.length) return;
    const tmp = sessions[index];
    sessions[index] = sessions[newIndex];
    sessions[newIndex] = tmp;
    setForm((prev) => ({ ...prev, weeklyRules: { ...prev.weeklyRules, [dayKey]: sessions } }));
  };

  const handleDuplicateSession = (dayKey: string, index: number) => {
    const sessions = [...(form.weeklyRules[dayKey] || [])];
    const dup = deepClone(sessions[index]);
    sessions.splice(index + 1, 0, dup);
    setForm((prev) => ({ ...prev, weeklyRules: { ...prev.weeklyRules, [dayKey]: sessions } }));
  };

  const handleDuplicateFirstSession = (dayKey: string) => {
    const sessions = form.weeklyRules[dayKey] || [];
    if (!sessions[0]) return;
    handleDuplicateSession(dayKey, 0);
  };

  // Copy/Paste day level
  const handleCopyDay = (dayKey: string) => {
    const buffer = deepClone(form.weeklyRules[dayKey] || []);
    setCopiedDayBuffer(buffer);
  };

  const handlePasteToDay = (dayKey: string) => {
    if (!copiedDayBuffer) return;
    setForm((prev) => ({ ...prev, weeklyRules: { ...prev.weeklyRules, [dayKey]: deepClone(copiedDayBuffer) } }));
  };

  const handleCopyToNextDay = () => {
    const nextIndex = (DAYS_OF_WEEK.findIndex((d) => d.key === activeDay) + 1) % DAYS_OF_WEEK.length;
    const toKey = DAYS_OF_WEEK[nextIndex].key;
    handleCopyDay(activeDay);
    handlePasteToDay(toKey);
    setActiveDay(toKey);
  };

  const applyToWeekdays = (sourceKey: string) => {
    const src = form.weeklyRules[sourceKey] || [];
    setForm((prev) => {
      const next: WeeklyRules = { ...prev.weeklyRules };
      for (const k of ['1', '2', '3', '4', '5']) next[k] = deepClone(src);
      return { ...prev, weeklyRules: next };
    });
  };

  const applyToAllDays = (sourceKey: string) => {
    const src = form.weeklyRules[sourceKey] || [];
    setForm((prev) => {
      const next: WeeklyRules = { ...prev.weeklyRules };
      for (const d of DAYS_OF_WEEK) next[d.key] = deepClone(src);
      return { ...prev, weeklyRules: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    if (!form.code || !form.name) {
      setFormError('Code và Tên không được để trống.');
      setSaving(false);
      return;
    }

    try {
      const cleanedRules: WeeklyRules = {};
      for (const [day, sessions] of Object.entries(form.weeklyRules)) {
        cleanedRules[day] = (sessions || []).map((session) => {
          const isOV = session.code === 'OV';
          const denormalizedEndValue = denormalizeEnd(session.end, isOV);
          return {
            ...session,
            end: denormalizedEndValue,
            graceInMins: parseInt(session.graceInMins as any, 10) || 0,
            graceOutMins: parseInt(session.graceOutMins as any, 10) || 0,
            breakMinutes: parseInt(session.breakMinutes as any, 10) || 0,
            maxCheckInEarlyMins: parseInt(session.maxCheckInEarlyMins as any, 10) || 0,
            maxCheckOutLateMins: parseInt(session.maxCheckOutLateMins as any, 10) || 0,
          } as ShiftSession;
        });
      }
      await onSave({ ...form, weeklyRules: cleanedRules });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Lưu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  // Derived
  const activeDayName = useMemo(() => DAYS_OF_WEEK.find((d) => d.key === activeDay)?.name || '', [activeDay]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Chỉnh Sửa Loại Ca Làm' : 'Tạo Loại Ca Làm Mới'}
            </h2>
            <p className="text-sm text-gray-500">Phím tắt: Ctrl/Cmd+C (copy ngày), Ctrl/Cmd+V (dán), Ctrl/Cmd+D (nhân bản phiên đầu)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* General info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border rounded-xl p-4 bg-gray-50">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã (Code) <span className="text-red-500">*</span></label>
              <input type="text" name="code" value={form.code} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100" disabled={isEdit} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex items-center">
              <label className="text-sm font-medium text-gray-700 mr-2">Chấm công 2 lần trong ngày:</label>
              <input type="checkbox" name="isCheckTwoTimes" checked={!!form.isCheckTwoTimes} onChange={handleChange} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            </div>
          </div>

          {/* Toolbar nhanh */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-7 flex flex-wrap gap-2 bg-white p-3 rounded-xl border">
              <span className="text-sm text-gray-600 mr-1">Tác vụ nhanh cho <b>{activeDayName}</b>:</span>
              <button type="button" onClick={() => handleCopyDay(activeDay)} className="btn-ghost"><Copy className="mr-1" size={16}/>Sao chép ngày</button>
              <button type="button" onClick={() => handlePasteToDay(activeDay)} disabled={!copiedDayBuffer} className="btn-ghost disabled:opacity-50"><ClipboardPaste className="mr-1" size={16}/>Dán vào ngày</button>
              <button type="button" onClick={handleCopyToNextDay} className="btn-ghost"><ArrowRight className="mr-1" size={16}/>Copy → ngày kế</button>
              <div className="border-l mx-1"/>
              <button type="button" onClick={() => applyToWeekdays(activeDay)} className="btn-ghost"><CheckSquare className="mr-1" size={16}/>Áp dụng T2–T6</button>
              <button type="button" onClick={() => applyToAllDays(activeDay)} className="btn-ghost"><Sparkles className="mr-1" size={16}/>Áp dụng tất cả ngày</button>
            </div>
            <div className="lg:col-span-5 flex flex-wrap gap-2 bg-white p-3 rounded-xl border justify-end">
              <span className="text-sm text-gray-600 mr-1">Thêm nhanh phiên:</span>
              <button type="button" onClick={() => addSessionTemplate('AM')} className="btn-chip">AM 09:00–12:00</button>
              <button type="button" onClick={() => addSessionTemplate('PM')} className="btn-chip">PM 13:00–17:00</button>
              <button type="button" onClick={() => addSessionTemplate('OV')} className="btn-chip">OV 20:00–06:00</button>
            </div>
          </div>

          {/* Tabs ngày trong tuần */}
          <div className="flex flex-wrap gap-1 border-b border-gray-200">
            {DAYS_OF_WEEK.map((day) => {
              const count = form.weeklyRules[day.key]?.length || 0;
              const isActive = activeDay === day.key;
              return (
                <button key={day.key} type="button" onClick={() => setActiveDay(day.key)} className={`px-3 py-2 text-sm font-medium rounded-t-lg transition ${isActive ? 'bg-white border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
                  {day.name}
                  <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${count ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Chi tiết ngày đang chọn */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-semibold text-gray-800">{activeDayName}</h4>
              <button type="button" onClick={handleAddSession} className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-md"><Plus size={16} className="mr-1"/>Thêm Phiên</button>
            </div>

            {(form.weeklyRules[activeDay] || []).length === 0 ? (
              <div className="p-6 text-center text-gray-500 bg-gray-50 border border-dashed rounded-xl">Chưa có phiên làm việc nào cho ngày này.</div>
            ) : (
              <div className="space-y-4">
                {(form.weeklyRules[activeDay] || []).map((session, index) => (
                  <SessionCard key={session._id || index} session={session} index={index} dayKey={activeDay} onRemove={handleRemoveSession} onChange={handleSessionChange} onMove={handleMoveSession} onDuplicate={handleDuplicateSession} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg flex items-center"><AlertTriangle size={20} className="mr-2"/> {formError}</div>
          )}
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-5 py-3 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200">Hủy</button>
            <button type="submit" disabled={saving} className={`flex items-center px-6 py-3 text-white font-semibold rounded-lg transition ${saving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 shadow-lg'}`}>{saving ? 'Đang Lưu…' : (<><Save size={20} className="mr-2"/> {isEdit ? 'Cập nhật' : 'Tạo mới'}</>)}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Session Card ---
const SessionCard = ({ session, index, dayKey, onRemove, onChange, onMove, onDuplicate }: { session: ShiftSession; index: number; dayKey: string; onRemove: (dayKey: string, index: number) => void; onChange: (dayKey: string, index: number, field: keyof ShiftSession, value: string | number | boolean) => void; onMove: (dayKey: string, index: number, direction: 'up' | 'down') => void; onDuplicate: (dayKey: string, index: number) => void; }) => {
  const NumberInput = ({ field, label, helpText, min = 0 }: { field: keyof ShiftSession; label: string; helpText: string; min?: number }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label} (phút)</label>
      <input type="number" min={min} value={(session[field] as number) ?? min} onChange={(e) => onChange(dayKey, index, field, e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" title={helpText} />
      <p className="text-[11px] text-gray-400 mt-1">{helpText}</p>
    </div>
  );

  return (
    <div className="p-4 border border-blue-200 rounded-xl bg-blue-50 shadow-sm relative">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-base font-bold text-blue-800">Phiên {index + 1}</h5>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMove(dayKey, index, 'up')} className="icon-btn" title="Di chuyển lên"><ChevronUp size={18}/></button>
          <button type="button" onClick={() => onMove(dayKey, index, 'down')} className="icon-btn" title="Di chuyển xuống"><ChevronDown size={18}/></button>
          <button type="button" onClick={() => onDuplicate(dayKey, index)} className="icon-btn" title="Nhân bản phiên"><Copy size={18}/></button>
          <button type="button" onClick={() => onRemove(dayKey, index)} className="icon-btn text-red-600 hover:text-red-700 hover:bg-red-100" title="Xóa phiên này"><Trash2 size={18}/></button>
        </div>
      </div>

      {/* Dòng 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 border-b pb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mã Phiên</label>
          <select value={session.code} onChange={(e) => onChange(dayKey, index, 'code', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
            {SESSION_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bắt đầu (HH:mm)</label>
          <input type="time" value={session.start} onChange={(e) => onChange(dayKey, index, 'start', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kết thúc (HH:mm)</label>
          <input type="time" value={session.end} onChange={(e) => onChange(dayKey, index, 'end', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
          <p className="text-[11px] text-gray-400 mt-1">Ca OV hiển thị 06:00 nhưng sẽ lưu thành 30:00 (gối ngày)</p>
        </div>
        <div className="flex items-center justify-center pt-6">
          <label className="text-sm font-medium text-gray-700 mr-2">Tính công:</label>
          <input type="checkbox" checked={!!session.required} onChange={(e) => onChange(dayKey, index, 'required', e.target.checked)} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
        </div>
      </div>

      {/* Dòng 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <NumberInput field="graceInMins" label="Grace IN" helpText="Cho phép vào trễ tối đa" />
        <NumberInput field="graceOutMins" label="Grace OUT" helpText="Cho phép ra sớm tối đa" />
        <NumberInput field="breakMinutes" label="Giờ nghỉ" helpText="Thời gian nghỉ giữa phiên" />
        <NumberInput field="maxCheckInEarlyMins" label="Max IN sớm" helpText="Vào sớm tối đa được chấp nhận" />
        <NumberInput field="maxCheckOutLateMins" label="Max OUT trễ" helpText="Ra trễ tối đa được chấp nhận" />
      </div>
    </div>
  );
};

// --- Trang chính ---
const ShiftTypePage = () => {
  const { shiftTypes, isLoading, error, handleSave, handleDelete } = useShiftTypes();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShiftType, setEditingShiftType] = useState<ShiftType | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<ShiftType | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const openCreateModal = () => {
    setEditingShiftType(null);
    setIsModalOpen(true);
  };
  const openEditModal = (shift: ShiftType) => {
    setEditingShiftType(shift);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmingDelete?._id) return;
    try {
      await handleDelete(confirmingDelete._id);
      setActionMessage({ type: 'success', message: `Đã xóa loại ca làm ${confirmingDelete.name} thành công.` });
      setConfirmingDelete(null);
    } catch (err: any) {
      setActionMessage({ type: 'error', message: err.message });
      setConfirmingDelete(null);
    }
  };

  const handleFormSave = async (data: ShiftType) => {
    try {
      await handleSave(data);
      setActionMessage({ type: 'success', message: `${data._id ? 'Cập nhật' : 'Tạo mới'} loại ca làm ${data.name} thành công.` });
    } catch (err: any) {
      setActionMessage({ type: 'error', message: err.message });
      throw err;
    }
  };

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 border-b pb-3 flex items-center gap-3">
          <Layers size={28} className="text-blue-600" /> Quản Lý Loại Ca Làm (Shift Types)
        </h1>

        {actionMessage && (
          <div className={`p-4 mb-4 rounded-lg shadow-md flex items-center ${actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <AlertTriangle size={20} className="mr-2" /> {actionMessage.message}
          </div>
        )}

        <div className="flex justify-end mb-4">
          <button onClick={openCreateModal} className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition">
            <Plus size={20} className="mr-2" /> Tạo Loại Ca Mới
          </button>
        </div>

        {isLoading && <div className="p-8 text-center text-gray-600 bg-white rounded-xl shadow">Đang tải dữ liệu...</div>}

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertTriangle size={20} className="mr-2" /> Lỗi tải dữ liệu: {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="bg-white shadow-xl rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-3/12">Tên Loại Ca</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4/12">Quy Tắc Ca (Ví dụ)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-2/12">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shiftTypes.length > 0 ? (
                    shiftTypes.map((shift) => (
                      <tr key={shift._id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shift.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{shift.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="space-y-2">
                            {DAYS_OF_WEEK.map((day) => {
                              const sessions = shift.weeklyRules[day.key];
                              if (!sessions || sessions.length === 0) return null;
                              return (
                                <div key={day.key} className="flex items-start text-xs">
                                  <span className="font-semibold w-16 flex-shrink-0 text-gray-800">{day.name}:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {sessions.map((session, index) => (
                                      <span key={index} className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${session.required ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {session.code} ({session.start} - {normalizeEnd(session.end, session.code === 'OV')})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-center">
                          <div className="flex justify-center space-x-2">
                            <button onClick={() => openEditModal(shift)} className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50 transition" title="Chỉnh sửa">
                              <Pencil size={20} />
                            </button>
                            <button onClick={() => setConfirmingDelete(shift)} className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition" title="Xóa">
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Không có Loại Ca Làm nào được tạo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && <ShiftTypeForm initialData={editingShiftType} onClose={() => setIsModalOpen(false)} onSave={handleFormSave} />}

      {/* Modal Xác nhận Xóa */}
      {confirmingDelete && (
        <ConfirmDeleteModal shift={confirmingDelete} onClose={() => setConfirmingDelete(null)} onConfirm={handleConfirmDelete} />
      )}
    </div>
  );
};

export default ShiftTypePage;

// --- Modal Xác nhận Xóa ---
const ConfirmDeleteModal = ({ shift, onClose, onConfirm }: { shift: ShiftType; onClose: () => void; onConfirm: () => void }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
      <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center">
        <AlertTriangle size={24} className="mr-2" /> Xác nhận Xóa
      </h2>
      <p className="text-gray-700 mb-6">
        Bạn có chắc chắn muốn xóa Loại Ca Làm <span className="font-semibold text-gray-900">"{shift.name}" ({shift.code})</span> không? Thao tác này không thể hoàn tác.
      </p>
      <div className="flex justify-end space-x-3">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition">Hủy</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-md">Xóa Vĩnh Viễn</button>
      </div>
    </div>
  </div>
);

// --- Helpers (same behavior như bản gốc) ---
function normalizeEnd(end: string, isOV: boolean): string {
  if (!isOV || typeof end !== 'string' || !end.includes(':')) return end;
  const [hoursStr, minutesStr] = end.split(':');
  const hours = parseInt(hoursStr, 10);
  if (hours >= 24) {
    const normalizedHours = hours - 24;
    return `${String(normalizedHours).padStart(2, '0')}:${minutesStr}`;
  }
  return end;
}

/** Chuyển end cho backend (>24:00) nếu là ca gối ngày OV */
function denormalizeEnd(end: string, isOV: boolean): string {
  if (!isOV || !end || !end.includes(':')) return end;
  const [endH, endM] = end.split(':').map(Number);
  const denormalizedHours = endH + 24;
  return `${String(denormalizedHours).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function normalizeWeeklyRules(rules: WeeklyRules): WeeklyRules {
  const normalized: WeeklyRules = {};
  for (const [dayKey, sessions] of Object.entries(rules)) {
    normalized[dayKey] = (sessions || []).map((session) => ({
      ...session,
      end: normalizeEnd(session.end, session.code === 'OV'),
    }));
  }
  return normalized;
}

function getDayNameByKey(key: string): string {
  const day = DAYS_OF_WEEK.find((d) => d.key === key);
  return day ? day.name : 'Không xác định';
}

// --- tiny utility classes ---
declare global {
  interface HTMLElementTagNameMap {
    'button': HTMLButtonElement;
  }
}

// Tailwind utilities for buttons
const btnBase = 'inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition';
const btnGhost = `${btnBase} bg-gray-100 hover:bg-gray-200 text-gray-800`;
const btnChip = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200';

// Extend to className string via global CSS - here we keep utility names and reuse them
// If using classnames lib, we could compose; but plain strings are fine.

// Attach to global (optional): in TSX we can't define CSS, so we rely on these helper class names in JSX via className props
// For readability we alias in JSX with className="btn-ghost" or "btn-chip" using tailwind @apply in a CSS file if available.
