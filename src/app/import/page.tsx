import { Shell } from "@/components/Shell";
import { ImportView } from "@/components/views/ImportView";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <Shell title={<>استيراد Excel</>}>
      <ImportView />
    </Shell>
  );
}
