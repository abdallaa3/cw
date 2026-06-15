import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { ReportsView } from "@/components/views/ReportsView";
import { getDashboard, listPayments, listStudents } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [dashboard, students, { data: payments }] = await Promise.all([
    getDashboard(),
    listStudents(),
    listPayments(),
  ]);
  return (
    <Shell title={<>التقارير</>} actions={<RefreshButton />}>
      <ReportsView
        students={students}
        payments={payments}
        groupsSummary={dashboard.groups_summary}
        totals={{ collected: dashboard.total_collected, expected: dashboard.total_expected, remaining: dashboard.total_remaining }}
      />
    </Shell>
  );
}
