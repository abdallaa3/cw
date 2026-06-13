import { NextResponse } from "next/server";
import { addAudit } from "@/lib/data";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();
  if (!verifyPassword(String(password || ""))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await createSession();
  await addAudit("Login", "Auth", "Admin", "Admin logged in").catch(() => undefined);
  return NextResponse.json({ ok: true });
}
