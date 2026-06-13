import { NextResponse } from "next/server";
import { clearSession, requireAdmin } from "@/lib/auth";
import { addAudit } from "@/lib/data";

export async function POST() {
  await requireAdmin();
  await addAudit("Logout", "Auth", "Admin", "Admin logged out").catch(() => undefined);
  await clearSession();
  return NextResponse.json({ ok: true });
}
