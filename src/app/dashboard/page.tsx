import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatCard } from "@/components/StatCard";
import { RefreshButton } from "@/components/RefreshButton";
import { EmptyState } from "@/components/EmptyState";
import { getDashboard } from "@/lib/data";
import { egp, methodLabel, formatDate, formatTime, todayWeekday, STUDY_TYPE_LABELS, ACTION_LABELS, ENTITY_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  const collectRate = d.total_expected > 0 ? Math.round((d.total_collected / d.total_expected) * 100) : 0;

  return (
    <Shell title={<>لوحة التحكم</>} actions={<RefreshButton />}>
      <div className="stats-grid">
        <StatCard label="إجمالي المحصّل" value={d.total_collected} money color="green" icon="💰" sub={`${collectRate}% من المتوقع`} />
        <StatCard label="الإجمالي المتوقع" value={d.total_expected} money color="blue" icon="📊" />
        <StatCard label="المتبقي" value={d.total_remaining} money color="red" icon="⏳" />
        <StatCard label="عدد الطلاب" value={d.total_students} color="blue" icon="👨‍🎓" />
        <StatCard label="عدد الجروبات" value={d.total_groups} color="blue" icon="📚" />
        <StatCard label="عليهم متبقي" value={d.not_paid_students_count} color="yellow" icon="⚠️" />
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot" /> أرصدة الخزينة</div>
      </div>
      <div className="receivers-grid">
        <div className="receiver-card m">
          <div className="receiver-name">رصيد محمد</div>
          <div className="receiver-row"><span className="lbl">الرصيد الحالي</span><span className="val">{egp(d.cash_balances["محمد"])}</span></div>
        </div>
        <div className="receiver-card a">
          <div className="receiver-name">رصيد عبدالله</div>
          <div className="receiver-row"><span className="lbl">الرصيد الحالي</span><span className="val">{egp(d.cash_balances["عبدالله"])}</span></div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot green" /> مواعيد جروبات اليوم — {todayWeekday()}</div>
        <span className="badge">{d.today_schedule.length}</span>
      </div>
      <div className="table-wrap">
        {d.today_schedule.length === 0 ? (
          <EmptyState text="لا توجد جروبات اليوم" emoji="🗓️" />
        ) : (
          <table>
            <thead><tr><th>الجروب</th><th>النوع</th><th>الفرع / المنطقة</th><th>الميعاد</th><th>عدد الطلاب</th></tr></thead>
            <tbody>
              {d.today_schedule.map((g, i) => (
                <tr key={`${g.id}-${i}`}>
                  <td style={{ fontWeight: 700 }}>{g.group_number}</td>
                  <td><span className="badge">{STUDY_TYPE_LABELS[g.type] ?? g.type}</span></td>
                  <td className="muted">{g.branch || g.region}</td>
                  <td>{g.day} {formatTime(g.start_time)}{g.end_time ? ` - ${formatTime(g.end_time)}` : ""}</td>
                  <td>{g.students_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot" /> طلاب عليهم فلوس</div>
        <span className="badge">{d.owed_students.length}</span>
      </div>
      <div className="table-wrap">
        {d.owed_students.length === 0 ? (
          <EmptyState text="لا يوجد طلاب عليهم متبقي" emoji="✅" />
        ) : (
          <table>
            <thead><tr><th>الطالب</th><th>التليفون</th><th>الجروب</th><th>المتبقي</th><th>تاريخ الاستحقاق</th></tr></thead>
            <tbody>
              {d.owed_students.slice(0, 15).map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students`} style={{ color: "var(--accent)" }}>{s.name}</Link></td>
                  <td className="muted">{s.phone ?? "—"}</td>
                  <td>{s.group_number ?? <span className="badge yellow">بدون</span>}</td>
                  <td style={{ color: "var(--warn)", fontWeight: 700 }}>{egp(s.remaining_amount)}</td>
                  <td className="muted">{s.next_due_date ? formatDate(s.next_due_date) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot" /> طلاب بدون جروب</div>
        <span className="badge">{d.no_group_students.length}</span>
      </div>
      <div className="table-wrap">
        {d.no_group_students.length === 0 ? (
          <EmptyState text="كل الطلاب معيّنون لجروبات" emoji="👍" />
        ) : (
          <table>
            <thead><tr><th>الطالب</th><th>التليفون</th><th>النوع</th><th>المتبقي</th></tr></thead>
            <tbody>
              {d.no_group_students.slice(0, 15).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted">{s.phone ?? "—"}</td>
                  <td><span className="badge">{STUDY_TYPE_LABELS[s.study_type] ?? s.study_type}</span></td>
                  <td style={{ color: s.remaining_amount > 0 ? "var(--warn)" : "var(--text2)" }}>{egp(s.remaining_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot green" /> آخر الدفعات</div>
      </div>
      <div className="table-wrap">
        {d.recent_payments.length === 0 ? (
          <EmptyState text="لا توجد دفعات مسجّلة بعد" emoji="💸" />
        ) : (
          <table>
            <thead><tr><th>الطالب</th><th>المبلغ</th><th>الطريقة</th><th>المستلم</th><th>التاريخ</th></tr></thead>
            <tbody>
              {d.recent_payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.student_name ?? "—"}</td>
                  <td style={{ color: "var(--accent2)", fontWeight: 700 }}>{egp(p.amount)}</td>
                  <td><span className={`method-badge method-${p.method}`}>{methodLabel(p.method)}</span></td>
                  <td><span className={`receiver-badge ${p.received_by === "عبدالله" ? "receiver-abdallah" : "receiver-mohamed"}`}>{p.received_by}</span></td>
                  <td className="muted">{formatDate(p.payment_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot" /> آخر العمليات</div>
      </div>
      <div className="table-wrap">
        {d.recent_audits.length === 0 ? (
          <EmptyState text="لا توجد عمليات بعد" emoji="📝" />
        ) : (
          <table>
            <thead><tr><th>العملية</th><th>النوع</th><th>الوصف</th><th>التاريخ</th></tr></thead>
            <tbody>
              {d.recent_audits.map((a) => (
                <tr key={a.id}>
                  <td><span className="badge">{ACTION_LABELS[a.action] ?? a.action}</span></td>
                  <td className="muted">{ENTITY_LABELS[a.entity] ?? a.entity}</td>
                  <td>{a.description}</td>
                  <td className="muted">{formatDate(a.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
