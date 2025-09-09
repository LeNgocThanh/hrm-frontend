'use client';

import { useState } from 'react';

export interface Filters {
  q?: string;
  category?: string;
}

export default function NoticeFilters({
  initial,
  onChange,
}: {
  initial?: Filters;
  onChange: (f: Filters) => void;
}) {
  const [q, setQ] = useState(initial?.q || '');
  const [category, setCategory] = useState(initial?.category || '');

  return (
    <div className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo tiêu đề, nội dung…"
        className="w-full rounded-xl border px-3 py-2 outline-none"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Danh mục (ví dụ: quy định, thông báo)"
        className="w-full rounded-xl border px-3 py-2 outline-none sm:max-w-xs"
      />
      <button
        onClick={() => onChange({ q: q || undefined, category: category || undefined })}
        className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-50"
      >
        Lọc
      </button>
    </div>
  );
}
