'use client'

import { useEffect, useMemo, useState } from "react";
import type { Notice } from '@/types/notice'
import { getNoticeBySlug } from '@/lib/api/notices'
import AttachmentList from '@/components/AttachmentList'
import { getFileInfo, getFileInfos, filePublicUrl } from '@/lib/api/files'
import { useParams } from "next/navigation";

import type { UploadFileRef, UploadFileInfo, UploadResponse } from '@/types/upload'

interface Props { params: { slug: string } }

export default function NoticeDetailClientPage() {
  const params = useParams();
  const slug = useMemo(() => {
    // supports catch-all or standard dynamic route
    const raw = (params?.slug ?? "") as string | string[];
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<UploadFileInfo[] | UploadFileRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1) Load notice
        const n = await getNoticeBySlug(slug);
        if (cancelled) return;
        setNotice(n);

        // 2) Resolve cover
        let cUrl: string | undefined = undefined;
        if (typeof n.coverImage === "string" && n.coverImage) {
          try {
            const fi = await getFileInfo(n.coverImage);
            if (!cancelled) cUrl = filePublicUrl(fi);
          } catch {
            // ignore
          }
        } else if (n.coverImage && typeof n.coverImage === "object") {
          cUrl = filePublicUrl(n.coverImage as UploadFileInfo | UploadFileRef);
        }
        if (!cancelled) setCoverUrl(cUrl);

        // 3) Resolve attachments
        const rawAtt = (n.attachments ?? []) as (string | UploadFileInfo | UploadFileRef)[];
        let files: UploadFileInfo[] | UploadFileRef[] = [];
        if (rawAtt.length && typeof rawAtt[0] === "string") {
          try {
            files = await getFileInfos(rawAtt as string[]);
          } catch {
            files = [];
          }
        } else {
          files = rawAtt as UploadFileInfo[] | UploadFileRef[];
        }
        if (!cancelled) setAttachments(files);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Đã xảy ra lỗi khi tải dữ liệu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (slug) load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-gray-500">Không xác định được tham số "slug".</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-gray-500">Đang tải thông báo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-red-600">Lỗi: {error}</p>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-gray-500">Không tìm thấy thông báo.</p>
      </div>
    );
  }

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

      {coverUrl ? (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={notice.title} className="h-full w-full object-cover" />
        </div>
      ) : null}

      {notice.summary ? (
        <p className="text-gray-600">{notice.summary}</p>
      ) : null}

      {notice.content ? (
        <div
          className="prose max-w-none"
          // content is assumed to be sanitized on the server/API side
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />
      ) : (
        <p className="text-gray-500">Chưa có nội dung chi tiết.</p>
      )}

      <AttachmentList files={attachments as any} />
    </div>
  );
}