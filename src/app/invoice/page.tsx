import Link from "next/link";
import { InvoiceView } from "@/components/views/InvoiceView";
import { getStudent } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: studentId } = await searchParams;
  if (!studentId) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p>❌ لم يتم تحديد طالب</p>
        <Link className="btn btn-outline" href="/students">العودة للطلاب</Link>
      </div>
    );
  }
  const student = await getStudent(studentId);
  if (!student) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <p>❌ الطالب غير موجود</p>
        <Link className="btn btn-outline" href="/students">العودة للطلاب</Link>
      </div>
    );
  }
  return <InvoiceView student={student} />;
}
