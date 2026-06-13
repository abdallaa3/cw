import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const cookieName = "code_wave_admin";
const maxAgeSeconds = 60 * 60 * 10;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) {
    throw new Error("SESSION_SECRET must be at least 24 characters");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function verifyPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD || "code.wave";
  const left = Buffer.from(password);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createSession() {
  const createdAt = Date.now();
  const payload = `admin.${createdAt}`;
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(cookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(cookieName);
}

export async function isAuthenticated() {
  const store = await cookies();
  const value = store.get(cookieName)?.value;
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const received = parts[2];
  const createdAt = Number(parts[1]);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > maxAgeSeconds * 1000) return false;
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function requireAdmin() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}
