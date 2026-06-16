"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { renewStudentAction } from "@/lib/actions";
import { getStoredUser } from "@/components/useCurrentUser";
import { PAYMENT_METHODS, RECEIVERS, type Group, type Student } from "@/lib/types";
import { egp, formatDate, METHOD_LABELS, todayIso } from "@/lib/utils";

type FormState = {
  total_amount: string;
  first_payment_amount: string;
  received_by: string;
  method: string;
  group_id: string;
  next_due_date: string;
  notes: string;
};

function statusLabel(s: Student): string {
  if (s.remaining_amount <= 0 && s.paid_amount > 0) return "مكتمل";
  if (s.paid_amount > 0) return "جزئي";
  return "لم يدفع";
}

// Renewal = archive the old student row (never deleted) + create a brand-new
// student row for the new subscription. Old payments/cashbook/receiver
// balances are never touched; the new first payment only ever increases a
// receiver's balance, it never decreases anything.
export function RenewStudentForm({
  student,
  groups,
  onClose,
}: {
  student: Student;
  groups: Group[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    total_amount: "",
    first_payment_amount: "",
    received_by: getStoredUser(),
    method: "cash",
    group_id: student.group_id ?? "",
    next_due_date: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const firstAmount = Number(form.first_payment_amount || 0);

  async function submit() {
    setError("");
    const total = Number(form.total_amount || 0);
    if (!(total > 0)) { setError("سعر الكورس / الإجمالي الجديد مطلوب"); return; }
    if (firstAmount > 0 && !RECEIVERS.includes(form.received_by as (typeof RECEIVERS)[number])) {
      setError("اختر مستلم الدفعة الأولى (محمد أو عبدالله)");
      return;
    }

    setSaving(true);
    const res = await renewStudentAction(student.id, {
      total_amount: total,
      first_payment_amount: firstAmount,
      received_by: form.received_by,
      method: form.method,
      group_id: form.group_id,
      next_due_date: form.next_due_date,
      notes: form.notes,
      payment_date: todayIso(),
    });
    setSaving(false);
    if (res.ok) {
      toast("تم تجديد الاشتراك — الطالب القديم مؤرشف والطالب الجديد نشط");
      onClose();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <Modal title={`تجديد اشتراك الطالب — ${student.name}`} onClose={onClose} width={620}>
      {error && <div className="form-error">{error}</div>}

      <div className="panel" style={{ marginBottom: 14, padding: "10px 14px" }}>
        <div className="section-title" style={{ marginBottom: 8 }}><span className="dot" /> بيانات الطالب الحالي (لن تتغيّر)</div>
        <div className="form-row" style={{ rowGap: 6 }}>
          <div className="muted" style={{ fontSize: ".85rem" }}>الاسم: <strong style={{ color: "var(--text)" }}>{student.name}</strong></div>
          <div className="muted" style={{ fontSize: ".85rem" }}>التليفون: <strong style={{ color: "var(--text)" }}>{student.phone || "—"}</strong></div>
        </div>
        <div className="form-row" style={{ rowGap: 6 }}>
          <div className="muted" style={{ fontSize: ".85rem" }}>الإجمالي الحالي: <strong style={{ color: "var(--text)" }}>{egp(student.total_amount)}</strong></div>
          <div className="muted" style={{ fontSize: ".85rem" }}>المدفوع الحالي: <strong style={{ color: "var(--accent2)" }}>{egp(student.paid_amount)}</strong></div>
        </div>
        <div className="form-row" style={{ rowGap: 6 }}>
          <div className="muted" style={{ fontSize: ".85rem" }}>المتبقي الحالي: <strong style={{ color: student.remaining_amount > 0 ? "var(--warn)" : "var(--text)" }}>{egp(student.remaining_amount)}</strong></div>
          <div className="muted" style={{ fontSize: ".85rem" }}>الجروب الحالي: <strong style={{ color: "var(--text)" }}>{student.group_number ?? "بدون جروب"}</strong></div>
        </div>
        <div className="muted" style={{ fontSize: ".85rem" }}>الحالة الحالية: <strong style={{ color: "var(--text)" }}>{statusLabel(student)}</strong></div>
      </div>

      <div className="muted" style={{ fontSize: ".82rem", marginBottom: 12 }}>
        سيتم أرشفة الطالب الحالي (بدون حذف) وإنشاء طالب جديد بنفس البيانات الشخصية باشتراك جديد. كل الدفعات والحركات القديمة تبقى كما هي.
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">سعر الكورس / الإجمالي الجديد *</label>
          <input className="form-control" type="text" inputMode="decimal" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">تاريخ استحقاق القسط القادم (اختياري)</label>
          <input className="form-control" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">الجروب الجديد (اختياري — افتراضياً نفس الجروب الحالي)</label>
        <select className="form-control" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
          <option value="">بدون جروب</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.group_number}</option>)}
        </select>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 10 }}><span className="dot green" /> الدفعة الأولى للاشتراك الجديد (اختياري)</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">مبلغ الدفعة الأولى</label>
            <input className="form-control" type="text" inputMode="decimal" value={form.first_payment_amount} onChange={(e) => setForm({ ...form, first_payment_amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">المستلم{firstAmount > 0 ? " *" : ""}</label>
            <select className="form-control" value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })}>
              {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">طريقة الدفع{firstAmount > 0 ? " *" : ""}</label>
          <select className="form-control" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
          </select>
        </div>
        {firstAmount > 0 && (
          <div className="muted" style={{ fontSize: ".8rem" }}>
            سيزداد رصيد {form.received_by} بمقدار {egp(firstAmount)} فقط — رصيد المستلم القديم لا يتأثر.
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">ملاحظات</label>
        <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="muted" style={{ fontSize: ".75rem", marginBottom: 12 }}>
        تاريخ التجديد: {formatDate(todayIso())}
      </div>

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "جاري التجديد..." : "تأكيد التجديد"}</button>
        <button className="btn btn-outline" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
