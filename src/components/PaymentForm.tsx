"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { savePaymentAction, uploadPaymentImageAction } from "@/lib/actions";
import { getStoredUser } from "@/components/useCurrentUser";
import { PAYMENT_METHODS, RECEIVERS, type Payment } from "@/lib/types";
import { METHOD_LABELS, todayIso } from "@/lib/utils";

export type PaymentStudent = { id: string; name: string };

type FormState = {
  student_id: string;
  amount: string;
  method: string;
  received_by: string;
  payment_date: string;
  image_path: string;
  notes: string;
};

export function PaymentForm({
  students,
  preselectedStudentId,
  editing,
  onClose,
}: {
  students: PaymentStudent[];
  preselectedStudentId?: string;
  editing?: Payment | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    student_id: editing?.student_id ?? preselectedStudentId ?? "",
    amount: editing ? String(editing.amount) : "",
    method: editing?.method ?? "cash",
    received_by: editing?.received_by ?? getStoredUser(),
    payment_date: editing?.payment_date ?? todayIso(),
    image_path: editing?.image_path ?? "",
    notes: editing?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    const res = await uploadPaymentImageAction(fd);
    setUploading(false);
    if (res.ok) {
      const url = (res.data as { image_path: string }).image_path;
      setForm((f) => ({ ...f, image_path: url }));
      toast("تم رفع الصورة");
    } else {
      toast(res.error, "error");
    }
  }

  async function submit() {
    setSaving(true);
    setError("");
    const res = await savePaymentAction(editing?.id ?? null, { ...form, amount: Number(form.amount) });
    setSaving(false);
    if (res.ok) {
      toast(editing ? "تم تعديل الدفعة" : "تم تسجيل الدفعة");
      onClose();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  const preselectedName = students.find((s) => s.id === form.student_id)?.name;

  return (
    <Modal title={editing ? "تعديل دفعة" : "تسجيل دفعة"} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">الطالب</label>
        {preselectedStudentId && !editing ? (
          <input className="form-control" value={preselectedName ?? ""} disabled />
        ) : (
          <select className="form-control" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
            <option value="">— اختر الطالب —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">المبلغ</label>
          <input className="form-control" type="text" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">تاريخ الدفع</label>
          <input className="form-control" type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">طريقة الدفع</label>
          <select className="form-control" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">المستلم</label>
          <select className="form-control" value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })}>
            {RECEIVERS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">صورة الإيصال (اختياري)</label>
        <input
          ref={fileRef}
          className="form-control"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading && <div className="muted" style={{ fontSize: ".8rem", marginTop: 6 }}>جاري الرفع...</div>}
        {form.image_path && (
          <a href={form.image_path} target="_blank" rel="noreferrer" style={{ fontSize: ".8rem", color: "var(--accent)" }}>
            عرض الصورة المرفوعة
          </a>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">ملاحظات</label>
        <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="modal-actions">
        <button className="btn btn-success" onClick={submit} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</button>
        <button className="btn btn-outline" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}
