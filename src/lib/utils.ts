import type { PaymentStatus } from "./types";

export function money(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

export function calculatePayment(coursePriceInput: unknown, paidAmountInput: unknown) {
  const coursePrice = money(coursePriceInput);
  const paidAmount = money(paidAmountInput);
  const remainingAmount = Math.max(0, coursePrice - paidAmount);
  let paymentStatus: PaymentStatus = "Unpaid";

  if (paidAmount > 0 && paidAmount < coursePrice) paymentStatus = "Partially Paid";
  if (paidAmount >= coursePrice && coursePrice > 0) paymentStatus = "Paid";

  return { coursePrice, paidAmount, remainingAmount, paymentStatus };
}

export function formatCurrency(value: unknown, currency = "EGP") {
  return `${money(value).toLocaleString("en-US")} ${currency}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function normalizePhone(phone: unknown) {
  let cleaned = String(phone ?? "").replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("01")) cleaned = `2${cleaned}`;
  return cleaned;
}

export function whatsappUrl(phone: unknown, message: string) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function nextHumanCode(prefix: string, rows: Array<Record<string, unknown>>, column: string) {
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  const max = rows.reduce((highest, row) => {
    const match = String(row[column] ?? "").match(regex);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
  return [headers.join(","), ...body].join("\n");
}

export function invoiceFileName(invoiceCode: string, studentName: string) {
  const safeName = studentName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return `Invoice-${invoiceCode}-${safeName || "Student"}.pdf`;
}
