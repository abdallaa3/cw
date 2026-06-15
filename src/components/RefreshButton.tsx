"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn-refresh" onClick={() => start(() => router.refresh())} disabled={pending}>
      <span style={{ display: "inline-block", animation: pending ? "spin .8s linear infinite" : undefined }}>↻</span>
      {pending ? "جاري..." : "تحديث"}
    </button>
  );
}
