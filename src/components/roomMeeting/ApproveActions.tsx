'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/room-meetings';

type Props = {
  meetingId: string;
  disabled?: boolean;        // disable vì lý do nghiệp vụ (ví dụ đăng ký quá khứ)
  hasConflicts?: boolean;    // chỉ để cảnh báo UX
};

export default function ApproveActions({ meetingId, disabled, hasConflicts }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [err, setErr] = useState<string>('');
  const router = useRouter();

  async function submit(decision: 'APPROVED' | 'REJECTED') {
    if (disabled && decision === 'APPROVED') return; // không cho duyệt khi bị disable
    setErr('');
    setBusy(decision);
    try {
      await api(`/meetings/${meetingId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      });
      router.refresh(); // reload lại dữ liệu trang server
    } catch (e: any) {
      setErr(e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {hasConflicts && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Lưu ý: khung thời gian đang trùng với lịch đã duyệt — phê duyệt có thể bị từ chối.
        </div>
      )}
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Ghi chú (tuỳ chọn)"
        className="w-full rounded border px-3 py-2 text-sm"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => submit('APPROVED')}
          disabled={busy !== null || !!disabled}
          className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
          title={disabled ? 'Đăng ký không hợp lệ (không thể duyệt)' : 'Phê duyệt cuộc họp'}
        >
          {busy === 'APPROVED' ? 'Đang duyệt…' : 'Duyệt'}
        </button>
        <button
          onClick={() => submit('REJECTED')}
          disabled={busy !== null}
          className="rounded-lg bg-rose-600 text-white px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
          title="Từ chối cuộc họp"
        >
          {busy === 'REJECTED' ? 'Đang từ chối…' : 'Từ chối'}
        </button>
        {err && <span className="text-sm text-rose-700">{err}</span>}
      </div>
    </div>
  );
}
