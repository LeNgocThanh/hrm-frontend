import Image from 'next/image'
import { bestGuessFileName, getFileUrl, isImageLike } from '@/lib/api/files'
import type { UploadFileRef } from '@/types/upload'

export default function AttachmentList({ files = [] }: { files: UploadFileRef[] }) {
  if (!files.length) return null

  const images = files.filter(isImageLike)
  const others = files.filter((f) => !isImageLike(f))

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Tệp đính kèm</h2>

      {images.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((f) => {
            const url = getFileUrl(f)
            if (!url) return null
            return (
              <a key={f._id} href={url} target="_blank" className="group relative block overflow-hidden rounded-2xl border">
                <div className="relative h-36 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={bestGuessFileName(f)} className="h-full w-full object-cover transition group-hover:scale-105" />
                </div>
                <div className="truncate px-3 py-2 text-xs text-gray-700">{bestGuessFileName(f)}</div>
              </a>
            )
          })}
        </div>
      ) : null}

      {others.length ? (
        <ul className="list-inside list-disc space-y-1 text-sm">
          {others.map((f) => {
            const url = getFileUrl(f)
            return (
              <li key={f._id}>
                {url ? (
                  <a href={url} className="text-blue-600 underline hover:no-underline" target="_blank">
                    {bestGuessFileName(f)}
                  </a>
                ) : (
                  <span className="text-gray-600">{bestGuessFileName(f)}</span>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}