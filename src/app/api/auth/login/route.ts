import { NextResponse } from "next/server";
import { addAudit } from "@/lib/data";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (!verifyPassword(String(password || ""))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    await createSession();
    await addAudit("Login", "Auth", "Admin", "Admin logged in").catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const safeMessage = message.includes("SESSION_SECRET")
      ? "Server session configuration is missing or invalid. Check SESSION_SECRET in Vercel."
      : "Login failed because of a server configuration error.";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
