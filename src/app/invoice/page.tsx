import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { InvoiceView } from "@/components/views/InvoiceView";
import { InvoicePicker } from "@/components/views/InvoicePicker";
import { getStudent, listStudents } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; studentId?: string }>;
}) {
  const sp = await searchParams;
  const studentId = sp.student || sp.studentId;

  if (studentId) {
    const student = await getStudent(studentId);
    if (student) return <InvoiceView student={student} />;
  }

  const students = await listStudents();
  return (
    <Shell title={<>الفواتير</>} actions={<RefreshButton />}>
      <InvoicePicker students={students} notFound={!!studentId} />
    </Shell>
  );
}
