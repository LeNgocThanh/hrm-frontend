'use client';

import React, { useEffect, useState } from 'react';
import { Position } from '@/types/position';
import { getPositions, createPosition, updatePosition, deletePosition } from '@/lib/api/positions';

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
  justifyContent: 'center',
  alignItems: 'center',
};

const PositionsManagement: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [form, setForm] = useState<Partial<Position>>({ name: '', description: '', level: 1, isActive: true, code :'' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    setPositions(await getPositions());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (editingId) {
      await updatePosition(editingId, form);
    } else {
      await createPosition(form);
    }
    setForm({ name: '', description: '', level: 1, isActive: true, code : '' });
    setEditingId(null);
    fetchPositions();
  };

  const handleEdit = (pos: Position) => {
    setForm({
      _id: pos._id,
      name: pos.name,
      description: pos.description,
      level: pos.level,
      isActive: pos.isActive,
      code: pos.code?? '',
    });
    setEditingId(pos._id);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa position này?')) {
      await deletePosition(id);
      fetchPositions();
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Quản lý Chức danh</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          style={inputStyle}
          placeholder="Tên chức danh"
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
        <input
          style={inputStyle}
          placeholder="Code"
          value={form.code || ''}
          onChange={e => setForm({ ...form, code: e.target.value })}
        />
        <input
          style={inputStyle}
          type="number"
          min={1}
          placeholder="Cấp bậc (level)"
          value={form.level ?? 1}
          onChange={e => setForm({ ...form, level: Number(e.target.value) })}
        />
        <label style={{ marginRight: 8 }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm({ ...form, isActive: e.target.checked })}
          /> Hoạt động
        </label>
        <button type="submit" style={buttonStyle}>{editingId ? 'Cập nhật' : 'Thêm mới'}</button>
        {editingId && <button type="button" style={buttonDangerStyle} onClick={() => { setForm({ name: '', description: '', level: 1, isActive: true }); setEditingId(null); }}>Hủy</button>}
      </form>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Tên chức danh</th>
            <th style={thStyle}>Mô tả</th>
            <th style={thStyle}>Code</th>
            <th style={thStyle}>Cấp bậc</th>
            <th style={thStyle}>Hoạt động</th>
            <th style={thStyle}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => (
            <tr key={pos._id}>
              <td style={tdStyle}>{pos.name}</td>
              <td style={tdStyle}>{pos.description}</td>
              <td style={tdStyle}>{pos.code?? ''}</td>
              <td style={tdStyle}>{pos.level}</td>
              <td style={tdStyle}>{pos.isActive ? '✔️' : '❌'}</td>
              <td style={tdStyle}>
                <button type="button" style={buttonStyle} onClick={() => handleEdit(pos)}>Sửa</button>
                <button type="button" style={buttonDangerStyle} onClick={() => handleDelete(pos._id)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PositionsManagement; 