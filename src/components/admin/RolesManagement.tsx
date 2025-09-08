'use client';

import React, { useEffect, useState } from 'react';
import { Role } from '@/types/role';
import { getRoles, createRole, updateRole, deleteRole } from '@/lib/api/roles';
import { getPermissions } from '@/lib/api/permissions';
import { Permission } from '@/types/permission';

const inputStyle: React.CSSProperties = {
  padding: '8px',
  marginRight: '8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  minWidth: 180,
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

const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [form, setForm] = useState<Partial<Role>>({ name: '', description: '', permissionIds: [], isActive: true });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    setRoles(await getRoles());
  };
  const fetchPermissions = async () => {
    setPermissions(await getPermissions());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (editingId) {
      await updateRole(editingId, form);
    } else {
      await createRole(form);
    }
    setForm({ name: '', description: '', permissionIds: [], isActive: true });
    setEditingId(null);
    fetchRoles();
  };

  const handleEdit = (role: Role) => {
    setForm({
      _id: role._id,
      name: role.name,
      description: role.description,
      permissionIds: role.permissionIds,
      isActive: role.isActive,
    });
    setEditingId(role._id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa role này?')) {
      await deleteRole(id);
      fetchRoles();
    }
  };

  // Thay select multiple bằng danh sách checkbox
  const handlePermissionCheckbox = (pid: string, checked: boolean) => {
    if (checked) {
      setForm({ ...form, permissionIds: [...(form.permissionIds || []), pid] });
    } else {
      setForm({ ...form, permissionIds: (form.permissionIds || []).filter(id => id !== pid) });
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Quản lý Roles</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <input
          style={inputStyle}
          placeholder="Tên role"
          value={form.name || ''}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          style={inputStyle}
          placeholder="Mô tả"
          value={form.description || ''}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 120, overflowY: 'auto', minWidth: 220, border: '1px solid #ccc', borderRadius: 4, padding: 8, background: '#fafbfc' }}>
          <span style={{ fontWeight: 500, marginBottom: 4 }}>Permissions:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {permissions.map(p => (
              <label key={p._id} style={{ display: 'flex', alignItems: 'center', minWidth: 110 }}>
                <input
                  type="checkbox"
                  checked={form.permissionIds?.includes(p._id) || false}
                  onChange={e => handlePermissionCheckbox(p._id, e.target.checked)}
                />
                <span style={{ marginLeft: 4 }}>{p.code}</span>
              </label>
            ))}
          </div>
        </div>
        <label style={{ marginRight: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm({ ...form, isActive: e.target.checked })}
          /> Hoạt động
        </label>
        <button type="submit" style={buttonStyle}>{editingId ? 'Cập nhật' : 'Thêm mới'}</button>
        {editingId && <button type="button" style={buttonDangerStyle} onClick={() => { setForm({ name: '', description: '', permissionIds: [], isActive: true }); setEditingId(null); }}>Hủy</button>}
      </form>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Tên role</th>
            <th style={thStyle}>Mô tả</th>
            <th style={thStyle}>Permissions</th>
            <th style={thStyle}>Hoạt động</th>
            <th style={thStyle}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(role => (
            <tr key={role._id}>
              <td style={tdStyle}>{role.name}</td>
              <td style={tdStyle}>{role.description}</td>
              <td style={tdStyle}>
                {role.permissionIds.map(pid => {
                  const perm = permissions.find(p => p._id === pid);
                  return perm ? <div key={pid}>{perm.code}</div> : <div key={pid}>{pid}</div>;
                })}
              </td>
              <td style={tdStyle}>{role.isActive ? '✔️' : '❌'}</td>
              <td style={tdStyle}>
                <button type="button" style={buttonStyle} onClick={() => handleEdit(role)}>Sửa</button>
                <button type="button" style={buttonDangerStyle} onClick={() => handleDelete(role._id)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RolesManagement; 