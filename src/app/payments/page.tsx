import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { PaymentsView } from "@/components/views/PaymentsView";
import { listPayments, listStudents, getCashBalances } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [{ data: payments }, students, balances] = await Promise.all([
    listPayments(),
    listStudents(),
    getCashBalances(),
  ]);
  const studentOptions = students.map((s) => ({ id: s.id, name: s.name }));
  return (
    <Shell title={<>الدفعات</>} actions={<RefreshButton />}>
      <PaymentsView payments={payments} students={studentOptions} balances={balances} />
    </Shell>
  );
}
