import { NextResponse } from "next/server";
import { createBackupAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

// Secured automatic backup endpoint (for Vercel Cron or any scheduler).
// Authorize with either `Authorization: Bearer <BACKUP_CRON_SECRET>` or
// `?secret=<BACKUP_CRON_SECRET>`. The secret is server-side only.
export async function GET(request: Request) {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "BACKUP_CRON_SECRET is not configured" }, { status: 500 });
  }
  const url = new URL(request.url);
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await createBackupAction();
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...(res.data as object) });
}
