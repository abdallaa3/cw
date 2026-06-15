"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { savePaymentAction } from "@/lib/actions";
import { getStoredUser } from "@/components/useCurrentUser";
import { PAYMENT_METHODS, RECEIVERS } from "@/lib/types";
import { METHOD_LABELS, todayIso } from "@/lib/utils";

type TxMode = "refund" | "adjustment";

type FormState = {
  amount: string;
  direction: "increase" | "decrease";
  received_by: string;
  method: string;
  notes: string;
  payment_date: string;
};

export function AdjustmentForm({
  student,
  onClose,
}: {
  student: { id: string; name: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<TxMode>("adjustment");
  const [form, setForm] = useState<FormState>({
    amount: "",
    direction: "increase",
    received_by: getStoredUser(),
    method: "cash",
    notes: "",
    payment_date: todayIso(),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    const amount = Number(form.amount);
    if (!(amount > 0)) { setError("المبلغ مطلوب وأكبر من صفر"); return; }
    if (!form.notes.trim()) { setError("السبب / الملاحظة مطلوبة"); return; }

    setSaving(true);
    const res = await savePaymentAction(null, {
      student_id: student.id,
      amount,
      method: form.method,
      received_by: form.received_by,
      payment_date: form.payment_date,
      notes: form.notes.trim(),
      transaction_type: mode,
      direction: mode === "adjustment" ? form.direction : null,
    });
    setSaving(false);
    if (res.ok) {
      toast(mode === "refund" ? "تم تسجيل الاسترداد" : "تم تسجيل التعديل المالي");
      onClose();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  const isRefund = mode === "refund";
  const willIncrease = !isRefund && form.direction === "increase";
  const willDecrease = isRefund || form.direction === "decrease";

  return (
    <Modal
      title={`${isRefund ? "استرداد" : "تعديل مالي"} — ${student.name}`}
      onClose={onClose}
    >
      {error && <div className="form-error">{error}</div>}

      {/* Mode selector */}
      <div className="form-group">
        <label className="form-label">نوع العملية *</label>
        <div className="btn-group" style={{ marginTop: 4 }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === "adjustment" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setMode("adjustment")}
          >
            تعديل مالي
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === "refund" ? "btn-danger" : "btn-outline"}`}
            onClick={() => setMode("refund")}
          >
            استرداد
          </button>
        </div>
      </div>

      {/* Direction (adjustment only) */}
      {mode === "adjustment" && (
        <div className="form-group">
          <label className="form-label">الاتجاه *</label>
          <div className="btn-group" style={{ marginTop: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${form.direction === "increase" ? "btn-success" : "btn-outline"}`}
              onClick={() => setForm({ ...form, direction: "increase" })}
            >
              زيادة المدفوع ▲
            </button>
            <button
              type="button"
              className={`btn btn-sm ${form.direction === "decrease" ? "btn-danger" : "btn-outline"}`}
              onClick={() => setForm({ ...form, direction: "decrease" })}
            >
              خصم من المدفوع ▼
            </button>
          </div>
          <div className="muted" style={{ fontSize: ".8rem", marginTop: 6 }}>
            {form.direction === "increase"
              ? "▲ سيزداد المبلغ المدفوع للطالب ويزداد رصيد المستلم"
              : "▼ سينقص المبلغ المدفوع للطالب وينقص رصيد المستلم"}
          </div>
        </div>
      )}

      {isRefund && (
        <div className="muted" style={{ fontSize: ".8rem", marginBottom: 10, color: "var(--warn)" }}>
          ⚠ سيؤدي الاسترداد إلى خصم المبلغ من المدفوع للطالب ومن رصيد المستلم.
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">المبلغ (ج) *</label>
          <input
            className="form-control"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            style={{
              color: willIncrease ? "var(--accent2)" : willDecrease ? "var(--warn)" : undefined,
              fontWeight: 700,
            }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">التاريخ *</label>
          <input
            className="form-control"
            type="date"
            value={form.payment_date}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">المستلم *</label>
          <select
            className="form-control"
            value={form.received_by}
            onChange={(e) => setForm({ ...form, received_by: e.target.value })}
          >
            {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">طريقة الدفع *</label>
          <select
            className="form-control"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">السبب / الملاحظة * (مطلوب)</label>
        <textarea
          className="form-control"
          rows={2}
          placeholder="اذكر سبب التعديل أو الاسترداد..."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? "جاري الحفظ..." : isRefund ? "تأكيد الاسترداد" : "تأكيد التعديل"}
        </button>
        <button className="btn btn-outline" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
