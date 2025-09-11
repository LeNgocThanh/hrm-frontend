'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  adminListNotices,
  adminDeleteNotice,
  patchNoticeAdmin,
  adminGetNotice,
  type Notice,
  type NoticeStatus,
  type NoticeVisibility,
} from '@/lib/api/notices';
import { useMutation, useQuery, useQueryClient, keepPreviousData  } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal';
import NoticeForm from '@/components/notice/NoticeAdminForm'; // form hiện có của anh/chị
import { VI_STATUS, VI_VISIBILITY, STATUS_OPTIONS_VI, VIS_OPTIONS_VI, VI_MISC } from '@/i18n/notice.vi';

const allStatuses: NoticeStatus[] = ['draft', 'published', 'archived'];
const allVis: NoticeVisibility[] = ['public', 'internal'];

export default function AdminNoticesPage() {
  // --------- filters ----------
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<NoticeStatus[]>([]);
  const [visibility, setVisibility] = useState<NoticeVisibility[]>([]);
  const [timeField, setTimeField] = useState<'createdAt' | 'publishAt' | 'updatedAt'>('createdAt');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 12;

  const params = useMemo(
    () => ({
      q: q || undefined,
      category: category || undefined,
      status: status.length ? status : undefined,
      visibility: visibility.length ? visibility : undefined,
      timeField,
      from: from || undefined,
      to: to || undefined,
      tags: tags || undefined,
      page,
      limit,
    }),
    [q, category, status, visibility, timeField, from, to, tags, page]
  );

  const qc = useQueryClient();

  // --------- query list ----------
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['admin-notices', params],
    queryFn: () => adminListNotices(params),
    placeholderData: keepPreviousData,
  });

  // --------- delete & inline patch ----------
  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => adminDeleteNotice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notices'] }),
  });
  const { mutateAsync: patch } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Notice> }) =>
      patchNoticeAdmin(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notices'] }),
  });

  // --------- modal edit ----------
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // nạp dữ liệu cho form khi mở modal (nếu form cần initialData)
  const { data: editing, isFetching: loadingEditing } = useQuery({
    queryKey: ['admin-notice', editId],
    queryFn: () => (editId ? adminGetNotice(editId) : Promise.resolve(null)),
    enabled: !!editId && openEdit,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quản trị Thông báo</h1>

        {/* Tạo mới vẫn mở trang riêng (hoặc bạn có thể cũng mở modal new tương tự) */}
        <Link
          href="/notices/new"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          + Tạo mới
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tiêu đề/nội dung"
          className="rounded-md border px-3 py-2"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Danh mục (vd: quy định, thông báo)"
          className="rounded-md border px-3 py-2"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (vd: khẩn, nội bộ) - cách nhau bằng dấu ,"
          className="rounded-md border px-3 py-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">{VI_MISC.status}:</span>
          {STATUS_OPTIONS_VI.map(o => (
  <label key={o.value} className="flex items-center gap-1 text-sm">
    <input
      type="checkbox"
      checked={status.includes(o.value)}
      onChange={(e) =>
        setStatus(prev => e.target.checked ? [...prev, o.value] : prev.filter(x => x !== o.value))
      }
    />
    {o.label}
  </label>
))}

        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">{VI_MISC.visibility}:</span>
         {VIS_OPTIONS_VI.map(o => (
  <label key={o.value} className="flex items-center gap-1 text-sm">
    <input
      type="checkbox"
      checked={visibility.includes(o.value)}
      onChange={(e) =>
        setVisibility(prev => e.target.checked ? [...prev, o.value] : prev.filter(x => x !== o.value))
      }
    />
    {o.label}
  </label>
))}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border px-2 py-2"
            value={timeField}
            onChange={(e) =>
              setTimeField(e.target.value as 'createdAt' | 'publishAt' | 'updatedAt')
            }
          >
            <option value="createdAt">{VI_MISC.createdAt}</option>
            <option value="publishAt">{VI_MISC.publishAt}</option>
            <option value="updatedAt">{VI_MISC.updatedAt}</option>
          </select>
          <input
            type="date"
            className="rounded-md border px-2 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-sm text-gray-500">→</span>
          <input
            type="date"
            className="rounded-md border px-2 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            onClick={() => { setPage(1); refetch(); }}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Lọc
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Tiêu đề</th>
              <th className="px-3 py-2">Danh mục</th>
              <th className="px-3 py-2">{VI_MISC.status}</th>
              <th className="px-3 py-2">{VI_MISC.visibility}</th>
    <th className="px-3 py-2">{VI_MISC.publishAt}</th>
    <th className="px-3 py-2">{VI_MISC.expireAt}</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n._id} className="border-t">
                <td className="px-3 py-2">
                  <div className="max-w-[420px] truncate font-medium">{n.title}</div>
                  {n.summary && (
                    <div className="max-w-[420px] truncate text-xs text-gray-500">
                      {n.summary}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">{n.category || '-'}</td>
                <td className="px-3 py-2">
                  <select
                    className="rounded-md border px-2 py-1"
                    value={n.status}
                    onChange={async (e) => {
                      try { await patch({ id: n._id, payload: { status: e.target.value } as any }); }
                      catch { alert('Cập nhật status không thành công'); }
                    }}
                  >
                    {STATUS_OPTIONS_VI.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded-md border px-2 py-1"
                    value={n.visibility}
                    onChange={async (e) => {
                      try { await patch({ id: n._id, payload: { visibility: e.target.value } as any }); }
                      catch { alert('Cập nhật visibility không thành công'); }
                    }}
                  >
                    {VIS_OPTIONS_VI.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">{n.publishAt ? new Date(n.publishAt).toLocaleString() : '-'}</td>
                <td className="px-3 py-2">{n.expireAt ? new Date(n.expireAt).toLocaleString() : '-'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setEditId(n._id); setOpenEdit(true); }}
                      className="rounded-md border px-3 py-1 hover:bg-gray-50"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Xoá thông báo này?')) return;
                        try { await remove(n._id); } catch { alert('Xoá không thành công'); }
                      }}
                      className="rounded-md border px-3 py-1 text-red-600 hover:bg-red-50"
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!items.length && !isFetching && (
              <tr>
                <td className="px-3 py-8 text-center text-gray-500" colSpan={7}>
                  Không có bản ghi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
        <button
          className="rounded-md border px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Trang trước
        </button>
        <div>Trang {page} / {totalPages} {isFetching ? '…' : ''}</div>
        <button
          className="rounded-md border px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Trang sau
        </button>
      </div>

      {/* EDIT MODAL */}
      <Modal
        open={openEdit}
        onClose={() => { setOpenEdit(false); setEditId(null); }}
        title="Sửa thông báo"
        widthClass="max-w-5xl"
      >
        {loadingEditing ? (
          <div className="py-10 text-center text-gray-500">Đang tải…</div>
        ) : editId ? (
          <NoticeForm
            noticeId={editId}
            initialData={editing as any}     // nếu form hỗ trợ
            onSuccess={() => {
              setOpenEdit(false);
              setEditId(null);
              qc.invalidateQueries({ queryKey: ['admin-notices'] });
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
