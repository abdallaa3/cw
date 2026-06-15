import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { StudentsView } from "@/components/views/StudentsView";
import { listStudents, listGroups } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const [students, groups] = await Promise.all([listStudents(), listGroups()]);
  return (
    <Shell title={<>الطلاب</>} actions={<RefreshButton />}>
      <StudentsView students={students} groups={groups} />
    </Shell>
  );
}
