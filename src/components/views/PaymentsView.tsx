"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PaymentForm, type PaymentStudent } from "@/components/PaymentForm";
import { toast } from "@/components/toast";
import { deletePaymentAction } from "@/lib/actions";
import { PAYMENT_METHODS, RECEIVERS, TRANSACTION_TYPES, type CashBalances, type Payment } from "@/lib/types";
import { egp, METHOD_LABELS, methodLabel, formatDate, signedPaymentAmount, todayIso, TX_TYPE_LABELS } from "@/lib/utils";
import { writeXlsx } from "@/lib/xlsx";

// Color scheme per transaction type
const TX_COLOR: Record<string, string> = {
  payment: "rgba(63,185,80,.15)",
  refund: "rgba(247,129,102,.15)",
  adjustment: "rgba(210,153,34,.15)",
  cancelled: "rgba(139,148,158,.1)",
};
const TX_TEXT: Record<string, string> = {
  payment: "var(--accent2)",
  refund: "var(--warn)",
  adjustment: "var(--warn2)",
  cancelled: "var(--text2)",
};

export function PaymentsView({
  payments,
  students,
  balances,
}: {
  payments: Payment[];
  students: PaymentStudent[];
  balances: CashBalances;
}) {
  const router = useRouter();
  const [receivedBy, setReceivedBy] = useState("");
  const [method, setMethod] = useState("");
  const [txType, setTxType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (receivedBy && p.received_by !== receivedBy) return false;
        if (method && p.method !== method) return false;
        if (txType && p.transaction_type !== txType) return false;
        if (from && p.payment_date < from) return false;
        if (to && p.payment_date > to) return false;
        return true;
      }),
    [payments, receivedBy, method, txType, from, to],
  );

  // Net signed total (payments − refunds ± adjustments; cancelled = 0)
  const total = filtered.reduce(
    (sum, p) => sum + signedPaymentAmount(Number(p.amount), p.transaction_type, p.direction),
    0,
  );

  async function remove(p: Payment) {
    if (!confirm(`حذف ${TX_TYPE_LABELS[p.transaction_type] ?? "دفعة"} ${p.student_name ?? ""} (${egp(p.amount)})؟ سيتم حذف حركة الخزينة المرتبطة.`)) return;
    const res = await deletePaymentAction(p.id);
    if (res.ok) {
      toast("تم الحذف");
      router.refresh();
    } else toast(res.error, "error");
  }

  async function exportPayments() {
    try {
      const rows: (string | number)[][] = [
        ["id", "اسم الطالب", "الجروب", "النوع", "الاتجاه", "المبلغ", "الطريقة", "المستلم", "التاريخ", "ملاحظات"],
        ...filtered.map((p) => [
          p.id, p.student_name ?? "", p.group_number ?? "",
          TX_TYPE_LABELS[p.transaction_type] ?? p.transaction_type,
          p.direction ?? "",
          p.amount, methodLabel(p.method), p.received_by, p.payment_date, p.notes ?? "",
        ]),
      ];
      const blob = await writeXlsx([{ name: "المعاملات المالية", rows }]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments_${todayIso()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("تم تصدير المعاملات");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التصدير", "error");
    }
  }

  return (
    <>
      <div className="balance-chips">
        <span className="balance-chip m"><span className="lbl">رصيد محمد</span><span className="val">{egp(balances["محمد"])}</span></span>
        <span className="balance-chip a"><span className="lbl">رصيد عبدالله</span><span className="val">{egp(balances["عبدالله"])}</span></span>
      </div>

      <div className="toolbar">
        <select className="field" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}>
          <option value="">كل المستلمين</option>
          {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">كل الطرق</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </select>
        <select className="field" value={txType} onChange={(e) => setTxType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{TX_TYPE_LABELS[t]}</option>)}
        </select>
        <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="من تاريخ" />
        <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="إلى تاريخ" />
        <div className="spacer" />
        <span className={`badge ${total >= 0 ? "green" : ""}`} style={total < 0 ? { color: "var(--warn)" } : undefined}>
          الصافي: {egp(total)}
        </span>
        <button className="btn btn-success" onClick={exportPayments}>📥 تصدير</button>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>+ تسجيل دفعة</button>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState text="لا توجد معاملات" emoji="💰" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>الطالب</th><th>الجروب</th><th>النوع</th><th>المبلغ</th>
                <th>الطريقة</th><th>المستلم</th><th>التاريخ</th><th>إيصال</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const signed = signedPaymentAmount(Number(p.amount), p.transaction_type, p.direction);
                const isCancelled = p.transaction_type === "cancelled";
                return (
                  <tr key={p.id} style={isCancelled ? { opacity: 0.5 } : undefined}>
                    <td style={{ fontWeight: 600 }}>{p.student_name ?? "—"}</td>
                    <td className="muted">{p.group_number ?? "—"}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: TX_COLOR[p.transaction_type] ?? TX_COLOR.payment,
                          color: TX_TEXT[p.transaction_type] ?? TX_TEXT.payment,
                        }}
                      >
                        {TX_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}
                        {p.transaction_type === "adjustment" && p.direction
                          ? ` ${p.direction === "increase" ? "▲" : "▼"}`
                          : ""}
                      </span>
                    </td>
                    <td
                      style={{
                        color: signed > 0 ? "var(--accent2)" : signed < 0 ? "var(--warn)" : "var(--text2)",
                        fontWeight: 700,
                        textDecoration: isCancelled ? "line-through" : undefined,
                      }}
                    >
                      {signed > 0 ? "+" : signed < 0 ? "−" : ""}{egp(Math.abs(signed))}
                    </td>
                    <td><span className={`method-badge method-${p.method}`}>{methodLabel(p.method)}</span></td>
                    <td>
                      <span className={`receiver-badge ${p.received_by === "عبدالله" ? "receiver-abdallah" : "receiver-mohamed"}`}>
                        {p.received_by}
                      </span>
                    </td>
                    <td className="muted">{formatDate(p.payment_date)}</td>
                    <td>
                      {p.image_path
                        ? <a href={p.image_path} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>عرض</a>
                        : <span className="muted">—</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-outline btn-sm" onClick={() => { setEditing(p); setOpen(true); }}>تعديل</button>{" "}
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>حذف</button>
                    </td>
                  </tr>
                );
              })}
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
