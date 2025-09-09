'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QueryProvider from '@/components/notice/QuerryProvider';
import NoticeCard from '@/components/notice/NoticeCard';
import NoticeFilters, { type Filters } from '@/components/notice/NoticeFilter';
import { listNotices } from '@/lib/api/notices';
import type { Notice } from '@/types/notice';

function NoticesClient() {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['notices', filters, page],
    queryFn: () =>
      listNotices({
        q: filters.q,
        category: filters.category,
        page,
        limit: 12,
      }),
    // Bạn có thể tinh chỉnh staleTime, gcTime…
  });

  useEffect(() => {
    setPage(1); // đổi filter thì về trang 1
  }, [filters]);

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Thông báo / Nội bộ</h1>

      <NoticeFilters
        initial={filters}
        onChange={(f) => setFilters(f)}
      />

      {isLoading ? (
        <p>Đang tải…</p>
      ) : isError ? (
        <p className="text-red-600">Không tải được dữ liệu.</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600">Chưa có bản ghi phù hợp.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n: Notice) => (
            <NoticeCard key={n._id} item={n} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          className="rounded-xl border px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={(data?.page ?? 1) <= 1 || isFetching}
        >
          Trang trước
        </button>
        <div className="text-sm text-gray-600">
          Trang {data?.page ?? 1} / {data ? Math.ceil((data.total || 0) / (data.limit || 1)) : 1}
        </div>
        <button
          className="rounded-xl border px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => p + 1)}
          disabled={items.length < (data?.limit ?? 12) || isFetching}
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <QueryProvider>
      <NoticesClient />
    </QueryProvider>
  );
}
