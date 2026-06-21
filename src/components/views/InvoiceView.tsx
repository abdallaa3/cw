"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { Student } from "@/lib/types";
import { methodLabel, STUDY_TYPE_LABELS, ONLINE_TYPE_LABELS } from "@/lib/utils";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
}
const fmtMoney = (n: number) => Number(n || 0).toLocaleString("en-US");

export function InvoiceView({ student }: { student: Student }) {
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const payments = [...(student.payments ?? [])].sort((a, b) => (a.payment_date || "").localeCompare(b.payment_date || ""));
  const invNo = `INV-${student.id.slice(0, 8).toUpperCase()}`;
  const today = new Date();
  const todayFmt = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const studyLabel = STUDY_TYPE_LABELS[student.study_type] ?? student.study_type ?? "—";

  async function savePDF() {
    const el = invoiceRef.current;
    if (!el) return;
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const ratio = pageW / canvas.width;
    pdf.addImage(img, "PNG", 0, 20, pageW, canvas.height * ratio);
    pdf.save(`Invoice-${student.name}.pdf`);
  }

  let runRemain = student.total_amount;

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar">
        <span style={{ color: "#9ca3af", fontSize: ".85rem" }}>فاتورة:</span>
        <strong>{student.name}</strong>
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-success btn-sm" onClick={savePDF}>💾 حفظ PDF</button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ طباعة</button>
          <button className="btn btn-outline btn-sm" onClick={() => router.back()}>← رجوع</button>
        </div>
      </div>

      <div className="invoice-card" ref={invoiceRef}>
        <div className="inv-accent" />
        <div className="inv-body">
          <div className="inv-header">
            <div>
              <div className="inv-title">فاتورة</div>
              <div style={{ fontSize: ".8rem", color: "#9ca3af", marginTop: 2 }}>{invNo} &nbsp;|&nbsp; {todayFmt}</div>
            </div>
            <div className="inv-logo">
              {/* Plain <img> instead of next/image — avoids print/PDF cropping issues */}
              <img src="/codewave-logo.png" alt="Code Wave" className="invoice-logo" />
            </div>
          </div>
          <hr className="inv-hr" />
          <div className="inv-info">
            <div className="info-row"><span className="info-label">اسم الطالب:</span><span className="info-val">{student.name}</span></div>
            <div className="info-row"><span className="info-label">رقم التليفون:</span><span className="info-val">{student.phone || "—"}</span></div>
            <div className="info-row"><span className="info-label">السن:</span><span className="info-val">{student.age ?? "—"}</span></div>
            <div className="info-row"><span className="info-label">نوع الدراسة:</span><span className="info-val">{studyLabel}{student.study_type === "online" && student.online_type ? ` — ${ONLINE_TYPE_LABELS[student.online_type] ?? ""}` : ""}</span></div>
            {student.study_type === "offline" ? (
              <div className="info-row"><span className="info-label">الفرع:</span><span className="info-val">{student.branch || student.region || "—"}</span></div>
            ) : null}
            <div className="info-row"><span className="info-label">الجروب:</span><span className="info-val">{student.group_number || "بدون جروب"}</span></div>
            <div className="info-row"><span className="info-label">تاريخ استحقاق القسط القادم:</span><span className="info-val">{fmtDate(student.next_due_date)}</span></div>
          </div>
          <table className="inv-table">
            <thead>
              <tr>
                <th>القسط</th><th>التاريخ</th><th>الطريقة</th><th>ملاحظات</th><th>المبلغ</th><th>المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: 16 }}>لا توجد دفعات مسجلة</td></tr>
              ) : (
                payments.map((p, i) => {
                  runRemain -= p.amount;
                  return (
                    <tr key={p.id}>
                      <td>قسط {i + 1}</td>
                      <td>{fmtDate(p.payment_date)}</td>
                      <td>{methodLabel(p.method)}</td>
                      <td style={{ color: "#6b7280" }}>{p.notes || "—"}</td>
                      <td style={{ fontWeight: 700, color: "#16a34a" }}>{fmtMoney(p.amount)}</td>
                      <td style={{ fontWeight: 700, color: runRemain > 0 ? "#dc2626" : "#16a34a" }}>{fmtMoney(runRemain)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="inv-totals">
            <div className="tot-row"><span>الإجمالي</span><span>{fmtMoney(student.total_amount)} ج</span></div>
            <div className="tot-row"><span>المدفوع</span><span style={{ color: "#16a34a" }}>{fmtMoney(student.paid_amount)} ج</span></div>
            <div className="tot-row grand"><span>المتبقي</span><span style={{ color: student.remaining_amount > 0 ? "#dc2626" : "#16a34a" }}>{fmtMoney(student.remaining_amount)} ج</span></div>
          </div>
          <div className="invoice-terms" dir="rtl">
            <div className="invoice-terms-title">الشروط والأحكام:</div>
            <ul className="invoice-terms-list">
              <li>في حالة غياب الطالب عن 3 محاضرات دون إخطار مسبق للإدارة، يحق للأكاديمية إيقاف أو إلغاء الاشتراك وفقًا لسياسة الحضور.</li>
              <li>المبالغ المدفوعة غير قابلة للاسترداد بعد بدء الكورس فعليًا.</li>
              <li>بسداد الدفعة، يقر ولي الأمر بالموافقة على سياسة الحضور والاسترداد الخاصة بالأكاديمية.</li>
            </ul>
          </div>
          <div className="inv-footer">شكراً لتعاملكم مع Code Wave Academy</div>
        </div>
      </div>
    </div>
  );
}
