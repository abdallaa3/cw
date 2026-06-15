import { Shell } from "@/components/Shell";
import { RefreshButton } from "@/components/RefreshButton";
import { BackupsView } from "@/components/views/BackupsView";

export const dynamic = "force-dynamic";

export default function BackupsPage() {
  return (
    <Shell title={<>النسخ الاحتياطية</>} actions={<RefreshButton />}>
      <BackupsView />
    </Shell>
  );
}
