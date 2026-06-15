import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { CashbookView } from "@/components/views/CashbookView";
import { listCashbook, listStudents } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CashbookPage() {
  const [{ data, balances }, students] = await Promise.all([listCashbook(), listStudents()]);
  const studentOptions = students.map((s) => ({ id: s.id, name: s.name }));
  return (
    <Shell title={<>الخزينة</>} actions={<RefreshButton />}>
      <CashbookView entries={data} balances={balances} students={studentOptions} />
    </Shell>
  );
}
