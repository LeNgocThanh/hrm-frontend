'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Clock, User, Calendar, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react'

// ====== API & Types (giữ nguyên tên biến như file gốc để bạn drop-in) ======
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const USER_POLICY_BASE_URL = `${API_BASE}/user-policy-bindings`
const SHIFT_TYPE_BASE_URL = `${API_BASE}/shift-types`
const UserPolicyType = { SHIFT_TYPE: 'SHIFT_TYPE' } as const

interface UserWithOrganization { _id: string; fullName: string; organizationId?: string; organizationPath?: string }
interface OrganizationType { _id: string; name: string }
interface ShiftType { _id: string; code: string; name: string }
interface UserPolicyBinding { _id: string; userId: string; policyType: string; policyCode: string; effectiveFrom?: string; effectiveTo?: string }
interface CreatePolicyBindingDto { userId: string; policyType: string; policyCode: string; effectiveFrom: string; effectiveTo: string }

async function api(path: string, opts: any = {}) {
  const { method = 'GET', query, body, headers } = opts
  const url = new URL(path.replace(/^\//, ''), API_BASE + '/')
  if (query) {
    Object.entries(query).forEach(([k, v]) => { if (v != null && v !== '') url.searchParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)) })
  }
  const res = await fetch(url.toString(), { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined, credentials: 'include' })
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  if (!res.ok) {
    let msg = res.statusText
    try { const txt = await res.text(); if (isJson && txt) msg = JSON.parse(txt).message || msg; else if (txt) msg = txt } catch {}
    throw new Error(msg || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  const txt = await res.text()
  if (!txt?.trim()) return null
  return isJson ? JSON.parse(txt) : { data: txt }
}

function useSWR<T>(key: any, fetcher: (k: any) => Promise<any>) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(!!key)
  const [error, setError] = useState<any>(null)
  const fetchKey = typeof key === 'string' ? key : JSON.stringify(key)
  useEffect(() => {
    if (!fetchKey || fetchKey === 'null' || (typeof key === 'string' && key.trim() === '')) { setIsLoading(false); setError(null); setData(null); return }
    let cancelled = false
    setIsLoading(true); setError(null)
    fetcher(key).then((res) => { if (!cancelled) setData(res as T) }).catch((e) => { if (!cancelled) setError(e) }).finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [fetchKey])
  return { data, isLoading, error, mutate: () => {} }
}

const userPolicyApi = {
  findAll: async (userId: string): Promise<UserPolicyBinding[]> => api(`/user-policy-bindings?userId=${userId}&policyType=${UserPolicyType.SHIFT_TYPE}`),
  create: async (dto: CreatePolicyBindingDto): Promise<UserPolicyBinding> => {
    const res = await fetch(USER_POLICY_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Lỗi không xác định' }))).message)
    return res.json()
  },
  update: async (id: string, dto: CreatePolicyBindingDto): Promise<UserPolicyBinding> => {
    const res = await fetch(`${USER_POLICY_BASE_URL}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Lỗi không xác định' }))).message)
    return res.json()
  },
  delete: async (id: string) => { const res = await fetch(`${USER_POLICY_BASE_URL}/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Lỗi không xác định' }))).message) },
}

const shiftTypeApi = {
  findAllCodes: async (): Promise<ShiftType[]> => { const r = await api(`${SHIFT_TYPE_BASE_URL}?limit=1000`); return r.items || r || [] },
}

// ====== PolicyForm (đơn lẻ) giữ nguyên trải nghiệm ======
function normalizeDateRange(effectiveFrom: string, effectiveTo: string) {
  const from = (effectiveFrom?.trim() || '2000-12-31')
  const to = (effectiveTo?.trim() || '9999-12-31')
  if (new Date(from) > new Date(to)) throw new Error('Ngày hiệu lực BẮT ĐẦU không được sau ngày KẾT THÚC.')
  return { from, to }
}

const PolicyForm: React.FC<{ userId: string; shiftTypes: ShiftType[]; initial?: UserPolicyBinding | null; onClose: () => void; onSave: (dto: CreatePolicyBindingDto, id?: string) => Promise<void> }> = ({ userId, shiftTypes, initial, onClose, onSave }) => {
  const [policyCode, setPolicyCode] = useState(initial?.policyCode || shiftTypes[0]?.code || '')
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom && initial.effectiveFrom !== '2000-12-31' ? initial.effectiveFrom : '')
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo && initial.effectiveTo !== '9999-12-31' ? initial.effectiveTo : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const title = initial ? 'Chỉnh sửa ràng buộc' : 'Gán ca cho người dùng'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setSaving(true)
    try {
      const { from, to } = normalizeDateRange(effectiveFrom, effectiveTo)
      const dto: CreatePolicyBindingDto = { userId, policyType: UserPolicyType.SHIFT_TYPE, policyCode, effectiveFrom: from, effectiveTo: to }
      await onSave(dto, initial?._id)
      onClose()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="p-5 border-b flex justify-between items-center bg-indigo-600 text-white">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose}><X /></button>
        </header>
        <form onSubmit={submit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 bg-indigo-50 p-3 rounded-lg border border-indigo-200">Gán cho User: <code className="font-mono text-xs font-semibold text-indigo-800">{userId}</code></p>
          <div>
            <label className="block text-sm font-medium mb-1">Ca làm (Policy Code)</label>
            <select value={policyCode} onChange={(e) => setPolicyCode(e.target.value)} className="w-full p-3 border rounded-lg">
              {shiftTypes.map(st => <option key={st.code} value={st.code}>{st.name} ({st.code})</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-sm font-medium mb-1">Hiệu lực từ</label><input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="w-full p-3 border rounded-lg" /></div>
            <div className="flex-1"><label className="block text-sm font-medium mb-1">Hiệu lực đến</label><input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Để trống = vô thời hạn"/></div>
          </div>
          {err && <div className="p-3 bg-red-100 text-red-700 rounded-lg flex items-center"><AlertTriangle className="mr-2"/> {err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Hủy</button>
            <button type="submit" disabled={saving} className={`px-4 py-2 text-white rounded-lg ${saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{saving ? 'Đang lưu…' : (initial ? 'Cập nhật' : 'Gán')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ====== NEW: BulkAssignForm – gán cho toàn bộ người trong Tổ chức ======
const BulkAssignForm: React.FC<{ targetCount: number; shiftTypes: ShiftType[]; onClose: () => void; onConfirm: (base: Omit<CreatePolicyBindingDto, 'userId'>, options: { ignoreErrors: boolean }) => Promise<{ ok: number; failed: number }> }> = ({ targetCount, shiftTypes, onClose, onConfirm }) => {
  const [policyCode, setPolicyCode] = useState(shiftTypes[0]?.code || '')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [ignoreErrors, setIgnoreErrors] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setRunning(true); setResult(null)
    try {
      const { from, to } = normalizeDateRange(effectiveFrom, effectiveTo)
      const summary = await onConfirm({ policyType: UserPolicyType.SHIFT_TYPE, policyCode, effectiveFrom: from, effectiveTo: to }, { ignoreErrors })
      setResult(summary)
    } catch (e: any) { setErr(e.message) } finally { setRunning(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="p-5 border-b bg-indigo-600 text-white flex items-center justify-between">
          <h2 className="text-xl font-bold">Gán ca cho TỔ CHỨC</h2>
          <button onClick={onClose}><X/></button>
        </header>
        <form onSubmit={submit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Sẽ áp dụng cho <b>{targetCount}</b> người dùng trong tổ chức đang chọn.</p>
          <div>
            <label className="block text-sm font-medium mb-1">Ca làm (Policy Code)</label>
            <select value={policyCode} onChange={(e) => setPolicyCode(e.target.value)} className="w-full p-3 border rounded-lg">
              {shiftTypes.map(st => <option key={st.code} value={st.code}>{st.name} ({st.code})</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-sm font-medium mb-1">Hiệu lực từ</label><input type="date" value={effectiveFrom} onChange={(e)=>setEffectiveFrom(e.target.value)} className="w-full p-3 border rounded-lg"/></div>
            <div className="flex-1"><label className="block text-sm font-medium mb-1">Hiệu lực đến</label><input type="date" value={effectiveTo} onChange={(e)=>setEffectiveTo(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Để trống = vô thời hạn"/></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ignoreErrors} onChange={(e)=>setIgnoreErrors(e.target.checked)} /> Bỏ qua lỗi từng người và tiếp tục chạy</label>
          {err && <div className="p-3 bg-red-100 text-red-700 rounded-lg flex items-center"><AlertTriangle className="mr-2"/> {err}</div>}
          {result && (
            <div className="p-3 bg-green-50 text-green-800 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle2/> Hoàn tất: thành công <b>{result.ok}</b> · thất bại <b>{result.failed}</b>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Đóng</button>
            <button type="submit" disabled={running || targetCount===0} className={`px-4 py-2 text-white rounded-lg ${running || targetCount===0 ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{running ? 'Đang gán…' : 'Thực hiện'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ====== Trang chính ======
const UserShiftPolicyPage: React.FC = () => {
  // dữ liệu tổ chức & người dùng (thay bằng API thực tế của bạn)
  const { data: users, isLoading: isLoadingUsers } = useSWR<UserWithOrganization[]>("/users/withOrganizationName", api)
  const { data: orgsData, isLoading: isLoadingOrgs } = useSWR<OrganizationType[]>("/organizations/under", api)

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('')
  const [nameFilter, setNameFilter] = useState('')
  const allUsers = users ?? []
  const organizations = orgsData ?? []
  const getAllSegmentsFromString = (fullString?: string) => {
  return fullString?.split('/').filter(Boolean) ?? [];
};

  const filteredUsers = useMemo(() => {
    let data = allUsers
    if (selectedOrganizationId) data = data.filter(u => {const segments = getAllSegmentsFromString(u.organizationPath);
    segments.push(u.organizationId);
    return segments.includes(selectedOrganizationId);})
    if (nameFilter) data = data.filter(u => u.fullName.toLowerCase().includes(nameFilter.toLowerCase()))
    return data
  }, [allUsers, selectedOrganizationId, nameFilter])

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
 // useEffect(() => { if (users && users.length > 0 && !selectedUserId) setSelectedUserId(users[0]._id) }, [users])

  const [bindings, setBindings] = useState<UserPolicyBinding[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [isLoadingBindings, setIsLoadingBindings] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalSingleOpen, setModalSingleOpen] = useState(false)
  const [editingBinding, setEditingBinding] = useState<UserPolicyBinding | null>(null)

  // NEW: modal Bulk
  const [modalBulkOpen, setModalBulkOpen] = useState(false)

  const fetchShiftTypes = useCallback(async () => { try { const types = await shiftTypeApi.findAllCodes(); setShiftTypes(types) } catch (e) { console.error(e) } }, [])
  useEffect(() => { fetchShiftTypes() }, [fetchShiftTypes])

  const fetchBindings = useCallback(async (uid: string | null) => {
    if (!uid) { setBindings([]); setError('Vui lòng chọn người dùng.'); return }
    setIsLoadingBindings(true); setError(null)
    try { const data = await userPolicyApi.findAll(uid); setBindings((data||[]).sort((a,b)=> (a.effectiveFrom||'0001').localeCompare(b.effectiveFrom||'0001'))) }
    catch (e: any) { setError(`Không thể tải ràng buộc: ${e.message}`) }
    finally { setIsLoadingBindings(false) }
  }, [])

  useEffect(() => { if (selectedUserId) fetchBindings(selectedUserId) }, [selectedUserId])

  const handleSaveSingle = async (data: CreatePolicyBindingDto, id?: string) => {
    if (!selectedUserId) throw new Error('Không có người dùng nào được chọn.')
    const finalData = { ...data, userId: selectedUserId }
    if (id) await userPolicyApi.update(id, finalData); else await userPolicyApi.create(finalData)
    await fetchBindings(selectedUserId)
  }

  // ====== NEW: Bulk assign handler ======
  const handleBulkAssign = async (base: Omit<CreatePolicyBindingDto, 'userId'>, { ignoreErrors }: { ignoreErrors: boolean }) => {
    // mục tiêu: tất cả người trong tổ chức đang chọn; nếu không chọn tổ chức => tất cả người trong hệ thống
    const targets = selectedOrganizationId ? allUsers.filter(u => u.organizationId === selectedOrganizationId) : allUsers
    if (targets.length === 0) throw new Error('Không có người dùng trong tổ chức được chọn.')

    let ok = 0, failed = 0
    for (const u of targets) {
      const dto: CreatePolicyBindingDto = { ...base, userId: u._id }
      try { await userPolicyApi.create(dto); ok++ }
      catch (e) { failed++; if (!ignoreErrors) break }
    }

    // refresh bảng nếu user đang xem nằm trong nhóm được gán
    if (selectedUserId && targets.some(t => t._id === selectedUserId)) await fetchBindings(selectedUserId)
    return { ok, failed }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4 sm:mb-0"><Clock className="w-7 h-7 inline-block mr-2 text-indigo-600"/> Quản Lý Ca Làm Người Dùng</h1>
        <div className="flex gap-2">
          <button onClick={()=> setModalBulkOpen(true)} disabled={shiftTypes.length===0 || (selectedOrganizationId ? filteredUsers.length===0 : allUsers.length===0)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 disabled:bg-emerald-400">Gán cho Tổ chức</button>
          <button onClick={()=> { setEditingBinding(null); if (!selectedUserId) { setError('Vui lòng chọn người dùng trước khi gán.'); return } setModalSingleOpen(true) }} disabled={!selectedUserId || shiftTypes.length===0} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:bg-indigo-400"><Plus className="w-5 h-5 inline mr-1"/> Gán Ca Mới</button>
        </div>
      </header>

      {/* Bộ lọc tổ chức & tìm người dùng */}
      <div className="mb-6 p-4 bg-white rounded-xl shadow border">
        <div className="grid sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-sm font-medium">Chọn Tổ chức</label>
            <select value={selectedOrganizationId} onChange={(e)=> setSelectedOrganizationId(e.target.value)} className="block w-full p-2 border rounded-lg">
              <option value="">Tất cả Tổ chức</option>
              {organizations.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Tìm tên nhân viên</label>
            <input value={nameFilter} onChange={(e)=> setNameFilter(e.target.value)} placeholder="Nhập tên..." className="block w-full p-2 border rounded-lg"/>
          </div>
          <div>
            <label className="text-sm font-medium">Chọn Người dùng</label>
            <div className="relative">
              <select value={selectedUserId || ''} onChange={(e)=> setSelectedUserId(e.target.value || null)} className="w-full p-2 border rounded-lg pr-8">
                {!selectedUserId && <option value="">-- Chọn Người Dùng --</option>}
                {filteredUsers.map(u => <option key={u._id} value={u._id}>{u.fullName} ({u._id})</option>)}
              </select>             
            </div>
          </div>
        </div>
      </div>

      {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg flex items-center"><AlertTriangle className="mr-2"/> {error}</div>}

      {/* Bảng ràng buộc */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
        <div className="bg-gray-100 p-4 border-b"><h3 className="text-lg font-semibold">Danh sách ràng buộc của: <span className="font-bold text-indigo-700">{selectedUserId || 'Chưa chọn'}</span></h3></div>
        {isLoadingBindings ? (
          <div className="p-8 text-center text-gray-500">Đang tải dữ liệu…</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã ca</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên ca</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hiệu lực từ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hiệu lực đến</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bindings.length ? bindings.map(b => {
                const st = shiftTypes.find(s => s.code === b.policyCode)
                const to = b.effectiveTo === '9999-12-31' || b.effectiveTo == null ? 'Vô thời hạn' : b.effectiveTo
                return (
                  <tr key={b._id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-semibold text-indigo-700">{b.policyCode}</td>
                    <td className="px-6 py-3">{st ? st.name : <span className="text-red-500 italic">Code không tồn tại</span>}</td>
                    <td className="px-6 py-3"><Calendar className="w-4 h-4 inline mr-1 text-green-600"/>{b.effectiveFrom || '0001-01-01'}</td>
                    <td className="px-6 py-3"><Calendar className="w-4 h-4 inline mr-1 text-red-600"/>{to}</td>
                    <td className="px-6 py-3 text-center">
                      <button onClick={()=> { setEditingBinding(b); setModalSingleOpen(true) }} className="px-3 py-1 text-indigo-700 hover:bg-indigo-50 rounded-lg">Sửa</button>
                      <button onClick={async ()=> { if (!confirm('Xóa ràng buộc này?')) return; await userPolicyApi.delete(b._id); if (selectedUserId) fetchBindings(selectedUserId) }} className="ml-1 px-3 py-1 text-red-700 hover:bg-red-50 rounded-lg">Xóa</button>
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">{selectedUserId ? 'Không có ràng buộc.' : 'Vui lòng chọn người dùng.'}</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalSingleOpen && selectedUserId && (
        <PolicyForm userId={selectedUserId} shiftTypes={shiftTypes} initial={editingBinding} onClose={()=> setModalSingleOpen(false)} onSave={handleSaveSingle} />
      )}

      {modalBulkOpen && (
        <BulkAssignForm targetCount={selectedOrganizationId ? filteredUsers.length : allUsers.length} shiftTypes={shiftTypes} onClose={()=> setModalBulkOpen(false)} onConfirm={handleBulkAssign} />
      )}
    </div>
  )
}

export default UserShiftPolicyPage
