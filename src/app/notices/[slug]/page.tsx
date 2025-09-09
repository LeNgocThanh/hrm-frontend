import type { Notice } from '@/types/notice';
import { getNoticeBySlug } from '@/lib/api/notices';
import Image from 'next/image';

interface Props {
  params: { slug: string };
}

export default async function NoticeDetailPage({ params }: Props) {
  const notice: Notice = await getNoticeBySlug(params.slug);

  const cover =
    typeof notice.coverImage === 'string'
      ? notice.coverImage
      : notice.coverImage && 'url' in notice.coverImage
      ? (notice.coverImage as any).url
      : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        {notice.category ? (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">{notice.category}</span>
        ) : null}
        {notice.pinned ? (
          <span className="rounded-full border px-3 py-1 text-xs">Pinned</span>
        ) : null}
      </div>

      <h1 className="text-3xl font-bold">{notice.title}</h1>

      {cover ? (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl">
          <Image src={cover} alt={notice.title} fill className="object-cover" />
        </div>
      ) : null}

      {notice.summary ? <p className="text-gray-600">{notice.summary}</p> : null}

      {/* Nội dung hiển thị đơn giản; nếu bạn lưu Markdown, hãy render bằng markdown renderer */}
      {notice.content ? (
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: notice.content }} />
      ) : (
        <p className="text-gray-500">Chưa có nội dung chi tiết.</p>
      )}

      {(notice.attachments || []).length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Tệp đính kèm</h2>
          <ul className="list-inside list-disc">
            {notice.attachments!.map((f) => (
              <li key={f._id}>
                {/* TODO: thay href bằng API tải tệp thật của bạn */}
                <a
                  href={f.url || '#'}
                  className="text-blue-600 underline hover:no-underline"
                  target="_blank"
                >
                  {f.filename || 'Tệp đính kèm'}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
