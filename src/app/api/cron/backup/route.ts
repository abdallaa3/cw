import { NextResponse } from "next/server";
import { createBackupAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

// Secured automatic backup endpoint (Vercel Cron or any external scheduler).
// Auth: checks Authorization: Bearer header against BACKUP_CRON_SECRET (custom)
// or CRON_SECRET (Vercel's built-in, sent automatically by Vercel Cron).
export async function GET(request: Request) {
  const secret = process.env.BACKUP_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "No cron secret configured (set BACKUP_CRON_SECRET or CRON_SECRET)" },
      { status: 500 },
    );
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await createBackupAction("auto");
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...(res.data as object) });
}
