"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/toast";
import { saveCashEntryAction, deleteCashEntryAction } from "@/lib/actions";
import { getStoredUser } from "@/components/useCurrentUser";
import { RECEIVERS, type CashBalances, type CashEntry } from "@/lib/types";
import { egp, formatDate, ENTRY_TYPE_LABELS, todayIso } from "@/lib/utils";
import { writeXlsx } from "@/lib/xlsx";
import type { PaymentStudent } from "@/components/PaymentForm";

type FormState = {
  owner: string;
  entry_type: string;
  amount: string;
  notes: string;
  entry_date: string;
  linked_student_id: string;
};

export function CashbookView({
  entries,
  balances,
  students,
}: {
  entries: CashEntry[];
  balances: CashBalances;
  students: PaymentStudent[];
}) {
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashEntry | null>(null);
  const [form, setForm] = useState<FormState>({
    owner: getStoredUser(),
    entry_type: "out",
    amount: "",
    notes: "",
    entry_date: todayIso(),
    linked_student_id: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => entries.filter((e) => (!owner || e.owner === owner) && (!type || e.entry_type === type)),
    [entries, owner, type],
  );

  // running balance per filtered list (immutable reduce, no reassignment)
  const rows = useMemo(
    () =>
      filtered.reduce<{ entry: CashEntry; running: number }[]>((acc, e) => {
        const prev = acc.length === 0 ? 0 : acc[acc.length - 1].running;
        const delta = e.entry_type === "in" ? Number(e.amount) : -Number(e.amount);
        return [...acc, { entry: e, running: prev + delta }];
      }, []),
    [filtered],
  );

  function openCreate() {
    setEditing(null);
    setForm({ owner: getStoredUser(), entry_type: "out", amount: "", notes: "", entry_date: todayIso(), linked_student_id: "" });
    setError("");
    setOpen(true);
  }
  function openEdit(e: CashEntry) {
    setEditing(e);
    setForm({
      owner: e.owner,
      entry_type: e.entry_type,
      amount: String(e.amount),
      notes: e.notes ?? "",
      entry_date: e.entry_date,
      linked_student_id: e.linked_student_id ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError("");
    const res = await saveCashEntryAction(editing?.id ?? null, { ...form, amount: Number(form.amount || 0) });
    setSaving(false);
    if (res.ok) {
      toast(editing ? "تم تعديل الحركة" : "تم إضافة الحركة");
      setOpen(false);
      router.refresh();
    } else setError(res.error);
  }

  async function remove(e: CashEntry) {
    if (e.linked_payment_id) {
      toast("هذه الحركة مرتبطة بدفعة طالب، احذف الدفعة من صفحة الدفعات", "error");
      return;
    }
    if (!confirm(`حذف حركة ${e.owner} (${egp(e.amount)})؟`)) return;
    const res = await deleteCashEntryAction(e.id);
    if (res.ok) {
      toast("تم حذف الحركة");
      router.refresh();
    } else toast(res.error, "error");
  }

  async function exportCashbook() {
    try {
      const data: (string | number)[][] = [
        ["id", "الشخص", "النوع", "المبلغ", "التاريخ", "ملاحظات", "طالب مرتبط", "مرتبطة بدفعة"],
        ...filtered.map((e) => [
          e.id, e.owner, ENTRY_TYPE_LABELS[e.entry_type], e.amount, e.entry_date,
          e.notes ?? "", e.linked_student_name ?? "", e.linked_payment_id ? "نعم" : "لا",
        ]),
      ];
      const blob = await writeXlsx([{ name: "الخزينة", rows: data }]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cashbook_${todayIso()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("تم تصدير الخزينة");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التصدير", "error");
    }
  }

  return (
    <>
      <div className="receivers-grid">
        <div className="receiver-card m">
          <div className="receiver-name">رصيد محمد</div>
          <div className="receiver-row">
            <span className="lbl">الرصيد الحالي</span>
            <span className="val">{egp(balances["محمد"])}</span>
          </div>
        </div>
        <div className="receiver-card a">
          <div className="receiver-name">رصيد عبدالله</div>
          <div className="receiver-row">
            <span className="lbl">الرصيد الحالي</span>
            <span className="val">{egp(balances["عبدالله"])}</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">الكل</option>
          {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">دخل ومصروف</option>
          <option value="in">دخل فقط</option>
          <option value="out">مصروف فقط</option>
        </select>
        <div className="spacer" />
        <button className="btn btn-success" onClick={exportCashbook}>📥 تصدير</button>
        <button className="btn btn-primary" onClick={openCreate}>+ حركة خزينة</button>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <EmptyState text="لا توجد حركات خزينة" emoji="🏦" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>الشخص</th><th>النوع</th><th>المبلغ</th><th>الرصيد المتحرك</th>
                <th>ملاحظات</th><th>طالب مرتبط</th><th>التاريخ</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry: e, running }) => (
                <tr key={e.id}>
                  <td>{e.owner}</td>
                  <td>
                    <span className="badge" style={{ background: e.entry_type === "in" ? "rgba(63,185,80,.15)" : "rgba(247,129,102,.15)", color: e.entry_type === "in" ? "var(--accent2)" : "var(--warn)" }}>
                      {ENTRY_TYPE_LABELS[e.entry_type]}
                    </span>
                  </td>
                  <td style={{ color: e.entry_type === "in" ? "var(--accent2)" : "var(--warn)", fontWeight: 700 }}>
                    {e.entry_type === "in" ? "+" : "−"}{egp(e.amount)}
                  </td>
                  <td style={{ color: running >= 0 ? "var(--text)" : "var(--warn)" }}>{egp(running)}</td>
                  <td className="muted">{e.notes ?? "—"}</td>
                  <td className="muted">{e.linked_student_name ?? "—"}</td>
                  <td className="muted">{formatDate(e.entry_date)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {e.linked_payment_id ? (
                      <span className="muted" style={{ fontSize: ".78rem" }}>مرتبطة بدفعة</span>
                    ) : (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>تعديل</button>{" "}
                        <button className="btn btn-danger btn-sm" onClick={() => remove(e)}>حذف</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={editing ? "تعديل حركة خزينة" : "حركة خزينة جديدة"} onClose={() => setOpen(false)}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">الشخص</label>
              <select className="form-control" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>
                {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">النوع</label>
              <select className="form-control" value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
                <option value="out">مصروف</option>
                <option value="in">دخل</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">المبلغ</label>
              <input className="form-control" type="text" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">التاريخ</label>
              <input className="form-control" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">طالب مرتبط (اختياري)</label>
            <select className="form-control" value={form.linked_student_id} onChange={(e) => setForm({ ...form, linked_student_id: e.target.value })}>
              <option value="">بدون</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ملاحظات</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</button>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </>
  );
}
