import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { AuditLogView } from "@/components/views/AuditLogView";
import { listAuditLogs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const logs = await listAuditLogs();
  return (
    <Shell title={<>سجل العمليات</>} actions={<RefreshButton />}>
      <AuditLogView logs={logs} />
    </Shell>
  );
}
