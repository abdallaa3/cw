import type { EntryType, PaymentMethod, Receiver } from "./types";

export function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function egp(value: unknown): string {
  return `${money(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} ج`;
}

export function cairoNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
}

export function todayIso(): string {
  return cairoNow().toISOString().slice(0, 10);
}

export function monthKey(date: Date = cairoNow()): string {
  return date.toISOString().slice(0, 7);
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }
    : { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Cairo" };
  return new Intl.DateTimeFormat("en-GB", opts).format(d);
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "كاش",
  bank_transfer: "تحويل بنكي",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
};

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  in: "دخل",
  out: "مصروف",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
};

export const ENTITY_LABELS: Record<string, string> = {
  student: "طالب",
  group: "جروب",
  payment: "دفعة",
  cashbook: "خزينة",
};

export function methodLabel(method: string | null | undefined): string {
  return METHOD_LABELS[method as PaymentMethod] ?? method ?? "";
}

export function receiverInitial(name: Receiver | string): string {
  return name === "عبدالله" ? "ع" : "م";
}

export function normalizePhone(phone: unknown): string {
  let cleaned = String(phone ?? "").replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("01")) cleaned = `2${cleaned}`;
  return cleaned;
}

export function whatsappUrl(phone: unknown, message: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","));
  return [headers.join(","), ...body].join("\n");
}
