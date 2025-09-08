"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { overlaps } from "@/lib/api/time";
import { api } from "@/lib/api/room-meetings";
import { Meeting, MeetingRoom, MeetingStatus, ObjectId } from "@/types/room-meetings";
import { Organization } from "@/types/organization";
import { User } from "@/types/index";

type CreatePayload = {
  organizationId: ObjectId; // tổ chức ĐẶT
  roomId: ObjectId; // phòng (chủ quản có thể khác)
  title: string;
  agenda?: string;
  startAt: string;
  endAt: string;
  participants: { userId: ObjectId; role?: "CHAIR" | "REQUIRED" | "OPTIONAL"; note?: string }[];
  externalGuests?: { leaderName?: string; leaderPhone?: string; organization?: string; note?: string; headcount: number }[];
  requiresApproval?: boolean;
  // NEW: cho phép gửi organizerId (backend có thể bỏ qua nếu chưa hỗ trợ,
  // nhưng UI giờ tách bạch khỏi chair)
  organizerId?: ObjectId;
};

type ConflictSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
type ParticipantConflictItem = {
  meetingId: string;
  title: string;
  startAt: string | Date;
  endAt: string | Date;
  roomId: string;
  otherStatus: string;
  response?: 'ACCEPTED' | 'DECLINED' | 'PENDING' | 'INVITED' | string;
  role?: 'CHAIR' | 'REQUIRED' | 'OPTIONAL' | string;
  severity: ConflictSeverity;
};
type ParticipantConflictByUser = {
  userId: string;
  conflicts: ParticipantConflictItem[];
};
type ParticipantConflictResult = {
  hasConflicts: boolean;
  summary: Record<ConflictSeverity, number>;
  byUser: ParticipantConflictByUser[];
};

export default function NewMeetingPage() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // ─── Form states ──────────────────────────────────────────────────────────────
  const [orgId, setOrgId] = useState<string>(""); // tổ chức ĐẶT
  const [roomId, setRoomId] = useState<string>(""); // phòng (có chủ quản riêng)
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState<string>(""); // datetime-local
  const [end, setEnd] = useState<string>(""); // datetime-local

  const [organizer, setOrganizer] = useState<string>(""); // NEW: organizer riêng
  const [chair, setChair] = useState<string>(""); // chair
  const [requiredIds, setRequiredIds] = useState<string[]>([]); // participants REQUIRED
  const [guestCount, setGuestCount] = useState<number>(0);
  const [requiresApproval, setRequiresApproval] = useState<boolean | undefined>(undefined);
  

  // ─── UX states ────────────────────────────────────────────────────────────────
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<Meeting[]>([]);
  const [error, setError] = useState<string>("");
  const [okMsg, setOkMsg] = useState<string>("");
  const autoEndInitialized = useRef(false); // NEW: chỉ auto-fill end 1 lần đầu
  const [participantWarn, setParticipantWarn] = useState<ParticipantConflictResult | null>(null);


  // ─── Load organizations, users, rooms ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [orgRs, userRs, roomRs] = await Promise.all([
          apiClient.get<Organization[]>("/organizations"),
          apiClient.get<User[]>("/users"),
          api<MeetingRoom[]>("/meeting-rooms"),
        ]);
        setOrgs(orgRs);
        setUsers(userRs);
        setRooms(roomRs);

        if (orgRs[0]) setOrgId(orgRs[0]._id);
        if (roomRs[0]) {
          setRoomId(roomRs[0]._id);
          setRequiresApproval(roomRs[0].requiresApproval);
        }
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    const r = rooms.find((r) => r._id === roomId);
    if (r) setRequiresApproval(r.requiresApproval);
  }, [roomId, rooms]);

  const orgMap = useMemo(() => new Map(orgs.map((o) => [o._id, o])), [orgs]);
  const selectedRoom = rooms.find((r) => r._id === roomId);
  const bookingOrg = orgMap.get(orgId);
  const ownerOrg = selectedRoom ? orgMap.get(selectedRoom.organizationId) : undefined;

  // ─── Build payload (dedupe participants: không để trùng CHAIR/REQUIRED) ───────
  const payload: CreatePayload | null = useMemo(() => {
    if (!orgId || !roomId || !title || !start || !end) return null;
    const s = new Date(start),
      e = new Date(end);
    if (!(s < e)) return null;

    const requiredUnique = Array.from(new Set(requiredIds.filter((uid) => uid && uid !== chair)));
    const parts = [
      ...(chair ? [{ userId: chair, role: "CHAIR" as const }] : []),
      ...requiredUnique.map((uid) => ({ userId: uid as ObjectId, role: "REQUIRED" as const })),
    ];

    return {
      organizationId: orgId as any,
      roomId: roomId as any,
      title,
      agenda,
      note,
      startAt: s.toISOString(),
      endAt: e.toISOString(),
      participants: parts,
      externalGuests: guestCount > 0 ? [{ headcount: guestCount, note: "Đoàn khách" }] : [],
      requiresApproval,
      organizerId: organizer || undefined, // NEW
    };
  }, [orgId, roomId, title, agenda, note, start, end, chair, requiredIds, guestCount, requiresApproval, organizer]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const nameOf = (id?: string) => {
  if (!id) return '—';
  const u = (users || []).find(x => String(x._id) === String(id));
  return u?.fullName || id;
};

  async function precheck() {
    setChecking(true);
    setConflicts([]);
    setParticipantWarn(null);
    setError("");
    setOkMsg("");
    try {
      if (!payload) throw new Error("Thiếu thông tin hoặc thời gian không hợp lệ.");
      // const rs = await api<Meeting[]>("/meetings", {
      //   query: {
      //     roomId: payload.roomId,
      //     from: payload.startAt,
      //     to: payload.endAt,
      //     status: MeetingStatus.SCHEDULED,
      //   },
      // });
      const s = new Date(payload.startAt),
        e = new Date(payload.endAt);
      //const hit = rs.filter((m) => overlaps(s, e, new Date(m.startAt), new Date(m.endAt)));
    //  setConflicts(hit);
     // if (hit.length === 0) setOkMsg("Không phát hiện trùng với lịch đã approve.");
      const participantIds = (payload.participants || [])
      .map((p: any) => p?.userId)
      .filter(Boolean);

      const [roomList, peopleConf] = await Promise.all([
      api<Meeting[]>("/meetings", {
        query: {
          roomId: payload.roomId,
          from: payload.startAt,  // ISO string
          to: payload.endAt,      // ISO string
          status: MeetingStatus.SCHEDULED,
        },
      }),
      participantIds.length
        ? api<ParticipantConflictResult>("/meetings/conflicts/participants", {
            method: "POST",
            body: JSON.stringify({
              participantIds,
              startAt: payload.startAt,
              endAt: payload.endAt,
              // excludeMeetingId: payload._id // nếu đang edit, truyền thêm
            }),
          })
        : Promise.resolve({
            hasConflicts: false,
            summary: { HIGH: 0, MEDIUM: 0, LOW: 0 },
            byUser: [],
          } as ParticipantConflictResult),
    ]);

    const hit = roomList.filter((m) =>
      overlaps(s, e, new Date(m.startAt), new Date(m.endAt))
    );
    setConflicts(hit);

    // Lưu cảnh báo người tham dự
    setParticipantWarn(peopleConf);

if (hit.length === 0 && !peopleConf.hasConflicts) {
      setOkMsg("Không phát hiện trùng phòng hoặc trùng người tham dự.");
    } else if (hit.length === 0 && peopleConf.hasConflicts) {
      setOkMsg(""); // có cảnh báo người thì không in OK
    } else if (hit.length > 0) {
      setOkMsg(""); // có trùng phòng thì để phần hiển thị dưới lo
    }
  } catch (e: any) {
    setError(e?.message || "Có lỗi khi kiểm tra.");
  } finally {
    setChecking(false);
  }
  }

  async function submit() {
    setError("");
    setOkMsg("");
    try {
      if (!payload) throw new Error("Thiếu thông tin hoặc thời gian không hợp lệ.");
      if (new Date(payload.startAt).getTime() <= Date.now()) {
        throw new Error("Chỉ được đăng ký cho tương lai.");
      }
      await api("/meetings", { method: "POST", body: JSON.stringify(payload) });
      setOkMsg("Tạo đăng ký thành công!");
      setConflicts([]);
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ─── Helpers UI ──────────────────────────────────────────────────────────────
  const minStart = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  function SeverityBadge({ severity }: { severity: ConflictSeverity }) {
  const map: Record<ConflictSeverity, { text: string; cls: string }> = {
    HIGH:   { text: 'Cao',  cls: 'bg-rose-100 text-rose-700 border-rose-300' },
    MEDIUM: { text: 'TB',   cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    LOW:    { text: 'Nhẹ',  cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  };
  const s = map[severity];
  return <span className={`mr-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.text}</span>;
}
  
  function toggleRequired(userId: string, checked: boolean) {
    setRequiredIds((prev) => {
      const set = new Set(prev);
      checked ? set.add(userId) : set.delete(userId);
      return Array.from(set);
    });
  }
  function selectAll() {
    setRequiredIds(users.map((u) => u._id));
  }
  function clearAll() {
    setRequiredIds([]);
  }

  const selectedSet = useMemo(() => new Set(requiredIds), [requiredIds]);
  const [selectedUsers, otherUsers] = useMemo(() => {
    const sel: User[] = [];
    const other: User[] = [];
    for (const u of users) {
      (selectedSet.has(u._id) ? sel : other).push(u);
    }
    sel.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
    other.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
    return [sel, other];
  }, [users, selectedSet]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6 px-3 sm:px-4">
      <h1 className="text-2xl font-bold">Đăng ký cuộc họp</h1>

      <div className="grid gap-4 rounded-xl border bg-white p-4 overflow-hidden">
        {/* Organization (tổ chức ĐẶT) */}
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Tổ chức đặt</span>
          <select
            className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            {orgs.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        {/* Room (không lọc theo org) */}
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Phòng</span>
          <select
            className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {rooms
              .slice()
              .sort(
                (a, b) =>
                  (orgMap.get(a.organizationId)?.name || "").localeCompare(
                    orgMap.get(b.organizationId)?.name || "",
                    "vi"
                  ) || a.name.localeCompare(b.name, "vi")
              )
              .map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} · {r.location || "—"} · {r.capacity} chỗ · Chủ quản: {orgMap.get(r.organizationId)?.name || "—"}
                </option>
              ))}
          </select>
          {selectedRoom && ownerOrg && bookingOrg && ownerOrg._id !== bookingOrg._id && (
            <div className="text-xs text-amber-700 mt-1">
              Phòng thuộc <b>{ownerOrg.name}</b>, bạn đang đặt thay mặt <b>{bookingOrg.name}</b>.
            </div>
          )}
        </label>

        {/* Organizer (mới, độc lập với Chair) */}
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Người tổ chức (Organizer)</span>
          <select
            className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
          >
            <option value="">— Chọn —</option>
            {users
              .slice()
              .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))
              .map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullName}
                </option>
              ))}
          </select>
          <span className="text-xs text-slate-500">Có thể trùng hoặc khác với Chair/người tham dự.</span>
        </label>

        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Tiêu đề</span>
          <input
            className="w-full max-w-full rounded border px-3 py-2 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Kế hoạch họp</span>
          <textarea
            className="w-full max-w-full rounded border px-3 py-2 resize-y min-h-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
          />
        </label>

        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Ghi chú thêm</span>
          <textarea
            className="w-full max-w-full rounded border px-3 py-2 resize-y min-h-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {/* Time inputs (auto-fill end từ start lần đầu) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
          <label className="grid gap-1 min-w-0">
            <span className="text-sm">Bắt đầu</span>
            <input
              type="datetime-local"
              min={minStart}
              className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                setStart(v);
                if (!autoEndInitialized.current && !end) {
                  setEnd(v); // auto-fill ONE TIME
                  autoEndInitialized.current = true;
                }
              }}
            />
          </label>
          <label className="grid gap-1 min-w-0">
            <span className="text-sm">Kết thúc</span>
            <input
              type="datetime-local"
              className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>

        {/* Chair */}
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Chair</span>
          <select
            className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={chair}
            onChange={(e) => setChair(e.target.value)}
          >
            <option value="">— Chọn —</option>
            {users
              .slice()
              .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))
              .map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullName}
                </option>
              ))}
          </select>
        </label>

        {/* Participants (checkbox, chọn tất cả/bỏ tất cả, selected nổi lên trên) */}
        <div className="grid gap-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Người tham dự (Required)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
              >
                Bỏ tất cả
              </button>
            </div>
          </div>

          {/* Selected first */}
          <div className="rounded border overflow-hidden max-h-80 overflow-y-auto">
            {selectedUsers.length > 0 && (
              <div className="border-b bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Đã chọn ({selectedUsers.length})
              </div>
            )}
            {selectedUsers.map((u) => (
              <label key={"sel-" + u._id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedSet.has(u._id)}
                  onChange={(e) => toggleRequired(u._id, e.target.checked)}
                />
                <span className="text-sm truncate">{u.fullName}</span>
              </label>
            ))}
            {otherUsers.length > 0 && selectedUsers.length > 0 && <div className="border-t" />}
            {otherUsers.length > 0 && (
              <div className="bg-white">
                <div className="px-3 py-2 text-xs text-slate-600 border-b bg-slate-50">Khác</div>
                {otherUsers.map((u) => (
                  <label key={"oth-" + u._id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedSet.has(u._id)}
                      onChange={(e) => toggleRequired(u._id, e.target.checked)}
                    />
                    <span className="text-sm truncate">{u.fullName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-slate-500">
            Chair (nếu chọn) sẽ được gửi với vai trò <b>CHAIR</b>. Những người tick ở trên được gửi với vai trò <b>REQUIRED</b>.
          </span>
        </div>

        {/* Guests */}
        <label className="grid gap-1 min-w-0">
          <span className="text-sm">Đoàn khách (số người)</span>
          <input
            type="number"
            min={0}
            className="w-full max-w-full rounded border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
            value={guestCount}
            onChange={(e) => setGuestCount(Number(e.target.value))}
          />
        </label>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={precheck}
            disabled={!payload || checking}
            className="rounded-lg border px-3 py-2 hover:bg-slate-100 disabled:opacity-50"
          >
            Kiểm tra trùng với lịch đã approve, và người dùng đã tham gia
          </button>
          <button
            onClick={submit}
            disabled={!payload}
            className="rounded-lg bg-slate-900 text-white px-3 py-2 hover:opacity-90 disabled:opacity-50"
          >
            Gửi đăng ký
          </button>
        </div>

        {okMsg && <div className="text-sm text-emerald-700">{okMsg}</div>}
        {error && <div className="text-sm text-rose-700">{error}</div>}

      {/* Kết quả kiểm tra trùng phòng */}
{conflicts.length > 0 && (
  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
    <div className="mb-2 text-sm font-semibold text-rose-700">⚠️ Trùng phòng với lịch đã approve</div>
    <ul className="list-inside list-disc text-sm text-rose-800">
      {conflicts.map(m => (
        <li key={String(m._id)}>
          <span className="font-medium">{m.title}</span> — {new Date(m.startAt).toLocaleString()} → {new Date(m.endAt).toLocaleString()}
        </li>
      ))}
    </ul>
  </div>
)}

{/* Cảnh báo trùng NGƯỜI tham dự */}
{participantWarn && (
  participantWarn.hasConflicts ? (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-amber-800">
          👥 Cảnh báo trùng người tham dự
        </div>
        <div className="text-xs text-amber-700">
          Xác nhận tham gia: <b>{participantWarn.summary.HIGH}</b> · Chưa xác nhận, cuộc họp đã duyệt: <b>{participantWarn.summary.MEDIUM}</b> · Trùng lịch chưa duyệt: <b>{participantWarn.summary.LOW}</b>
        </div>
      </div>

      <div className="mt-1 space-y-2">
        {participantWarn.byUser.map(u => (
          <div key={u.userId} className="rounded border border-amber-200 bg-white p-2">
            <div className="mb-1 text-sm font-medium text-slate-800">
              {nameOf(u.userId)}
            </div>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              {u.conflicts.map(c => (
                <li key={c.meetingId} className="flex flex-wrap items-center gap-1">
                  <SeverityBadge severity={c.severity} />
                  <span className="font-medium">{c.title}</span>
                  <span className="text-slate-500">— {new Date(c.startAt).toLocaleString()} → {new Date(c.endAt).toLocaleString()}</span>
                  <span className="text-slate-400">({c.otherStatus}{c.response ? ` · ${c.response}` : ''})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
      ✅ Không phát hiện trùng người tham dự.
    </div>
  )
)}

      </div>
    </div>
  );
}
