'use client';
import * as React from 'react';
import { FixedSizeList as List } from 'react-window';
import type { AssetEvent } from '@/types/asset';

type Props = {
  events: AssetEvent[];
  usersMap: Map<string, string>;
};

function userLabel(usersMap: Map<string, string>, id?: string) {
  return id ? (usersMap.get(id) ?? id) : '';
}

function formatDate(d?: string) {
  if (!d) return '';
  return d.length > 10 ? d.slice(0, 10) : d;
}

export default function AssetHistoryRow({ events, usersMap }: Props) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const ev = events[index];
    const label = `${ev.type}  ${formatDate(ev.date)}  ${userLabel(usersMap, ev.toUserId)} - ${userLabel(usersMap, ev.fromUserId)}`;
    const active = openId === ev._id;

    return (
      <div style={style} className="px-2">
        <div className="relative pl-6">
          {/* Timeline dot + line */}
          <span className="absolute left-0 top-3 w-2 h-2 rounded-full bg-gray-400" />
          <span className="absolute left-[3px] top-6 w-[2px] h-[calc(100%-12px)] bg-gray-200" />
          <button
            className="w-full text-left px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 flex items-center justify-between"
            onClick={() => setOpenId(active ? null : (ev._id ?? `${index}`))}
          >
            <span className="truncate">{label}</span>
            <span className="text-gray-500">{active ? '▴' : '▾'}</span>
          </button>
          {active && (
            <div className="px-3 pb-3 text-sm text-gray-700 bg-white border-x border-b rounded-b-lg">
              <div><span className="text-gray-500">Ngày:</span> {formatDate(ev.date)}</div>
              {ev.note && <div><span className="text-gray-500">Mô tả:</span> {ev.note}</div>}
              {ev.cost && <div><span className="text-gray-500">Chi phí:</span> {ev.cost.amount} {ev.cost.currency}</div>}
              {(ev.fromUserId || ev.toUserId) && (
                <div><span className="text-gray-500">Luân chuyển:</span> {userLabel(usersMap, ev.fromUserId) || '—'} → {userLabel(usersMap, ev.toUserId) || '—'}</div>
              )}
              {ev.toUserId && <div><span className="text-gray-500">Thực hiện:</span> {userLabel(usersMap, ev.toUserId)}</div>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const height = Math.min(360, Math.max(56, events.length * 64));

  return (
    <div className="w-full">
      <List height={height} itemCount={events.length} itemSize={64} width="100%">
        {Row}
      </List>
    </div>
  );
}
