"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/toast";
import { getStudentPaymentsAction } from "@/lib/actions";
import { type Payment, type Student } from "@/lib/types";
import { egp, formatDate, methodLabel, signedPaymentAmount, TX_TYPE_LABELS } from "@/lib/utils";

export function StudentPaymentsModal({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentPaymentsAction(student.id).then((res) => {
      setLoading(false);
      if (res.ok) setPayments(res.data as Payment[]);
      else toast(res.error as string, "error");
    });
  }, [student.id]);

  const statusBadge = () => {
    if (student.remaining_amount <= 0 && student.paid_amount > 0)
      return <span className="badge green">مكتمل</span>;
    if (student.paid_amount > 0)
      return <span className="badge yellow">جزئي</span>;
    return <span className="badge red">لم يدفع</span>;
  };

  return (
    <Modal title={`تتبع دفعات — ${student.name}`} onClose={onClose} width={680}>
      <div className="tracking-summary">
        <div className="tracking-row"><span>الاسم</span><strong>{student.name}</strong></div>
        {student.phone && (
          <div className="tracking-row"><span>التليفون</span><strong>{student.phone}</strong></div>
        )}
        {student.group_number && (
          <div className="tracking-row"><span>الجروب</span><strong>{student.group_number}</strong></div>
        )}
        <div className="tracking-row">
          <span>الإجمالي</span><strong>{egp(student.total_amount)}</strong>
        </div>
        <div className="tracking-row">
          <span>المدفوع</span>
          <strong style={{ color: "var(--accent2)" }}>{egp(student.paid_amount)}</strong>
        </div>
        <div className="tracking-row">
          <span>المتبقي</span>
          <strong style={{ color: student.remaining_amount > 0 ? "var(--warn)" : "var(--text2)" }}>
            {egp(student.remaining_amount)}
          </strong>
        </div>
        {student.next_due_date && (
          <div className="tracking-row">
            <span>تاريخ الاستحقاق</span>
            <strong>{formatDate(student.next_due_date)}</strong>
          </div>
        )}
        <div className="tracking-row"><span>الحالة</span><strong>{statusBadge()}</strong></div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "14px 0" }} />

      {loading ? (
        <div className="muted" style={{ textAlign: "center", padding: "24px 0" }}>جاري التحميل...</div>
      ) : !payments || payments.length === 0 ? (
        <div className="muted" style={{ textAlign: "center", padding: "24px 0" }}>
          لا توجد دفعات مسجلة لهذا الطالب
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 0 }}>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>المستلم</th>
                <th>الطريقة</th>
                <th>النوع</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const signed = signedPaymentAmount(Number(p.amount), p.transaction_type, p.direction);
                return (
                  <tr key={p.id}>
                    <td className="muted">{formatDate(p.payment_date)}</td>
                    <td style={{
                      fontWeight: 700,
                      color: signed > 0 ? "var(--accent2)" : signed < 0 ? "var(--warn)" : "var(--text2)",
                    }}>
                      {signed > 0 ? "+" : signed < 0 ? "−" : ""}{egp(Math.abs(signed))}
                    </td>
                    <td>{p.received_by}</td>
                    <td>
                      <span className={`method-badge method-${p.method}`}>{methodLabel(p.method)}</span>
                    </td>
                    <td>
                      <span className="badge">{TX_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}</span>
                    </td>
                    <td className="muted">{p.notes ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 14 }}>
        <button className="btn btn-outline" onClick={onClose}>إغلاق</button>
      </div>
    </Modal>
  );
}
