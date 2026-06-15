"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import type { Student } from "@/lib/types";
import { egp, STUDY_TYPE_LABELS } from "@/lib/utils";

export function InvoicePicker({ students, notFound }: { students: Student[]; notFound?: boolean }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return students;
    return students.filter((st) => st.name.toLowerCase().includes(s) || (st.phone ?? "").includes(s) || (st.group_number ?? "").toLowerCase().includes(s));
  }, [students, q]);

  return (
    <>
      <div className="panel">
        <div className="section-title" style={{ marginBottom: 12 }}><span className="dot" /> إنشاء فاتورة طالب</div>
        <p className="muted" style={{ fontSize: ".86rem", marginBottom: 14 }}>
          ابحث عن الطالب ثم اضغط «عرض الفاتورة» لفتح فاتورة احترافية بشعار Code Wave مع إمكانية الطباعة وحفظ PDF.
        </p>
        {notFound && <div className="form-error" style={{ marginBottom: 12 }}>لم يتم العثور على الطالب المطلوب — اختر من القائمة.</div>}
        <input className="form-control" placeholder="بحث بالاسم أو التليفون أو الجروب..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot green" /> الطلاب</div>
        <span className="badge">{filtered.length}</span>
      </div>
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState text="لا يوجد طلاب مطابقون" emoji="🧾" />
        ) : (
          <table>
            <thead>
              <tr><th>الاسم</th><th>التليفون</th><th>النوع</th><th>الجروب</th><th>المتبقي</th><th>الفاتورة</th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="muted">{s.phone ?? "—"}</td>
                  <td><span className="badge">{STUDY_TYPE_LABELS[s.study_type] ?? s.study_type}</span></td>
                  <td>{s.group_number ?? <span className="muted">بدون</span>}</td>
                  <td style={{ color: s.remaining_amount > 0 ? "var(--warn)" : "var(--text2)" }}>{egp(s.remaining_amount)}</td>
                  <td><Link className="btn btn-primary btn-sm" href={`/invoice?student=${s.id}`}>عرض الفاتورة</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
