'use client';

import React, { useEffect, useState } from 'react';
import { UserAssignment } from '@/types/user-assignment';
import { getUserAssignmentsByUser, createUserAssignment, updateUserAssignment, deleteUserAssignment } from '@/lib/api/user-assignments';
import { getOrganizations, getOrganizationsUnder } from '@/lib/api/organizations';
import { getPositions } from '@/lib/api/positions';
import { getRoles } from '@/lib/api/roles';
import { Organization } from '@/types/organization';
import { Position } from '@/types/position';
import { Role } from '@/types/role';
import Select from 'react-select';

interface Props {
  userId: string;
  viewMode?: boolean;
}

const inputStyle: React.CSSProperties = {
  padding: '8px',
  marginRight: '8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  minWidth: 160,
};
const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  marginRight: '8px',
  border: 'none',
  borderRadius: '4px',
  background: '#1976d2',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 500,
};
const buttonDangerStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#d32f2f',
};
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
};
const thStyle: React.CSSProperties = {
  background: '#f5f5f5',
  fontWeight: 700,
  padding: '10px',
  border: '1px solid #ddd',
};
const tdStyle: React.CSSProperties = {
  padding: '10px',
  border: '1px solid #ddd',
};

const UserAssignments: React.FC<Props> = ({ userId, viewMode = false }) => {
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<Partial<UserAssignment>>({ organizationId: '', positionId: '', roleIds: [],userCode: '' ,isActive: true, isPrimary: false, timeIn: '', timeOut: '', workType: 'fullTime' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [userId]);

  const fetchAll = async () => {
    const assignmentsData = await getUserAssignmentsByUser(userId);   
    setAssignments(assignmentsData);
    setOrganizations(await getOrganizationsUnder());
    setPositions(await getPositions());
    setRoles(await getRoles());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.organizationId || !form.positionId || !form.roleIds?.length) return;

    // Ensure roleIds are strings
    const roleIds = Array.isArray(form.roleIds)
      ? form.roleIds.map(rid => typeof rid === 'string' ? rid : (rid as { _id: string })._id)
      : [];
    const userCode = form.userCode === ''? undefined : form.userCode;  

    const payload = { ...form, userId, roleIds, userCode };
    if (editingId) {
      await updateUserAssignment(editingId, payload);
    } else {
      await createUserAssignment(payload);
    }
    setForm({ organizationId: '', positionId: '', roleIds: [], userCode: '', isActive: true, isPrimary: true, timeIn: '', timeOut: '', workType: 'fullTime' });
    setEditingId(null);
    setAssignments(await getUserAssignmentsByUser(userId));
  };

  const handleEdit = (a: UserAssignment) => {
    // Convert roleIds to strings if they are objects
    const roleIds = Array.isArray(a.roleIds)
      ? a.roleIds.map(rid => typeof rid === 'string' ? rid : (rid as { _id: string })._id)
      : [];

    setForm({
      organizationId: typeof a.organizationId === 'object' && a.organizationId !== null
        ? (a.organizationId as { _id: string })._id
        : a.organizationId,
      positionId: typeof a.positionId === 'object' && a.positionId !== null
        ? (a.positionId as { _id: string })._id
        : a.positionId,
      roleIds: roleIds,
      userCode: a.userCode,
      isActive: a.isActive,
      isPrimary: a.isPrimary,
      timeIn: a.timeIn || '',
      timeOut: a.timeOut || '',
      workType: a.workType || 'fullTime',
    });
    setEditingId(a._id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa assignment này?')) {
      await deleteUserAssignment(id);
      setAssignments(await getUserAssignmentsByUser(userId));
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, option => option.value);
    setForm({ ...form, roleIds: selected });
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ marginBottom: 12 }}>Phân công nhiệm vụ</h3>

      {!viewMode && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            style={inputStyle}
            value={typeof form.organizationId === 'string' ? form.organizationId : form.organizationId?._id || ''}
            onChange={e => setForm({ ...form, organizationId: e.target.value })}
            required
          >
            <option value="">-- Tổ chức --</option>
            {organizations.map(o => (
              <option key={o._id} value={o._id}>{o.name}</option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={typeof form.positionId === 'string' ? form.positionId : form.positionId?._id || ''}
            onChange={e => setForm({ ...form, positionId: e.target.value })}
            required
          >
            <option value="">-- Vị trí --</option>
            {positions.map(p => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <Select
            isMulti
            options={roles.map(r => ({ value: r._id, label: r.name }))}
            value={roles.filter(r => (form.roleIds as string[]).includes(r._id)).map(r => ({ value: r._id, label: r.name }))}
            onChange={selected => setForm({ ...form, roleIds: selected.map((s: any) => s.value) })}
            placeholder="Chọn vai trò"
          />        
            
            <input
              style={inputStyle}
              type="text"
              value={form.userCode ? form.userCode : ''}
              onChange={e => setForm({ ...form, userCode: e.target.value })}             
              placeholder="Mã nhân viên"
            />
           
          <label style={{ marginRight: 8 }}>
            Vào
            <input
              style={inputStyle}
              type="date"
              value={form.timeIn ? form.timeIn.slice(0, 10) : ''}
              onChange={e => setForm({ ...form, timeIn: e.target.value })}
              required
              placeholder="Vào"
            />
          </label>
          <label style={{ marginRight: 8 }}>
            Ra
            <input
              style={inputStyle}
              type="date"
              value={form.timeOut ? form.timeOut.slice(0, 10) : ''}
              onChange={e => setForm({ ...form, timeOut: e.target.value })}
              placeholder="Ra"
            />
          </label>
          <select
            style={inputStyle}
            value={form.workType || 'fullTime'}
            onChange={e => setForm({ ...form, workType: e.target.value })}
            required
          >
            <option value="fullTime">Toàn thời gian</option>
            <option value="halftime">Bán thời gian</option>
            <option value="remote">Làm việc từ xa</option>
          </select>
          <label style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
            /> Hoạt động
          </label>
          <label style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={e => setForm({ ...form, isPrimary: e.target.checked })}
            /> Nhiệm vụ chính
          </label>

          <button type="submit" style={buttonStyle}>{editingId ? 'Cập nhật' : 'Thêm mới'}</button>
          {editingId && <button type="button" style={buttonDangerStyle} onClick={() => { setForm({ organizationId: '', positionId: '', roleIds: [], isActive: true, isPrimary: false, timeIn: '', timeOut: '', workType: 'fullTime' }); setEditingId(null); }}>Hủy</button>}
        </form>
      )}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Tổ chức</th>
            <th style={thStyle}>Vị trí</th>
            <th style={thStyle}>Vai trò</th>
            <th style={thStyle}>Mã nhân viên</th>
            <th style={thStyle}>Hoạt động</th>
            <th style={thStyle}>Nhiệm vụ chính</th>
            <th style={thStyle}>Vào</th>
            <th style={thStyle}>Ra</th>
            <th style={thStyle}>Hình thức làm việc</th>
            {!viewMode && <th style={thStyle}>Hành động</th>}
          </tr>
        </thead>
        <tbody>
          {assignments.map(a => (
            <tr key={a._id}>
              <td style={tdStyle}>
                {
                  typeof a.organizationId === 'object' && a.organizationId !== null && 'name' in a.organizationId
                    ? (a.organizationId as { name: string }).name
                    : organizations.find(o => o._id === a.organizationId)?.name || 'N/A'
                }
              </td>
              <td style={tdStyle}>
                {typeof a.positionId === 'object' && a.positionId !== null && 'name' in a.positionId
                  ? (a.positionId as { name: string }).name
                  : String(a.positionId)}
              </td>
              <td style={tdStyle}>
                {Array.isArray(a.roleIds) && a.roleIds.length > 0
                  ? a.roleIds.map((rid, index) => {
                    // Handle both string and object cases
                    let roleName = '';
                    if (typeof rid === 'string') {
                      roleName = roles.find(r => r._id === rid)?.name || rid;
                    } else if (rid && typeof rid === 'object' && 'name' in rid) {
                      roleName = (rid as { name: string; _id: string }).name || (rid as { _id: string })._id;
                    } else {
                      roleName = String(rid);
                    }
                    return roleName;
                  }).join(', ')
                  : 'Chưa có vai trò'
                }
              </td>
              <td style={tdStyle}>{a.userCode ? a.userCode : 'Nhân viên chưa có mã'}</td>
              <td style={tdStyle}>{a.isActive ? '✔️' : '❌'}</td>
              <td style={tdStyle}>{a.isPrimary ? '✔️' : '❌'}</td>
              <td style={tdStyle}>{a.timeIn ? new Date(a.timeIn).toLocaleDateString() : ''}</td>
              <td style={tdStyle}>{a.timeOut ? new Date(a.timeOut).toLocaleDateString() : ''}</td>
              <td style={tdStyle}>{a.workType ? a.workType : 'fullTime'}</td>
              {!viewMode && (
                <td style={tdStyle}>
                  <button style={buttonStyle} onClick={() => handleEdit(a)}>Sửa</button>
                  <button style={buttonDangerStyle} onClick={() => handleDelete(a._id)}>Xóa</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserAssignments; 
