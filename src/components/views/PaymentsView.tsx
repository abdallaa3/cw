"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PaymentForm, type PaymentStudent } from "@/components/PaymentForm";
import { toast } from "@/components/toast";
import { deletePaymentAction } from "@/lib/actions";
import { PAYMENT_METHODS, RECEIVERS, type Payment } from "@/lib/types";
import { egp, METHOD_LABELS, methodLabel, formatDate } from "@/lib/utils";

export function PaymentsView({ payments, students }: { payments: Payment[]; students: PaymentStudent[] }) {
  const router = useRouter();
  const [receivedBy, setReceivedBy] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (receivedBy && p.received_by !== receivedBy) return false;
        if (method && p.method !== method) return false;
        if (from && p.payment_date < from) return false;
        if (to && p.payment_date > to) return false;
        return true;
      }),
    [payments, receivedBy, method, from, to],
  );
  const total = filtered.reduce((sum, p) => sum + Number(p.amount), 0);

  async function remove(p: Payment) {
    if (!confirm(`حذف دفعة ${p.student_name ?? ""} (${egp(p.amount)})؟ سيتم حذف حركة الخزينة المرتبطة.`)) return;
    const res = await deletePaymentAction(p.id);
    if (res.ok) {
      toast("تم حذف الدفعة");
      router.refresh();
    } else toast(res.error, "error");
  }

  return (
    <>
      <div className="toolbar">
        <select className="field" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}>
          <option value="">كل المستلمين</option>
          {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">كل الطرق</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </select>
        <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="من تاريخ" />
        <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="إلى تاريخ" />
        <div className="spacer" />
        <span className="badge green">الإجمالي: {egp(total)}</span>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>+ تسجيل دفعة</button>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState text="لا توجد دفعات" emoji="💰" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>الطالب</th><th>الجروب</th><th>المبلغ</th><th>الطريقة</th>
                <th>المستلم</th><th>التاريخ</th><th>إيصال</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.student_name ?? "—"}</td>
                  <td className="muted">{p.group_number ?? "—"}</td>
                  <td style={{ color: "var(--accent2)", fontWeight: 700 }}>{egp(p.amount)}</td>
                  <td><span className={`method-badge method-${p.method}`}>{methodLabel(p.method)}</span></td>
                  <td><span className={`receiver-badge ${p.received_by === "عبدالله" ? "receiver-abdallah" : "receiver-mohamed"}`}>{p.received_by}</span></td>
                  <td className="muted">{formatDate(p.payment_date)}</td>
                  <td>
                    {p.image_path ? (
                      <a href={p.image_path} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>عرض</a>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setEditing(p); setOpen(true); }}>تعديل</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <PaymentForm students={students} editing={editing} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
