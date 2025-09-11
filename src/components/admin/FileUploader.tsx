'use client'

import { useRef, useState } from 'react'
import { uploadFile, uploadFiles } from '@/lib/api/files'
import type { UploadFileRef } from '@/types/upload'

export default function FileUploader({
  multiple = false,
  label = 'Tải tệp',
  onUploaded,
  getToken,
  getUserId,
}: {
  multiple?: boolean
  label?: string
  onUploaded: (files: UploadFileRef[]) => void
  getToken?: () => string | undefined
  getUserId?: () => string | undefined
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = () => inputRef.current?.click()

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (!files.length) return
    setBusy(true)
    setError(null)
    try {
      const token = getToken?.()
      const uploadedBy = getUserId?.()
      const opts = { uploadedBy, resourceType: 'noties' }
      const uploaded = multiple
        ? await uploadFiles(files, opts, token)
        : [await uploadFile(files[0], opts, token)]
      onUploaded(uploaded)
    } catch (err: any) {
      setError(err?.message || 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" className="hidden" onChange={onChange} multiple={multiple} />
      <button type="button" onClick={onPick} disabled={busy} className="rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
        {busy ? 'Đang tải…' : label}
      </button>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  )
}