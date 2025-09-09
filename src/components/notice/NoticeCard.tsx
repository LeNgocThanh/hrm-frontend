import Image from 'next/image';
import Link from 'next/link';
import type { Notice } from '@/types/notice';

export default function NoticeCard({ item }: { item: Notice }) {
  const cover =
    typeof item.coverImage === 'string'
      ? item.coverImage
      : item.coverImage?.url || undefined;

  return (
    <article className="rounded-2xl border p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start gap-4">
        {cover ? (
          <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg">
            {/* Nếu cover là url ảnh trực tiếp */}
            <Image src={cover} alt={item.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="h-24 w-36 shrink-0 rounded-lg bg-gray-100" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.pinned ? (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                Pinned
              </span>
            ) : null}
            {item.category ? (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {item.category}
              </span>
            ) : null}
          </div>

          <h3 className="mt-1 line-clamp-2 text-lg font-semibold">
            <Link href={`/notices/${item.slug || item._id}`}>{item.title}</Link>
          </h3>

          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.summary}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1">
            {(item.tags || []).slice(0, 4).map((t) => (
              <span key={t} className="rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
