import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require an authenticated admin session.
const PROTECTED = [
  "/dashboard",
  "/students",
  "/groups",
  "/payments",
  "/cashbook",
  "/auditlog",
  "/import",
  "/reports",
  "/invoice",
  "/backups",
];

const COOKIE_NAME = "code_wave_admin";
const MAX_AGE_MS = 60 * 60 * 10 * 1000; // 10h — must match src/lib/auth.ts

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify the signed session cookie using Web Crypto (edge-runtime safe).
// Cookie format (see src/lib/auth.ts): `admin.<createdAt>.<hmacSha256Hex>`
async function verifySession(value: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!value || !secret) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const createdAt = Number(parts[1]);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_AGE_MS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = toHex(signature);
  const received = parts[2];
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifySession(token, process.env.SESSION_SECRET);
  if (ok) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/students/:path*",
    "/groups/:path*",
    "/payments/:path*",
    "/cashbook/:path*",
    "/auditlog/:path*",
    "/import/:path*",
    "/reports/:path*",
    "/invoice/:path*",
    "/backups/:path*",
  ],
};
