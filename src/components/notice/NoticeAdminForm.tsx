'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createNotice, patchNoticeAdmin } from '@/lib/api/notices';
import type { CreateNoticeInput, Notice, NoticeStatus, NoticeVisibility } from '@/types/notice';
import { NoticeStatus as S, NoticeVisibility as V } from '@/types/notice';
import { filePublicUrl, getFileInfo } from '@/lib/api/files';
import type { UploadFileRef } from '@/types/upload';
import FileUploader from '../admin/FileUploader';
import { useRouter } from 'next/navigation';
import { VI_STATUS, VI_VISIBILITY, STATUS_OPTIONS_VI, VIS_OPTIONS_VI, VI_MISC } from '@/i18n/notice.vi';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';


function toIsoOrUndefined(v?: string) {
  if (!v) return undefined;
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? undefined : dt.toISOString();
}
function chipify(str?: string) {
  return (str || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export default function NoticeAdminForm({
  noticeId,
  initialData,
  onSuccess,          // callback khi lưu thành công (dùng cho Modal)
  onCancel,           // callback khi bấm Huỷ (dùng cho Modal)
}: {
  noticeId?: string;
  initialData?: Partial<Notice>;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();

  const [form, setForm] = useState<CreateNoticeInput>({
    title: '',
    summary: '',
    content: '',
    category: '',
    tags: [],
    status: S.Draft,
    visibility: V.Internal,
    pinned: false,
    allowedPermissions: [],
    attachments: [],
    coverImage: undefined,
  });
  const [tagsInput, setTagsInput] = useState('');
  const [allowedInput, setAllowedInput] = useState('');
  const [coverPreview, setCoverPreview] = useState<UploadFileRef | null>(null);
  const [attachPreview, setAttachPreview] = useState<UploadFileRef[]>([]);

  // nạp initialData khi sửa
  useEffect(() => {
    if (!initialData) return;
    const ci = (initialData as any).coverImage;

    setForm((prev) => ({
      ...prev,
      title: initialData.title ?? prev.title,
      summary: (initialData as any).summary ?? prev.summary,
      content: (initialData as any).content ?? prev.content,
      category: initialData.category ?? prev.category,
      status: (initialData.status as NoticeStatus) ?? prev.status,
      visibility: (initialData.visibility as NoticeVisibility) ?? prev.visibility,
      pinned: (initialData as any).pinned ?? prev.pinned,
      coverImage: (initialData as any).coverImage ?? prev.coverImage,
      attachments: ((initialData as any).attachments as string[] | undefined) ?? prev.attachments,
      publishAt: (initialData as any).publishAt ?? prev.publishAt,
      expireAt: (initialData as any).expireAt ?? prev.expireAt,
      allowedPermissions: ((initialData as any).allowedPermissions as string[] | undefined) ?? prev.allowedPermissions,
      tags: (initialData.tags as string[] | undefined) ?? prev.tags,
    }));
    setTagsInput((initialData.tags || []).join(', '));
    setAllowedInput(((initialData as any).allowedPermissions || []).join(', '));
    if (ci && typeof ci === 'object') {
      setCoverPreview(ci as any);
      return;
    }
    // coverPreview/attachPreview không có đủ metadata để hiển thị file name ⇒ giữ placeholder
    if (ci && typeof ci === 'string') {
      // Thử gọi getFileInfo(id) nếu /files/:id tồn tại trong BE của bạn
      getFileInfo(ci)
        .then((info) => setCoverPreview(info as any))
        .catch(() => {
          // Fallback: nếu trông giống path thì dựng preview từ path
          if (ci.includes('/') || ci.includes('\\') || ci.includes('.')) {
            setCoverPreview({ id: ci, path: ci } as any);
          }
        });
    }
  }, [initialData]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const payload: CreateNoticeInput = {
        ...form,
        tags: chipify(tagsInput),
        allowedPermissions: undefined,
        publishAt: toIsoOrUndefined(form.publishAt as any),
        expireAt: toIsoOrUndefined(form.expireAt as any),
      };
      // nếu có noticeId => PATCH; ngược lại => tạo mới
      if (noticeId) return patchNoticeAdmin(noticeId, payload as any);
      return createNotice(payload);
    },
    onSuccess: (n: any) => {
      if (onSuccess) {
        onSuccess();
      } else {
        // fallback hành vi cũ: điều hướng sang trang chi tiết
        const idOrSlug = n?.slug || n?._id || noticeId;
        if (idOrSlug) router.push(`/notices/${idOrSlug}`);
      }
    },
  });

  const set = (k: keyof CreateNoticeInput, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));


  const modules = {
    toolbar: [
      [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
      [{ size: [] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' },
      { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'video'],
      ['clean']
    ],
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'indent',
    'link', 'image', 'video'
  ];

  return (
    <form
      className="mx-auto max-w-3xl space-y-4 rounded-2xl border bg-white p-4 shadow"
      onSubmit={async (e) => {
        e.preventDefault();
        await mutateAsync();
      }}
    >
      <h1 className="text-xl font-semibold">
        {noticeId ? 'Cập nhật thông báo' : 'Tạo thông báo'}
      </h1>

      <div className="space-y-1">
        <label className="text-sm font-medium">Tiêu đề *</label>
        <input
          required
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Ví dụ: Quy chế làm việc mới"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Danh mục</label>
          <input
            value={form.category || ''}
            onChange={(e) => set('category', e.target.value)}
            placeholder="thông báo / quy định / quy chế / hướng dẫn"
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Ghim (Pinned)</label>
          <select
            value={form.pinned ? '1' : '0'}
            onChange={(e) => set('pinned', e.target.value === '1')}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value="0">Không</option>
            <option value="1">Có</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Tóm tắt</label>
        <textarea
          value={(form as any).summary || ''}
          onChange={(e) => set('summary', e.target.value)}
          placeholder="Mô tả ngắn gọn nội dung chính..."
          className="min-h-24 w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Nội dung</label>
        <ReactQuill
          theme="snow"
          value={(form as any).content || ''}
          onChange={(v) => set('content', v)}
          modules={modules}
          formats={formats}
          placeholder="nội dung"
          className="min-h-40"
        />
      </div>

      {/* COVER IMAGE UPLOAD */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Ảnh bìa (cover)</label>
        <div className="flex items-center gap-3">
          {/* BỎ getToken/getUserId */}
          <FileUploader
            multiple={false}
            label="Chọn ảnh bìa"
            onUploaded={(fs) => {
              const f = fs[0];
              if (!f) return;
              set('coverImage', f.id);
              setCoverPreview(f);
            }}
          />
          {coverPreview ? (
            <div className="relative h-20 w-32 overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePublicUrl(coverPreview as any) || ''}
                alt="cover"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-20 w-32 rounded-lg border bg-gray-50" />
          )}
        </div>
      </div>

      {/* ATTACHMENTS UPLOAD */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Đính kèm</label>
        {/* BỎ getToken/getUserId */}
        <FileUploader
          multiple
          label="Tải tệp đính kèm"
          onUploaded={(fs) => {
            setAttachPreview((prev) => [...prev, ...fs]);
            set('attachments', [
              ...new Set([...(form.attachments || []), ...fs.map((f) => f.id)]),
            ]);
          }}
        />

        {attachPreview.length ? (
          <ul className="divide-y rounded-xl border">
            {attachPreview.map((f, idx) => (
              <li
                key={`${f.id}-${idx}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-8 w-8 shrink-0 rounded bg-gray-100" />
                  <a
                    href={filePublicUrl(f as any)}
                    className="truncate text-sm text-blue-600 underline hover:no-underline"
                    target="_blank"
                  >
                    {f.originalName || f.filename || f.path || f.id}
                  </a>
                </div>
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                  onClick={() => {
                    setAttachPreview((prev) => prev.filter((x) => x !== f));
                    set(
                      'attachments',
                      (form.attachments || []).filter((id) => id !== f.id),
                    );
                  }}
                >
                  Gỡ
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">{VI_MISC.status}</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value as NoticeStatus)}
            className="w-full rounded-xl border px-3 py-2"
          >
            {STATUS_OPTIONS_VI.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{VI_MISC.visibility}</label>
          <select
            value={form.visibility}
            onChange={(e) => set('visibility', e.target.value as NoticeVisibility)}
            className="w-full rounded-xl border px-3 py-2"
          >
            {VIS_OPTIONS_VI.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Tags (comma-separated)</label>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="vd: nội-bộ, quy-định, tín-dụng"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">{VI_MISC.publishAt}</label>
          <input
            type="datetime-local"
            value={(form.publishAt as any) || ''}
            onChange={(e) => set('publishAt', e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{VI_MISC.expireAt}</label>
          <input
            type="datetime-local"
            value={(form.expireAt as any) || ''}
            onChange={(e) => set('expireAt', e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !form.title}
          className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? 'Đang lưu…' : noticeId ? 'Lưu thay đổi' : 'Tạo thông báo'}
        </button>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : history.back())}
          className="rounded-xl border px-4 py-2"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
