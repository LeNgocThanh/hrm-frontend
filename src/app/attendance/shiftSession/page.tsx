"use client";

import { useEffect, useState } from "react";

type ShiftSession = {
  code: string;
  start: string;
  end: string;
  required: boolean;
  graceInMins?: number;
  graceOutMins?: number;
  breakMinutes?: number;
  maxCheckInEarlyMins?: number;
  maxCheckOutLateMins?: number;
};

type ShiftSessionForm = {
  code: string;
  start: string;
  end: string;
  required: boolean;
  graceInMins?: number | "";
  graceOutMins?: number | "";
  breakMinutes?: number | "";
  maxCheckInEarlyMins?: number | "";
  maxCheckOutLateMins?: number | "";
};

const initialForm: ShiftSessionForm = {
  code: "",
  start: "",
  end: "",
  required: true,
  graceInMins: "",
  graceOutMins: "",
  breakMinutes: "",
  maxCheckInEarlyMins: "",
  maxCheckOutLateMins: "",
};

type ModalMode = "create" | "edit" | null;

export default function ShiftSessionsPage() {
  const [list, setList] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<ShiftSessionForm>(initialForm);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  // Load list
  const fetchList = async () => {
    try {
      setLoading(true);
      setListError(null);
      const res = await fetch(`${apiBase}/shift-sessions`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.message ?? `Không tải được danh sách (HTTP ${res.status})`
        );
      }
      const data = (await res.json()) as ShiftSession[];
      setList(data);
    } catch (err: any) {
      setListError(err.message ?? "Lỗi khi tải danh sách ca làm việc.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- FORM HANDLERS -----

  const openCreateModal = () => {
    setModalMode("create");
    setEditingCode(null);
    setForm(initialForm);
    setFormError(null);
    setFormSuccess(null);
  };

  const openEditModal = (shift: ShiftSession) => {
    setModalMode("edit");
    setEditingCode(shift.code);
    setForm({
      code: shift.code,
      start: shift.start,
      end: shift.end,
      required: shift.required,
      graceInMins:
        typeof shift.graceInMins === "number" ? shift.graceInMins : "",
      graceOutMins:
        typeof shift.graceOutMins === "number" ? shift.graceOutMins : "",
      breakMinutes:
        typeof shift.breakMinutes === "number" ? shift.breakMinutes : "",
      maxCheckInEarlyMins:
        typeof shift.maxCheckInEarlyMins === "number"
          ? shift.maxCheckInEarlyMins
          : "",
      maxCheckOutLateMins:
        typeof shift.maxCheckOutLateMins === "number"
          ? shift.maxCheckOutLateMins
          : "",
    });
    setFormError(null);
    setFormSuccess(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingCode(null);
    setForm(initialForm);
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(false);
  };

  const handleChange =
    (field: keyof ShiftSessionForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;

      if (
        [
          "graceInMins",
          "graceOutMins",
          "breakMinutes",
          "maxCheckInEarlyMins",
          "maxCheckOutLateMins",
        ].includes(field as string)
      ) {
        if (value === "") {
          setForm((prev) => ({ ...prev, [field]: "" }));
        } else {
          const n = Number(value);
          setForm((prev) => ({
            ...prev,
            [field]: Number.isNaN(n) ? "" : n,
          }));
        }
      } else {
        setForm((prev) => ({ ...prev, [field]: value as any }));
      }
    };

  const validateForm = (): string | null => {
    if (!form.code.trim()) return "Mã ca (code) không được để trống.";
    if (!form.start) return "Giờ bắt đầu (start) không được để trống.";
    if (!form.end) return "Giờ kết thúc (end) không được để trống.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const msg = validateForm();
    if (msg) {
      setFormError(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        code: form.code.trim(),
        start: form.start,
        end: form.end,
        required: form.required,
      };

      if (form.graceInMins !== "" && form.graceInMins != null)
        payload.graceInMins = Number(form.graceInMins);
      if (form.graceOutMins !== "" && form.graceOutMins != null)
        payload.graceOutMins = Number(form.graceOutMins);
      if (form.breakMinutes !== "" && form.breakMinutes != null)
        payload.breakMinutes = Number(form.breakMinutes);
      if (form.maxCheckInEarlyMins !== "" && form.maxCheckInEarlyMins != null)
        payload.maxCheckInEarlyMins = Number(form.maxCheckInEarlyMins);
      if (form.maxCheckOutLateMins !== "" && form.maxCheckOutLateMins != null)
        payload.maxCheckOutLateMins = Number(form.maxCheckOutLateMins);

      let url = `${apiBase}/shift-sessions`;
      let method = "POST";

      if (modalMode === "edit" && editingCode) {
        url = `${apiBase}/shift-sessions/${encodeURIComponent(editingCode)}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.message ??
            `${modalMode === "edit" ? "Cập nhật" : "Tạo"} ca làm việc thất bại (HTTP ${
              res.status
            }).`
        );
      }

      setFormSuccess(
        modalMode === "edit"
          ? "Cập nhật ca làm việc thành công."
          : "Tạo ca làm việc thành công."
      );
      await fetchList(); // reload danh sách
      closeModal();
    } catch (err: any) {
      setFormError(err.message ?? "Có lỗi xảy ra khi lưu ca làm việc.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (code: string) => {
    const ok = window.confirm(
      `Bạn có chắc muốn xoá ca "${code}"? Hành động này không thể hoàn tác.`
    );
    if (!ok) return;

    try {
      const res = await fetch(
        `${apiBase}/shift-sessions/${encodeURIComponent(code)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.message ?? `Xoá ca làm việc thất bại (HTTP ${res.status}).`
        );
      }
      setList((prev) => prev.filter((s) => s.code !== code));
    } catch (err: any) {
      alert(err.message ?? "Có lỗi xảy ra khi xoá ca.");
    }
  };

  // ----- UI -----

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Quản lý ShiftSession (ca làm việc)
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách các loại ca làm việc và tham số tính công.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <span className="text-lg leading-none">＋</span>
            <span>Thêm mới</span>
          </button>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {listError && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {listError}
            </div>
          )}

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
              </div>
            )}

            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Mã ca
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Giờ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tính công
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tham số
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {list.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Chưa có ca làm việc nào. Nhấn{" "}
                      <span className="font-semibold">“Thêm mới”</span> để tạo.
                    </td>
                  </tr>
                ) : (
                  list.map((s) => (
                    <tr key={s.code}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                        {s.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                        {s.start} – {s.end}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            s.required
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                              : "bg-slate-50 text-slate-600 ring-1 ring-slate-100"
                          }`}
                        >
                          {s.required ? "Có tính công" : "Không tính công"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {typeof s.graceInMins === "number" && (
                            <span>Trễ: {s.graceInMins}′</span>
                          )}
                          {typeof s.graceOutMins === "number" && (
                            <span>Sớm: {s.graceOutMins}′</span>
                          )}
                          {typeof s.breakMinutes === "number" && (
                            <span>Nghỉ: {s.breakMinutes}′</span>
                          )}
                          {typeof s.maxCheckInEarlyMins === "number" && (
                            <span>Vào sớm ≤ {s.maxCheckInEarlyMins}′</span>
                          )}
                          {typeof s.maxCheckOutLateMins === "number" && (
                            <span>Ra trễ ≤ {s.maxCheckOutLateMins}′</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(s)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(s.code)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {modalMode && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <h2 className="text-base font-semibold text-slate-800">
                  {modalMode === "create"
                    ? "Thêm ShiftSession mới"
                    : `Sửa ShiftSession: ${editingCode}`}
                </h2>
                <button
                  onClick={closeModal}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
                {formError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {formSuccess}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Mã ca <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={handleChange("code")}
                      placeholder="VD: CaSang_1, CaDem_OV"
                      disabled={modalMode === "edit"} // khoá mã ca khi sửa
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      id="required"
                      type="checkbox"
                      checked={form.required}
                      onChange={handleChange("required")}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label
                      htmlFor="required"
                      className="text-xs font-medium text-slate-700"
                    >
                      Tính công ca này
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Giờ bắt đầu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={form.start}
                      onChange={handleChange("start")}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Giờ kết thúc <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={form.end}
                      onChange={handleChange("end")}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      Nếu kết thúc &lt; bắt đầu thì hiểu là ca gối ngày (qua
                      0h).
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Cho phép vào trễ (phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.graceInMins}
                      onChange={handleChange("graceInMins")}
                      placeholder="VD: 5"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Cho phép về sớm (phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.graceOutMins}
                      onChange={handleChange("graceOutMins")}
                      placeholder="VD: 5"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Nghỉ giữa ca (phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.breakMinutes}
                      onChange={handleChange("breakMinutes")}
                      placeholder="VD: 30"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Vào sớm tối đa (phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.maxCheckInEarlyMins}
                      onChange={handleChange("maxCheckInEarlyMins")}
                      placeholder="VD: 60"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Ra trễ tối đa (phút)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.maxCheckOutLateMins}
                      onChange={handleChange("maxCheckOutLateMins")}
                      placeholder="VD: 120"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? "Đang lưu..."
                      : modalMode === "edit"
                      ? "Lưu thay đổi"
                      : "Tạo mới"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
