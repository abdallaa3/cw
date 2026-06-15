import { WEEKDAYS, type AdjustmentDirection, type EntryType, type PaymentMethod, type Receiver, type TransactionType } from "./types";

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
  vodafone_cash: "محفظة",
  instapay: "انستاباي",
};

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  in: "دخل",
  out: "مصروف",
};

export const TX_TYPE_LABELS: Record<TransactionType, string> = {
  payment: "دفعة",
  refund: "استرداد",
  adjustment: "تعديل مالي",
  cancelled: "ملغي",
};

// Returns the signed contribution of a payment row to the student's paid_amount.
// Amounts are always stored positive; sign is determined by type + direction.
export function signedPaymentAmount(
  amount: number,
  txType: TransactionType | string | null | undefined,
  direction: AdjustmentDirection | string | null | undefined,
): number {
  const n = Number(amount ?? 0);
  const t = txType ?? "payment";
  if (t === "cancelled") return 0;
  if (t === "refund") return -n;
  if (t === "adjustment" && direction === "decrease") return -n;
  return n; // 'payment' or 'adjustment increase'
}

// The cashbook entry_type corresponding to a payment transaction.
export function paymentCashType(
  txType: TransactionType | string | null | undefined,
  direction: AdjustmentDirection | string | null | undefined,
): "in" | "out" {
  const t = txType ?? "payment";
  if (t === "payment") return "in";
  if (t === "refund") return "out";
  if (t === "adjustment") return direction === "decrease" ? "out" : "in";
  return "in";
}

export const STUDY_TYPE_LABELS: Record<string, string> = {
  online: "أونلاين",
  offline: "حضوري",
};

export const ONLINE_TYPE_LABELS: Record<string, string> = {
  private: "خصوصي",
  group: "جروب",
};

/** Today's weekday in Arabic, using Cairo time (0 = الأحد). */
export function todayWeekday(): string {
  return WEEKDAYS[cairoNow().getUTCDay()];
}

/** Format an "HH:MM" 24h time into a 12h Arabic-friendly label (e.g. 6:00 م). */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(value);
  let h = Number(m[1]);
  const min = m[2];
  const suffix = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${min} ${suffix}`;
}

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
  import: "استيراد",
  backup: "نسخة احتياطية",
  auth: "دخول",
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
