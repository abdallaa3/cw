"use client";

import { writeXlsx } from "@/lib/xlsx";
import { toast } from "@/components/toast";
import type { GroupSummary, Payment, Student } from "@/lib/types";
import { egp, methodLabel, formatDate } from "@/lib/utils";

export function ReportsView({
  students,
  payments,
  groupsSummary,
  totals,
}: {
  students: Student[];
  payments: Payment[];
  groupsSummary: GroupSummary[];
  totals: { collected: number; expected: number; remaining: number };
}) {
  async function exportExcel() {
    try {
      const studentRows: (string | number)[][] = [
        ["الجروب", "الاسم", "التليفون", "الإجمالي", "مدفوع", "متبقي", "عدد الأقساط", "الحالة"],
        ...students.map((s) => [
          s.group_number ?? "",
          s.name,
          s.phone ?? "",
          s.total_amount,
          s.paid_amount,
          s.remaining_amount,
          s.installments,
          s.remaining_amount <= 0 && s.paid_amount > 0 ? "مكتمل" : s.paid_amount > 0 ? "جزئي" : "لم يدفع",
        ]),
      ];
      const paymentRows: (string | number)[][] = [
        ["الجروب", "اسم الطالب", "المبلغ", "التاريخ", "طريقة الدفع", "استلمه", "ملاحظات"],
        ...payments.map((p) => [
          p.group_number ?? "",
          p.student_name ?? "",
          p.amount,
          p.payment_date,
          methodLabel(p.method),
          p.received_by,
          p.notes ?? "",
        ]),
      ];
      const groupRows: (string | number)[][] = [
        ["الجروب", "المنطقة", "عدد الطلاب", "المتوقع", "المحصّل", "المتبقي", "نسبة التحصيل"],
        ...groupsSummary.map((g) => [
          g.group_number,
          g.region,
          g.students_count,
          g.total_expected,
          g.total_paid,
          g.total_remaining,
          g.total_expected > 0 ? `${Math.round((g.total_paid / g.total_expected) * 100)}%` : "0%",
        ]),
      ];
      const blob = await writeXlsx([
        { name: "الطلاب", rows: studentRows },
        { name: "الدفعات", rows: paymentRows },
        { name: "الجروبات", rows: groupRows },
      ]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave_academy_${formatDate(new Date().toISOString()).replace(/\//g, "")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("تم تصدير التقرير");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التصدير", "error");
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn btn-success" onClick={exportExcel}>📥 تصدير Excel</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card green"><div className="card-label">إجمالي المحصّل</div><div className="card-value">{egp(totals.collected)}</div></div>
        <div className="stat-card blue"><div className="card-label">الإجمالي المتوقع</div><div className="card-value">{egp(totals.expected)}</div></div>
        <div className="stat-card red"><div className="card-label">المتبقي</div><div className="card-value">{egp(totals.remaining)}</div></div>
      </div>

      <div className="section-title" style={{ marginBottom: 12 }}><span className="dot" /> التحصيل لكل جروب</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>الجروب</th><th>المنطقة</th><th>الطلاب</th><th>المتوقع</th><th>المحصّل</th><th>المتبقي</th><th>النسبة</th></tr>
          </thead>
          <tbody>
            {groupsSummary.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>لا توجد بيانات</td></tr>
            ) : (
              groupsSummary.map((g) => {
                const pct = g.total_expected > 0 ? Math.round((g.total_paid / g.total_expected) * 100) : 0;
                return (
                  <tr key={g.group_id}>
                    <td>{g.group_number}</td>
                    <td className="muted">{g.region}</td>
                    <td>{g.students_count}</td>
                    <td>{egp(g.total_expected)}</td>
                    <td style={{ color: "var(--accent2)" }}>{egp(g.total_paid)}</td>
                    <td style={{ color: g.total_remaining > 0 ? "var(--warn)" : "var(--text2)" }}>{egp(g.total_remaining)}</td>
                    <td><span className={`badge ${pct >= 100 ? "green" : pct > 0 ? "yellow" : "red"}`}>{pct}%</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
