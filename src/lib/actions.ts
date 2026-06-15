"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import {
  createCashEntry,
  createGroup,
  createPayment,
  createStudent,
  deleteCashEntry,
  deleteGroup,
  deletePayment,
  deleteStudent,
  updateCashEntry,
  updateGroup,
  updatePayment,
  updateStudent,
} from "./data";

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

function fail(error: unknown): Result {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}

const REVALIDATE_PATHS = [
  "/dashboard",
  "/students",
  "/groups",
  "/payments",
  "/cashbook",
  "/auditlog",
  "/reports",
];

function revalidateAll() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

// ── Groups ───────────────────────────────────────────────────────────────────
export async function saveGroupAction(id: string | null, payload: Record<string, unknown>): Promise<Result> {
  try {
    const data = id ? await updateGroup(id, payload) : await createGroup(payload);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGroupAction(id: string): Promise<Result> {
  try {
    await deleteGroup(id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Students ─────────────────────────────────────────────────────────────────
export async function saveStudentAction(id: string | null, payload: Record<string, unknown>): Promise<Result> {
  try {
    const data = id ? await updateStudent(id, payload) : await createStudent(payload);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStudentAction(id: string): Promise<Result> {
  try {
    await deleteStudent(id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Payments ─────────────────────────────────────────────────────────────────
export async function savePaymentAction(id: string | null, payload: Record<string, unknown>): Promise<Result> {
  try {
    const data = id ? await updatePayment(id, payload) : await createPayment(payload);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePaymentAction(id: string): Promise<Result> {
  try {
    await deletePayment(id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Cashbook ─────────────────────────────────────────────────────────────────
export async function saveCashEntryAction(id: string | null, payload: Record<string, unknown>): Promise<Result> {
  try {
    const data = id ? await updateCashEntry(id, payload) : await createCashEntry(payload);
    revalidateAll();
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCashEntryAction(id: string): Promise<Result> {
  try {
    await deleteCashEntry(id);
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ── Excel / CSV import (mirrors app/routes/dashboard.py import_excel) ─────────
function findCol(header: string[], variants: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const v of variants) {
    const idx = lower.indexOf(v.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function safeFloat(row: string[], idx: number): number {
  if (idx < 0 || idx >= row.length || row[idx] == null) return 0;
  const n = Number(String(row[idx]).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function safeInt(row: string[], idx: number): number {
  if (idx < 0 || idx >= row.length || row[idx] == null) return 1;
  const n = parseInt(String(row[idx]).replace(/,/g, "").trim(), 10);
  return Number.isFinite(n) ? n : 1;
}

function parseImportDate(value: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!value) return today;
  const s = String(value).trim();
  // Excel serial number
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  for (const re of [/^(\d{4})-(\d{2})-(\d{2})/, /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, /^(\d{1,2})-(\d{1,2})-(\d{4})/]) {
    const m = s.match(re);
    if (m) {
      if (re.source.startsWith("^(\\d{4})")) return `${m[1]}-${m[2]}-${m[3]}`;
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  // dd/mm short form
  const short = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (short) {
    const year = new Date().getFullYear();
    return `${year}-${short[2].padStart(2, "0")}-${short[1].padStart(2, "0")}`;
  }
  return today;
}

function parseMethodReceiver(value: string | undefined): { method: string; receiver: string } {
  if (!value) return { method: "cash", receiver: "محمد" };
  const s = String(value).trim();
  const lower = s.toLowerCase();
  let receiver = "محمد";
  if (s.includes("عبدالله")) receiver = "عبدالله";
  let method = "cash";
  if (s.includes("تحويل") || lower.includes("bank")) method = "bank_transfer";
  else if (s.includes("فودافون") || lower.includes("vodafone")) method = "vodafone_cash";
  else if (s.includes("انستاباي") || s.includes("إنستاباي") || lower.includes("instapay")) method = "instapay";
  return { method, receiver };
}

export async function importRowsAction(rows: string[][]): Promise<Result> {
  try {
    if (!rows.length) throw new Error("الملف فارغ");
    const supabase = getSupabaseAdmin();
    const header = rows[0].map((h) => String(h ?? ""));

    const nameIdx = findCol(header, ["name", "اسم", "الاسم", "اسم الطالب"]);
    const phoneIdx = findCol(header, ["phone", "تليفون", "الهاتف", "موبايل", "رقم الهاتف", "رقم التليفون"]);
    const groupIdx = findCol(header, ["group", "group_number", "الجروب", "جروب", "رقم الجروب"]);
    const totalIdx = findCol(header, ["total_amount", "total", "الاجمالي", "إجمالي", "المبلغ الإجمالي", "سعر الكورس"]);
    const installIdx = findCol(header, ["installments", "أقساط", "عدد الأقساط", "العدد"]);
    const installAmtIdx = findCol(header, ["installment_amount", "قيمة القسط"]);
    const discountIdx = findCol(header, ["discount", "خصم", "الخصم"]);
    const paidIdx = findCol(header, ["paid", "دفع", "المدفوع", "الدفع"]);
    const payDateIdx = findCol(header, ["payment_date", "تاريخ الدفع", "التاريخ"]);
    const payMethodIdx = findCol(header, ["payment_method", "طريقة الدفع", "طريقه الدفع", "طريقة"]);
    const notesIdx = findCol(header, ["notes", "ملاحظات"]);

    if (nameIdx < 0) throw new Error("لم يتم العثور على عمود الاسم في الملف");

    // cache groups by number
    const { data: existingGroups } = await supabase.from("groups").select("id, group_number");
    const groupByNumber = new Map<string, string>((existingGroups ?? []).map((g) => [String(g.group_number), g.id]));

    let created = 0;
    let payments = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].map((c) => String(c ?? ""));
      try {
        const name = (row[nameIdx] ?? "").trim();
        if (!name || ["none", "nan", ""].includes(name.toLowerCase())) {
          skipped += 1;
          continue;
        }

        let groupId: string | null = null;
        if (groupIdx >= 0 && row[groupIdx]?.trim()) {
          const num = row[groupIdx].trim();
          if (groupByNumber.has(num)) groupId = groupByNumber.get(num)!;
          else {
            const { data: g } = await supabase
              .from("groups")
              .insert({ group_number: num, region: "غير محدد", type: "offline", subscription_type: "monthly" })
              .select("id")
              .single();
            if (g) {
              groupId = g.id;
              groupByNumber.set(num, g.id);
            }
          }
        }

        const total = safeFloat(row, totalIdx);
        const discount = safeFloat(row, discountIdx);
        const netTotal = discount > 0 ? total - discount : total;
        let phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() || null : null;
        if (phone?.endsWith(".0")) phone = phone.slice(0, -2);

        const { data: student } = await supabase
          .from("students")
          .insert({
            name,
            phone,
            group_id: groupId,
            total_amount: netTotal,
            installments: safeInt(row, installIdx),
            installment_amount: safeFloat(row, installAmtIdx),
            notes: notesIdx >= 0 ? row[notesIdx]?.trim() || null : null,
          })
          .select("id")
          .single();
        if (!student) throw new Error("فشل إنشاء الطالب");
        created += 1;

        const paid = safeFloat(row, paidIdx);
        if (paid > 0) {
          const { method, receiver } = parseMethodReceiver(payMethodIdx >= 0 ? row[payMethodIdx] : undefined);
          const date = parseImportDate(payDateIdx >= 0 ? row[payDateIdx] : undefined);
          const { data: payment } = await supabase
            .from("payments")
            .insert({ student_id: student.id, amount: paid, method, received_by: receiver, payment_date: date })
            .select("id")
            .single();
          if (payment) {
            await supabase.from("cash_entries").insert({
              owner: receiver,
              entry_type: "in",
              amount: paid,
              notes: `دفعة من ${name}`,
              entry_date: date,
              linked_payment_id: payment.id,
              linked_student_id: student.id,
            });
            payments += 1;
          }
        }
      } catch (e) {
        errors.push({ row: i + 1, error: e instanceof Error ? e.message : String(e) });
        skipped += 1;
      }
    }

    await import("./data").then((m) =>
      m.addAudit("system", "create", "student", null, `استيراد ${created} طالب و ${payments} دفعة من ملف`, {
        created,
        payments,
        skipped,
      }),
    );
    revalidateAll();
    return { ok: true, data: { created, payments, skipped, errors } };
  } catch (e) {
    return fail(e);
  }
}

// ── Payment receipt image upload ─────────────────────────────────────────────
export async function uploadPaymentImageAction(formData: FormData): Promise<Result> {
  try {
    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) throw new Error("لم يتم اختيار ملف");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const allowed = ["png", "jpg", "jpeg", "gif", "webp", "pdf"];
    if (!allowed.includes(ext)) throw new Error("امتداد الملف غير مسموح");
    const supabase = getSupabaseAdmin();
    const path = `${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from("payment-images")
      .upload(path, arrayBuffer, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("payment-images").getPublicUrl(path);
    return { ok: true, data: { image_path: data.publicUrl } };
  } catch (e) {
    return fail(e);
  }
}
