import { Shell } from "@/components/Shell";
import { StatCard } from "@/components/StatCard";
import { RefreshButton } from "@/components/RefreshButton";
import { EmptyState } from "@/components/EmptyState";
import { getDashboard } from "@/lib/data";
import { egp, methodLabel, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  const collectRate = d.total_expected > 0 ? Math.round((d.total_collected / d.total_expected) * 100) : 0;
  const byReceiver = (name: string) => d.receivers_summary.find((r) => r.received_by === name);
  const mohamed = byReceiver("محمد");
  const abdallah = byReceiver("عبدالله");

  return (
    <Shell title={<>لوحة التحكم</>} actions={<RefreshButton />}>
      <div className="stats-grid">
        <StatCard label="إجمالي المحصّل" value={d.total_collected} money color="green" icon="💰" sub={`${collectRate}% من المتوقع`} />
        <StatCard label="الإجمالي المتوقع" value={d.total_expected} money color="blue" icon="📊" />
        <StatCard label="المتبقي" value={d.total_remaining} money color="red" icon="⏳" />
        <StatCard label="عدد الطلاب" value={d.total_students} color="blue" icon="👨‍🎓" />
        <StatCard label="دافعين بالكامل" value={d.paid_students_count} color="green" icon="✅" />
        <StatCard label="عليهم متبقي" value={d.not_paid_students_count} color="yellow" icon="⚠️" />
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot" /> ملخص المستلمين</div>
      </div>
      <div className="receivers-grid">
        <div className="receiver-card m">
          <div className="receiver-name">محمد</div>
          <div className="receiver-row"><span className="lbl">إجمالي المحصّل</span><span className="val">{egp(mohamed?.total ?? 0)}</span></div>
          <div className="receiver-row"><span className="lbl">عدد الدفعات</span><span className="val">{mohamed?.count ?? 0}</span></div>
        </div>
        <div className="receiver-card a">
          <div className="receiver-name">عبدالله</div>
          <div className="receiver-row"><span className="lbl">إجمالي المحصّل</span><span className="val">{egp(abdallah?.total ?? 0)}</span></div>
          <div className="receiver-row"><span className="lbl">عدد الدفعات</span><span className="val">{abdallah?.count ?? 0}</span></div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot green" /> طرق الدفع</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>الطريقة</th><th>الإجمالي</th><th>عدد الدفعات</th></tr></thead>
          <tbody>
            {d.methods_summary.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>لا توجد دفعات بعد</td></tr>
            ) : (
              d.methods_summary.map((m) => (
                <tr key={m.method}>
                  <td><span className={`method-badge method-${m.method}`}>{methodLabel(m.method)}</span></td>
                  <td>{egp(m.total)}</td>
                  <td className="muted">{m.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot" /> ملخص الجروبات</div>
        <span className="badge">{d.groups_summary.length} جروب</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>الجروب</th><th>المنطقة</th><th>الطلاب</th><th>المتوقع</th><th>المحصّل</th><th>المتبقي</th><th>نسبة التحصيل</th></tr></thead>
          <tbody>
            {d.groups_summary.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>لا توجد جروبات بعد</td></tr>
            ) : (
              d.groups_summary.map((g) => {
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
    </Shell>
  );
}
