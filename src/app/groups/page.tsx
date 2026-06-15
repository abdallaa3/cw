import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { GroupsView } from "@/components/views/GroupsView";
import { listGroups } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await listGroups();
  return (
    <Shell title={<>الجروبات</>} actions={<RefreshButton />}>
      <GroupsView groups={groups} />
    </Shell>
  );
}
