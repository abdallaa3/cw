import { NextResponse } from "next/server";
import { clearSession, requireAdmin } from "@/lib/auth";
import { addAudit } from "@/lib/data";

export async function POST() {
  await requireAdmin();
  await addAudit("system", "delete", "auth", null, "تسجيل خروج المسؤول").catch(() => undefined);
  await clearSession();
  return NextResponse.json({ ok: true });
}
