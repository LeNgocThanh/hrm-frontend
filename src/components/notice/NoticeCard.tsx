'use client';

//import Image from 'next/image';
import Link from 'next/link';
import type { Notice } from '@/types/notice';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchNoticeAdmin } from '@/lib/api/notices';
import { VI_STATUS, VI_VISIBILITY, VIS_OPTIONS_VI, STATUS_OPTIONS_VI, VI_MISC } from '@/i18n/notice.vi';
// ⬇️ Adjust this import to match your project structure if different
import { getFileInfo, filePublicUrl } from '@/lib/api/files';

export default function NoticeCard({
  item,
  adminControls = false,
}: {
  item: Notice;
  adminControls?: boolean;
}) {
  // --- Resolve cover image from `coverImage` which is an ID ---
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveCover() {
      try {
        setCoverError(null);
        if (!item?.coverImage) {
          setCoverUrl(null);
          return;
        }

        // If coverImage is an ID (string) -> fetch file info -> public URL from path
        if (typeof item.coverImage === 'string') {
          const fi = await getFileInfo(item.coverImage);
          console.log('fi', fi);
          if (cancelled) return;
          const url = fi?.path ? filePublicUrl(fi) : undefined;
          setCoverUrl(url || null);
          return;
        }

        // If API already returned an object (rare case) -> try known fields
        const obj: any = (item as any).coverImage;
        const url = obj?.publicUrl || (obj?.path ? filePublicUrl(obj.path) : obj?.url);
        setCoverUrl(url || null);
      } catch (e: any) {
        if (!cancelled) {
          setCoverUrl(null);
          setCoverError(e?.message || 'Không thể tải ảnh bìa');
          // fail silently in UI; optionally log
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Resolve cover error:', e);
          }
        }
      }
    }

    resolveCover();
    return () => {
      cancelled = true;
    };
  }, [item?.coverImage]);

  // --- optimistic admin controls state ---
  const qc = useQueryClient();
  const [localStatus, setLocalStatus] = useState<Notice['status']>(item.status);
  const [localVis, setLocalVis] = useState<Notice['visibility']>(item.visibility);
  const [saving, setSaving] = useState<null | 'status' | 'visibility'>(null);
  const [ok, setOk] = useState<null | 'status' | 'visibility'>(null);

  const { mutateAsync } = useMutation({
    mutationFn: (payload: { status?: Notice['status']; visibility?: Notice['visibility'] }) =>
      patchNoticeAdmin(item._id, payload),
    onSuccess: (updated) => {
      setLocalStatus(updated.status);
      setLocalVis(updated.visibility);
      qc.invalidateQueries({ queryKey: ['notices'] });
    },
  });

  const handleStatus = async (next: Notice['status']) => {
    try {
      setSaving('status');
      setLocalStatus(next);
      await mutateAsync({ status: next });
      setOk('status');
      setTimeout(() => setOk(null), 1500);
    } catch (e) {
      setLocalStatus(item.status);
      console.error(e);
      alert('Cập nhật status không thành công.');
    } finally {
      setSaving(null);
    }
  };

  const handleVisibility = async (next: Notice['visibility']) => {
    try {
      setSaving('visibility');
      setLocalVis(next);
      await mutateAsync({ visibility: next });
      setOk('visibility');
      setTimeout(() => setOk(null), 1500);
    } catch (e) {
      setLocalVis(item.visibility);
      console.error(e);
      alert('Cập nhật visibility không thành công.');
    } finally {
      setSaving(null);
    }
  };

  // chặn overlay/link bắt sự kiện trên controls
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    // giúp menu native của <select> không bị đóng do bubbling
    e.nativeEvent?.stopImmediatePropagation?.();
  };

  return (
    <article className="relative overflow-visible rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {coverUrl ? (
          <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg">
            <img src={coverUrl} alt={item.title} className="object-cover" />
          </div>
        ) : (
          <div className="h-24 w-36 shrink-0 rounded-lg bg-gray-100" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.pinned ? (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                {VI_MISC.pinned}
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

          {/* ADMIN CONTROLS */}
          {adminControls && (
            <div className="relative z-[60] mt-3" onClick={stop} onMouseDown={stop}>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white/80 p-2 shadow-sm">
                {/* Status */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 text-gray-600">{VI_MISC.status}</span>
                  <select
                    className="w-40 rounded-lg border bg-white px-2 py-1 outline-none ring-0 focus:ring-2 focus:ring-black/10 disabled:opacity-50"
                    value={localStatus}
                    disabled={saving === 'status'}
                    onChange={(e) => handleStatus(e.target.value as Notice['status'])}
                  >
                    {STATUS_OPTIONS_VI.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {ok === 'status' && <span className="text-xs text-emerald-600">✓ Đã lưu</span>}
                </div>

                {/* Visibility */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 text-gray-600">{VI_MISC.visibility}</span>
                  <select
                    className="w-40 rounded-lg border bg-white px-2 py-1 outline-none ring-0 focus:ring-2 focus:ring-black/10 disabled:opacity-50"
                    value={localVis}
                    disabled={saving === 'visibility'}
                    onChange={(e) => handleVisibility(e.target.value as Notice['visibility'])}
                  >
                    {VIS_OPTIONS_VI.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {ok === 'visibility' && (
                    <span className="text-xs text-emerald-600">✓ Đã lưu</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional: show a tiny warning if cover failed */}
      {coverError && (
        <p className="mt-2 text-xs text-amber-600">{coverError}</p>
      )}
    </article>
  );
}
