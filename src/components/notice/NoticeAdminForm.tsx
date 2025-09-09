'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createNotice } from '@/lib/api/notices'
import type { CreateNoticeInput, NoticeStatus, NoticeVisibility } from '@/types/notice'
import { NoticeStatus as S, NoticeVisibility as V } from '@/types/notice'
import { useRouter } from 'next/navigation'

function toIsoOrUndefined(v?: string) {
  if (!v) return undefined
  // value from <input type="datetime-local">, e.g., "2025-09-09T10:30"
  const dt = new Date(v)
  return isNaN(dt.getTime()) ? undefined : dt.toISOString()
}

function chipify(str?: string) {
  return (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function NoticeForm({ getToken }: { getToken?: () => string | undefined }) {
  const router = useRouter()

  const [form, setForm] = useState<CreateNoticeInput>({
    title: '',
    summary: '',
    content: '',
    category: '',
    tags: [],
    status: S.Draft,
    visibility: V.Internal,
    pinned: false,
    publishAt: undefined,
    expireAt: undefined,
    allowedPermissions: [],
  })

  const [tagsInput, setTagsInput] = useState('')
  const [allowedInput, setAllowedInput] = useState('')

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      const payload: CreateNoticeInput = {
        ...form,
        tags: chipify(tagsInput),
        allowedPermissions: form.visibility === V.RoleBased ? chipify(allowedInput) : undefined,
        publishAt: toIsoOrUndefined(form.publishAt),
        expireAt: toIsoOrUndefined(form.expireAt),
      }
      const token = getToken?.()
      return createNotice(payload, token)
    },
    onSuccess: (n) => {
      // điều hướng về trang chi tiết hoặc danh sách
      router.push(`/notices/${n.slug || n._id}`)
    },
  })

  const set = (k: keyof CreateNoticeInput, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  return (
    <form
      className="mx-auto max-w-3xl space-y-4 rounded-2xl border bg-white p-4 shadow"
      onSubmit={async (e) => {
        e.preventDefault()
        await mutateAsync()
      }}
    >
      <h1 className="text-xl font-semibold">Tạo thông báo</h1>

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
          value={form.summary || ''}
          onChange={(e) => set('summary', e.target.value)}
          placeholder="Mô tả ngắn gọn nội dung chính..."
          className="min-h-24 w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Nội dung</label>
        <textarea
          value={form.content || ''}
          onChange={(e) => set('content', e.target.value)}
          placeholder="Bạn có thể lưu HTML/Markdown tùy BE render"
          className="min-h-40 w-full rounded-xl border px-3 py-2 font-mono"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Trạng thái</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value as NoticeStatus)}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value={S.Draft}>Draft</option>
            <option value={S.Published}>Published</option>
            <option value={S.Archived}>Archived</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Hiển thị</label>
          <select
            value={form.visibility}
            onChange={(e) => set('visibility', e.target.value as NoticeVisibility)}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value={V.Public}>Public</option>
            <option value={V.Internal}>Internal</option>
            <option value={V.RoleBased}>Role-based</option>
          </select>
        </div>
      </div>

      {form.visibility === V.RoleBased ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">Quyền được xem (comma-separated)</label>
          <input
            value={allowedInput}
            onChange={(e) => setAllowedInput(e.target.value)}
            placeholder="VD: notices:read, notices:read:dept-credit"
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
      ) : null}

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
          <label className="text-sm font-medium">Publish At</label>
          <input
            type="datetime-local"
            value={form.publishAt as any}
            onChange={(e) => set('publishAt', e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Expire At</label>
          <input
            type="datetime-local"
            value={form.expireAt as any}
            onChange={(e) => set('expireAt', e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
      </div>

      {/* TODO: phần upload cover/attachments sẽ nối vào module upload sẵn có của bạn */}
      <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-600">
        Upload sẽ tích hợp sau (coverImage, attachments). Hiện gửi ID qua các trường cùng tên.
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !form.title}
          className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? 'Đang lưu…' : 'Tạo thông báo'}
        </button>
        <button
          type="button"
          onClick={() => history.back()}
          className="rounded-xl border px-4 py-2"
        >
          Hủy
        </button>
      </div>
    </form>
  )
}