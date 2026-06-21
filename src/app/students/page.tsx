import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { StudentsView } from "@/components/views/StudentsView";
import { listStudents, listGroups, getCashBalances } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  // Fetch every student (active + archived) — the Active/Archived/All toggle
  // in StudentsView filters client-side, defaulting to active.
  const [students, groups, balances] = await Promise.all([
    listStudents({ status: "all" }),
    listGroups(),
    getCashBalances(),
  ]);
  return (
    <Shell title={<>الطلاب</>} actions={<RefreshButton />}>
      <StudentsView students={students} groups={groups} balances={balances} />
    </Shell>
  );
}
