"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import { todayIso } from "./utils";
import { writeXlsxBytes } from "./xlsx";
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

// ════════════════════════════════════════════════════════════════════════════
// Full Excel backup: export + safe round-trip import (upsert, never deletes).
// Backup sheets use stable machine headers so a re-imported file matches rows
// by id and updates them instead of creating duplicates.
// ════════════════════════════════════════════════════════════════════════════

const BACKUP_STUDENT_HEADERS = [
  "id", "name", "phone", "age", "study_type", "online_type", "branch",
  "group_number", "total_amount", "installments", "installment_amount", "next_due_date", "notes",
];
const BACKUP_PAYMENT_HEADERS = ["id", "student_id", "amount", "method", "received_by", "payment_date", "notes"];
const BACKUP_CASH_HEADERS = ["id", "owner", "entry_type", "amount", "entry_date", "notes", "linked_payment_id", "linked_student_id"];

// Build the three backup sheets (header row + data rows) from the live database.
export async function getBackupAction(): Promise<Result> {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: students }, { data: payments }, { data: groups }, { data: cash }] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: true }),
      supabase.from("payments").select("*").order("payment_date", { ascending: true }),
      supabase.from("groups").select("id, group_number"),
      supabase.from("cash_entries").select("*").order("entry_date", { ascending: true }),
    ]);
    const groupNumberById = new Map((groups ?? []).map((g) => [g.id, g.group_number]));

    const studentRows: (string | number)[][] = [
      BACKUP_STUDENT_HEADERS,
      ...(students ?? []).map((s) => [
        s.id, s.name, s.phone ?? "", s.age ?? "", s.study_type ?? "offline", s.online_type ?? "", s.branch ?? "",
        s.group_id ? groupNumberById.get(s.group_id) ?? "" : "", Number(s.total_amount ?? 0),
        Number(s.installments ?? 1), Number(s.installment_amount ?? 0), s.next_due_date ?? "", s.notes ?? "",
      ]),
    ];
    const paymentRows: (string | number)[][] = [
      BACKUP_PAYMENT_HEADERS,
      ...(payments ?? []).map((p) => [
        p.id, p.student_id, Number(p.amount), p.method, p.received_by, p.payment_date, p.notes ?? "",
      ]),
    ];
    const cashRows: (string | number)[][] = [
      BACKUP_CASH_HEADERS,
      ...(cash ?? []).map((c) => [
        c.id, c.owner, c.entry_type, Number(c.amount), c.entry_date, c.notes ?? "",
        c.linked_payment_id ?? "", c.linked_student_id ?? "",
      ]),
    ];
    return { ok: true, data: { students: studentRows, payments: paymentRows, cashbook: cashRows } };
  } catch (e) {
    return fail(e);
  }
}

function cellAt(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length && row[idx] != null ? String(row[idx]).trim() : "";
}

function normalizeStudyType(value: string): "online" | "offline" {
  const s = value.toLowerCase();
  return value.includes("أونلاين") || value.includes("اونلاين") || s.includes("online") ? "online" : "offline";
}

function normalizeOnlineType(value: string): "private" | "group" | null {
  if (!value) return null;
  if (value.includes("خصوص") || value.toLowerCase().includes("private")) return "private";
  if (value.includes("جروب") || value.toLowerCase().includes("group")) return "group";
  return null;
}

function normalizeMethod(value: string): string {
  const s = value.toLowerCase();
  if (value.includes("تحويل") || s.includes("bank")) return "bank_transfer";
  if (value.includes("محفظ") || value.includes("فودافون") || s.includes("vodafone") || s.includes("wallet")) return "vodafone_cash";
  if (value.includes("انستا") || value.includes("إنستا") || s.includes("instapay")) return "instapay";
  return "cash";
}

type BackupSheets = { students?: string[][]; payments?: string[][]; cashbook?: string[][] };
type ImportCounts = {
  students_new: number;
  students_updated: number;
  payments_new: number;
  cashbook_new: number;
  errors: Array<{ sheet: string; row: number; error: string }>;
};

// Safe upsert import. Matches existing rows by id (then name+phone for students),
// updates them in place, inserts new ones, and NEVER deletes anything.
export async function importBackupAction(sheets: BackupSheets): Promise<Result> {
  try {
    const supabase = getSupabaseAdmin();
    const counts: ImportCounts = { students_new: 0, students_updated: 0, payments_new: 0, cashbook_new: 0, errors: [] };

    const [{ data: groups }, { data: dbStudents }, { data: dbPayments }, { data: dbCash }] = await Promise.all([
      supabase.from("groups").select("id, group_number"),
      supabase.from("students").select("id, name, phone"),
      supabase.from("payments").select("id"),
      supabase.from("cash_entries").select("id"),
    ]);
    const groupByNumber = new Map((groups ?? []).map((g) => [String(g.group_number), g.id]));
    const existingStudentIds = new Set((dbStudents ?? []).map((s) => s.id));
    const studentByNamePhone = new Map(
      (dbStudents ?? []).map((s) => [`${(s.name ?? "").trim()}|${(s.phone ?? "").trim()}`, s.id]),
    );
    const existingPaymentIds = new Set((dbPayments ?? []).map((p) => p.id));
    const existingCashIds = new Set((dbCash ?? []).map((c) => c.id));

    // Maps the id used in the imported file → the real database id.
    const sheetStudentIdToDbId = new Map<string, string>();

    // ── Students ──────────────────────────────────────────────────────────────
    const sRows = sheets.students ?? [];
    if (sRows.length > 1) {
      const h = sRows[0].map((x) => String(x ?? ""));
      const col = (name: string) => findCol(h, [name]);
      const ix = {
        id: col("id"), name: col("name"), phone: col("phone"), age: col("age"),
        study: col("study_type"), online: col("online_type"), branch: col("branch"),
        group: findCol(h, ["group_number", "group"]), total: col("total_amount"),
        inst: col("installments"), instAmt: col("installment_amount"), due: col("next_due_date"), notes: col("notes"),
      };
      for (let i = 1; i < sRows.length; i++) {
        const row = sRows[i].map((c) => String(c ?? ""));
        try {
          const name = cellAt(row, ix.name);
          if (!name) continue;
          const sheetId = cellAt(row, ix.id);
          const phone = cellAt(row, ix.phone) || null;
          const study = normalizeStudyType(cellAt(row, ix.study));
          const groupNum = cellAt(row, ix.group);
          let groupId: string | null = null;
          if (groupNum) {
            if (groupByNumber.has(groupNum)) groupId = groupByNumber.get(groupNum)!;
            else {
              const { data: ng } = await supabase.from("groups").insert({ group_number: groupNum, region: "غير محدد", type: "offline", subscription_type: "monthly", day1: "السبت" }).select("id").single();
              if (ng) { groupId = ng.id; groupByNumber.set(groupNum, ng.id); }
            }
          }
          const obj: Record<string, unknown> = {
            name,
            phone,
            age: cellAt(row, ix.age) ? Number(cellAt(row, ix.age)) : null,
            study_type: study,
            online_type: study === "online" ? normalizeOnlineType(cellAt(row, ix.online)) : null,
            branch: study === "offline" ? (cellAt(row, ix.branch) || null) : null,
            group_id: groupId,
            total_amount: Number(cellAt(row, ix.total) || 0),
            installments: Number(cellAt(row, ix.inst) || 1) || 1,
            installment_amount: Number(cellAt(row, ix.instAmt) || 0),
            next_due_date: cellAt(row, ix.due) || null,
            notes: cellAt(row, ix.notes) || null,
          };
          let dbId: string | null = null;
          if (sheetId && existingStudentIds.has(sheetId)) dbId = sheetId;
          else {
            const key = `${name}|${phone ?? ""}`;
            if (studentByNamePhone.has(key)) dbId = studentByNamePhone.get(key)!;
          }
          if (dbId) {
            const { error } = await supabase.from("students").update(obj).eq("id", dbId);
            if (error) throw error;
            counts.students_updated += 1;
          } else {
            const { data: ins, error } = await supabase.from("students").insert(obj).select("id").single();
            if (error) throw error;
            dbId = ins.id;
            existingStudentIds.add(dbId);
            studentByNamePhone.set(`${name}|${phone ?? ""}`, dbId);
            counts.students_new += 1;
          }
          if (sheetId && dbId) sheetStudentIdToDbId.set(sheetId, dbId);
        } catch (e) {
          counts.errors.push({ sheet: "Students", row: i + 1, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // ── Payments (insert new only; dedupe by id) ───────────────────────────────
    const pRows = sheets.payments ?? [];
    if (pRows.length > 1) {
      const h = pRows[0].map((x) => String(x ?? ""));
      const col = (name: string) => findCol(h, [name]);
      const ix = {
        id: col("id"), student: findCol(h, ["student_id", "student"]), amount: col("amount"),
        method: col("method"), recv: findCol(h, ["received_by", "receiver"]), date: col("payment_date"), notes: col("notes"),
      };
      for (let i = 1; i < pRows.length; i++) {
        const row = pRows[i].map((c) => String(c ?? ""));
        try {
          const sheetId = cellAt(row, ix.id);
          if (sheetId && existingPaymentIds.has(sheetId)) continue; // already imported — no duplicate
          const rawStudent = cellAt(row, ix.student);
          const studentId = sheetStudentIdToDbId.get(rawStudent) ?? (existingStudentIds.has(rawStudent) ? rawStudent : null);
          if (!studentId) throw new Error("لم يتم العثور على الطالب المرتبط بالدفعة");
          const amount = Number(cellAt(row, ix.amount) || 0);
          if (!(amount > 0)) continue;
          const receiver = cellAt(row, ix.recv).includes("عبدالله") ? "عبدالله" : "محمد";
          const date = parseImportDate(cellAt(row, ix.date) || undefined);
          const { data: pay, error } = await supabase
            .from("payments")
            .insert({
              student_id: studentId,
              amount,
              method: normalizeMethod(cellAt(row, ix.method)),
              received_by: receiver,
              payment_date: date,
              notes: cellAt(row, ix.notes) || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          await supabase.from("cash_entries").insert({
            owner: receiver,
            entry_type: "in",
            amount,
            notes: "دفعة (استيراد)",
            entry_date: date,
            linked_payment_id: pay.id,
            linked_student_id: studentId,
          });
          existingPaymentIds.add(pay.id);
          counts.payments_new += 1;
        } catch (e) {
          counts.errors.push({ sheet: "Payments", row: i + 1, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // ── Cashbook (manual entries only; dedupe by id) ───────────────────────────
    const cRows = sheets.cashbook ?? [];
    if (cRows.length > 1) {
      const h = cRows[0].map((x) => String(x ?? ""));
      const col = (name: string) => findCol(h, [name]);
      const ix = {
        id: col("id"), owner: col("owner"), type: findCol(h, ["entry_type", "type"]), amount: col("amount"),
        date: col("entry_date"), notes: col("notes"), linkedPay: findCol(h, ["linked_payment_id"]),
        linkedStu: findCol(h, ["linked_student_id"]),
      };
      for (let i = 1; i < cRows.length; i++) {
        const row = cRows[i].map((c) => String(c ?? ""));
        try {
          // Skip payment-linked entries — those are recreated by the payments import.
          if (cellAt(row, ix.linkedPay)) continue;
          const sheetId = cellAt(row, ix.id);
          if (sheetId && existingCashIds.has(sheetId)) continue;
          const owner = cellAt(row, ix.owner).includes("عبدالله") ? "عبدالله" : "محمد";
          const type = cellAt(row, ix.type) === "out" || cellAt(row, ix.type).includes("مصروف") ? "out" : "in";
          const amount = Number(cellAt(row, ix.amount) || 0);
          if (!(amount > 0)) continue;
          const rawStu = cellAt(row, ix.linkedStu);
          const linkedStudent = sheetStudentIdToDbId.get(rawStu) ?? (existingStudentIds.has(rawStu) ? rawStu : null);
          const { data: ins, error } = await supabase
            .from("cash_entries")
            .insert({
              owner,
              entry_type: type,
              amount,
              notes: cellAt(row, ix.notes) || null,
              entry_date: parseImportDate(cellAt(row, ix.date) || undefined),
              linked_student_id: linkedStudent,
            })
            .select("id")
            .single();
          if (error) throw error;
          existingCashIds.add(ins.id);
          counts.cashbook_new += 1;
        } catch (e) {
          counts.errors.push({ sheet: "Cashbook", row: i + 1, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    await import("./data").then((m) =>
      m.addAudit("system", "create", "import", null,
        `استيراد نسخة احتياطية — ${counts.students_new} طالب جديد، ${counts.students_updated} محدّث، ${counts.payments_new} دفعة، ${counts.cashbook_new} حركة خزينة`,
        { ...counts, errors: counts.errors.length }),
    );
    revalidateAll();
    return { ok: true, data: counts };
  } catch (e) {
    return fail(e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Source-workbook importer (the original Google-Sheets bookkeeping export).
// Structure detected from the real file:
//   • numbered tabs (12..29) = groups; each tab's rows are that group's students
//     headers: الاسم | رقم التلفون | سعر الكورس | دفع
//   • 'online' tab = online students (الاسم | الرقم | المبلغ | دفع)
//   • 'الفلوس' tab = two-person manual treasury ledger → flagged for manual
//     review, never auto-posted (too ambiguous to map safely)
// Historical paid amounts have no receiver in the sheet, so the caller supplies
// a default receiver/method explicitly (no silent fake values). dryRun=true
// computes the preview counts without writing anything.
// ════════════════════════════════════════════════════════════════════════════

type WorkbookSheets = Record<string, string[][]>;
type WorkbookOpts = { defaultReceiver?: string; defaultMethod?: string; dryRun?: boolean };
type WorkbookPlan = {
  groups_new: number;
  groups_existing: number;
  students_new: number;
  students_updated: number;
  payments_new: number;
  cashbook_new: number;
  invalid_rows: number;
  duplicate_warnings: string[];
  detected: Array<{ sheet: string; kind: string; rows: number }>;
  manual_review: string[];
  errors: Array<{ sheet: string; row: number; error: string }>;
};

function phoneKey(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`; // Excel dropped the leading 0
  // canonical = last 10 digits (handles +20 / 0 prefixes for matching)
  return d.length > 10 ? d.slice(-10) : d;
}
function storePhone(raw: string): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  return d;
}
function isSummaryName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/^\d+([.,]\d+)?$/.test(n)) return true; // pure number
  return ["اجمالي", "إجمالي", "الاجمالي", "مجموع", "المجموع", "الباقي", "total"].some((k) => n.includes(k));
}
function colIndex(header: string[], keys: string[], fallback: number): number {
  const idx = findCol(header, keys);
  return idx >= 0 ? idx : fallback;
}

// Returns the parsed student rows for one numbered group / online sheet.
function parseStudentSheet(rows: string[][], online: boolean) {
  if (!rows.length) return { items: [] as Array<Record<string, string>>, invalid: 0 };
  const header = rows[0].map((x) => String(x ?? ""));
  const nameIx = colIndex(header, ["اسم", "الاسم"], 0);
  const phoneIx = colIndex(header, ["تلفون", "التلفون", "الرقم", "رقم", "موبايل"], online ? 1 : 2);
  const priceIx = colIndex(header, ["سعر", "المبلغ", "مبلغ", "سعر الكورس"], 3);
  const paidIx = colIndex(header, ["دفع", "المدفوع"], 4);
  const items: Array<Record<string, string>> = [];
  let invalid = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r].map((c) => String(c ?? ""));
    const name = (row[nameIx] ?? "").trim();
    if (!name) continue; // blank line — skip silently
    if (isSummaryName(name)) continue; // totals / count rows
    const phone = (row[phoneIx] ?? "").trim();
    const price = String(row[priceIx] ?? "").trim();
    const paid = String(row[paidIx] ?? "").trim();
    if (!phone && !price && !paid) { invalid += 1; continue; } // name only, no data
    items.push({ name, phone, price, paid });
  }
  return { items, invalid };
}

export async function importWorkbookAction(sheets: WorkbookSheets, opts: WorkbookOpts = {}): Promise<Result> {
  try {
    const supabase = getSupabaseAdmin();
    const dryRun = opts.dryRun !== false ? opts.dryRun === true : true; // default handled below
    const isDry = !!opts.dryRun;
    const receiver = opts.defaultReceiver === "عبدالله" ? "عبدالله" : "محمد";
    const method = ["cash", "bank_transfer", "vodafone_cash", "instapay"].includes(String(opts.defaultMethod))
      ? String(opts.defaultMethod)
      : "cash";
    void dryRun;

    const plan: WorkbookPlan = {
      groups_new: 0, groups_existing: 0, students_new: 0, students_updated: 0,
      payments_new: 0, cashbook_new: 0, invalid_rows: 0, duplicate_warnings: [],
      detected: [], manual_review: [], errors: [],
    };

    // Existing data for matching.
    const [{ data: dbGroups }, { data: dbStudents }] = await Promise.all([
      supabase.from("groups").select("id, group_number"),
      supabase.from("students").select("id, name, phone, group_id"),
    ]);
    const groupByNumber = new Map((dbGroups ?? []).map((g) => [String(g.group_number).trim(), g.id]));
    const studentByPhone = new Map<string, string>();
    const studentByName = new Map<string, string[]>();
    for (const s of dbStudents ?? []) {
      const pk = phoneKey(s.phone ?? "");
      if (pk) studentByPhone.set(pk, s.id);
      const nk = (s.name ?? "").trim();
      if (nk) studentByName.set(nk, [...(studentByName.get(nk) ?? []), s.id]);
    }
    const seenPhones = new Set<string>();

    // Classify sheets.
    const groupSheets: Array<{ name: string; number: string; rows: string[][] }> = [];
    let onlineSheet: string[][] | null = null;
    for (const [name, rows] of Object.entries(sheets)) {
      const trimmed = name.trim();
      if (/^\d+$/.test(trimmed)) {
        const num = Number(trimmed);
        if (num >= 12 && num <= 29) groupSheets.push({ name: trimmed, number: trimmed, rows });
        else plan.manual_review.push(`تبويب رقمي خارج النطاق 12–29: '${name}' (لم يُستورد)`);
      } else if (trimmed.toLowerCase().includes("online")) {
        onlineSheet = rows;
      } else if (trimmed.includes("الفلوس")) {
        plan.manual_review.push(`تبويب الفلوس (الخزينة اليدوية) يحتاج مراجعة يدوية — لم يُستورد تلقائياً`);
      }
    }

    // Helper: upsert one student record + optional first payment.
    async function handleStudent(it: Record<string, string>, groupId: string | null, studyType: "online" | "offline") {
      const pk = phoneKey(it.phone);
      if (pk && seenPhones.has(pk)) plan.duplicate_warnings.push(`تكرار رقم: ${it.name} (${it.phone})`);
      if (pk) seenPhones.add(pk);

      let dbId: string | null = null;
      if (pk && studentByPhone.has(pk)) dbId = studentByPhone.get(pk)!;
      else if (!pk) {
        const matches = studentByName.get(it.name.trim());
        if (matches && matches.length === 1) dbId = matches[0];
        else if (matches && matches.length > 1) plan.duplicate_warnings.push(`اسم مكرر بدون رقم: ${it.name} (تخطّي للأمان)`);
      }

      const total = Number(String(it.price).replace(/,/g, "")) || 0;
      const paid = Number(String(it.paid).replace(/,/g, "")) || 0;

      if (dbId) {
        plan.students_updated += 1;
        if (!isDry) {
          const patch: Record<string, unknown> = { study_type: studyType };
          if (groupId) patch.group_id = groupId;
          if (total > 0) patch.total_amount = total;
          await supabase.from("students").update(patch).eq("id", dbId);
        }
        return;
      }

      // New student.
      plan.students_new += 1;
      if (paid > 0) { plan.payments_new += 1; plan.cashbook_new += 1; }
      if (!isDry) {
        const { data: ins, error } = await supabase
          .from("students")
          .insert({
            name: it.name.trim(),
            phone: storePhone(it.phone),
            study_type: studyType,
            group_id: groupId,
            total_amount: total,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (pk) studentByPhone.set(pk, ins.id);
        if (paid > 0) {
          const { data: pay } = await supabase
            .from("payments")
            .insert({ student_id: ins.id, amount: paid, method, received_by: receiver, payment_date: todayIso(), notes: "مستورد من الشيت" })
            .select("id")
            .single();
          if (pay) {
            await supabase.from("cash_entries").insert({
              owner: receiver, entry_type: "in", amount: paid, notes: `دفعة مستوردة — ${it.name.trim()}`,
              entry_date: todayIso(), linked_payment_id: pay.id, linked_student_id: ins.id,
            });
          }
        }
      }
    }

    // Groups + their students.
    for (const gs of groupSheets) {
      try {
        const { items, invalid } = parseStudentSheet(gs.rows, false);
        plan.invalid_rows += invalid;
        plan.detected.push({ sheet: gs.name, kind: "جروب", rows: items.length });
        let groupId = groupByNumber.get(gs.number) ?? null;
        if (groupId) plan.groups_existing += 1;
        else {
          plan.groups_new += 1;
          if (!isDry) {
            const { data: g, error } = await supabase
              .from("groups")
              .insert({ group_number: gs.number, region: "غير محدد", type: "offline", subscription_type: "monthly", day1: "السبت" })
              .select("id")
              .single();
            if (error) throw error;
            groupId = g.id;
            groupByNumber.set(gs.number, g.id);
          }
        }
        for (const it of items) await handleStudent(it, groupId, "offline");
      } catch (e) {
        plan.errors.push({ sheet: gs.name, row: 0, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Online students (no group).
    if (onlineSheet) {
      const { items, invalid } = parseStudentSheet(onlineSheet, true);
      plan.invalid_rows += invalid;
      plan.detected.push({ sheet: "online", kind: "أونلاين", rows: items.length });
      for (const it of items) {
        try { await handleStudent(it, null, "online"); }
        catch (e) { plan.errors.push({ sheet: "online", row: 0, error: e instanceof Error ? e.message : String(e) }); }
      }
    }

    if (!isDry) {
      await import("./data").then((m) =>
        m.addAudit("system", "create", "import", null,
          `استيراد من الشيت — ${plan.groups_new} جروب جديد، ${plan.students_new} طالب جديد، ${plan.students_updated} محدّث، ${plan.payments_new} دفعة`,
          { groups_new: plan.groups_new, students_new: plan.students_new, students_updated: plan.students_updated, payments_new: plan.payments_new }),
      );
      revalidateAll();
    } else {
      await import("./data").then((m) =>
        m.addAudit("system", "create", "import", null, "تحليل ملف Excel (معاينة قبل الاستيراد)", { detected: plan.detected.length }),
      ).catch(() => undefined);
    }
    return { ok: true, data: plan };
  } catch (e) {
    return fail(e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Backups → Supabase Storage (bucket: "backups"). Manual button + cron route.
// ════════════════════════════════════════════════════════════════════════════
const BACKUP_BUCKET = "backups";

export async function createBackupAction(): Promise<Result> {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: students }, { data: groups }, { data: payments }, { data: cash }, { data: audits }] = await Promise.all([
      supabase.from("students").select("*").order("created_at", { ascending: true }),
      supabase.from("groups").select("*").order("created_at", { ascending: true }),
      supabase.from("payments").select("*").order("payment_date", { ascending: true }),
      supabase.from("cash_entries").select("*").order("entry_date", { ascending: true }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(2000),
    ]);
    const groupNumberById = new Map((groups ?? []).map((g) => [g.id, g.group_number]));

    const studentRows: (string | number)[][] = [
      BACKUP_STUDENT_HEADERS,
      ...(students ?? []).map((s) => [
        s.id, s.name, s.phone ?? "", s.age ?? "", s.study_type ?? "offline", s.online_type ?? "", s.branch ?? "",
        s.group_id ? groupNumberById.get(s.group_id) ?? "" : "", Number(s.total_amount ?? 0),
        Number(s.installments ?? 1), Number(s.installment_amount ?? 0), s.next_due_date ?? "", s.notes ?? "",
      ]),
    ];
    const groupRows: (string | number)[][] = [
      ["id", "group_number", "region", "type", "subscription_type", "branch", "day1", "start_time1", "end_time1", "day2", "start_time2", "end_time2", "notes"],
      ...(groups ?? []).map((g) => [
        g.id, g.group_number, g.region ?? "", g.type ?? "", g.subscription_type ?? "", g.branch ?? "",
        g.day1 ?? "", g.start_time1 ?? "", g.end_time1 ?? "", g.day2 ?? "", g.start_time2 ?? "", g.end_time2 ?? "", g.notes ?? "",
      ]),
    ];
    const paymentRows: (string | number)[][] = [
      BACKUP_PAYMENT_HEADERS,
      ...(payments ?? []).map((p) => [p.id, p.student_id, Number(p.amount), p.method, p.received_by, p.payment_date, p.notes ?? ""]),
    ];
    const cashRows: (string | number)[][] = [
      BACKUP_CASH_HEADERS,
      ...(cash ?? []).map((c) => [c.id, c.owner, c.entry_type, Number(c.amount), c.entry_date, c.notes ?? "", c.linked_payment_id ?? "", c.linked_student_id ?? ""]),
    ];
    const auditRows: (string | number)[][] = [
      ["id", "actor", "action", "entity", "entity_id", "description", "created_at"],
      ...(audits ?? []).map((a) => [a.id, a.actor, a.action, a.entity, a.entity_id ?? "", a.description, a.created_at]),
    ];

    const bytes = await writeXlsxBytes([
      { name: "Students", rows: studentRows },
      { name: "Groups", rows: groupRows },
      { name: "Payments", rows: paymentRows },
      { name: "Cashbook", rows: cashRows },
      { name: "AuditLog", rows: auditRows },
    ]);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fname = `codewave-backup-${stamp}.xlsx`;

    const { error } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(fname, bytes, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false });
    if (error) throw new Error(`فشل رفع النسخة الاحتياطية: ${error.message} (تأكد من وجود bucket باسم 'backups')`);

    await import("./data").then((m) =>
      m.addAudit("system", "create", "backup", null, `إنشاء نسخة احتياطية — ${fname}`, {
        file: fname, students: (students ?? []).length, groups: (groups ?? []).length, payments: (payments ?? []).length,
      }),
    ).catch(() => undefined);
    return { ok: true, data: { name: fname } };
  } catch (e) {
    return fail(e);
  }
}

export async function listBackupsAction(): Promise<Result> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(BACKUP_BUCKET).list("", {
      limit: 200,
      sortBy: { column: "name", order: "desc" },
    });
    if (error) throw new Error(`${error.message} (تأكد من وجود bucket باسم 'backups')`);
    const files = (data ?? []).filter((f) => f.name.toLowerCase().endsWith(".xlsx"));
    const out = [];
    for (const f of files) {
      const { data: signed } = await supabase.storage.from(BACKUP_BUCKET).createSignedUrl(f.name, 3600);
      out.push({
        name: f.name,
        size: (f.metadata as { size?: number } | null)?.size ?? 0,
        created_at: f.created_at ?? null,
        url: signed?.signedUrl ?? "",
      });
    }
    return { ok: true, data: out };
  } catch (e) {
    return fail(e);
  }
}
