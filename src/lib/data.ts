import { getSupabaseAdmin } from "./supabase";
import { backupTables, type AppData, type DashboardData, type Student } from "./types";
import { calculatePayment, monthKey, nextHumanCode, todayIso } from "./utils";

type TableName = (typeof backupTables)[number];

async function readTable(table: TableName) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function codeFor(prefix: string, table: TableName, column: string) {
  const rows = await readTable(table);
  return nextHumanCode(prefix, rows as Array<Record<string, unknown>>, column);
}

export async function addAudit(action: string, entityType: string, entityId: string, description: string, notes = "") {
  const supabase = getSupabaseAdmin();
  const logCode = await codeFor("LOG", "audit_logs", "log_code");
  await supabase.from("audit_logs").insert({
    log_code: logCode,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
    user: "Admin",
    notes,
  });
}

export async function getAppData(): Promise<AppData> {
  const [students, groups, payments, invoices, cashbook, auditLogs, settings, backups] = await Promise.all([
    readTable("students"),
    readTable("groups"),
    readTable("payments"),
    readTable("invoices"),
    readTable("cashbook"),
    readTable("audit_logs"),
    readTable("settings"),
    readTable("backups"),
  ]);

  return {
    students: students as AppData["students"],
    groups: groups as AppData["groups"],
    payments: payments as AppData["payments"],
    invoices: invoices as AppData["invoices"],
    cashbook: cashbook as AppData["cashbook"],
    auditLogs: auditLogs as AppData["auditLogs"],
    settings: settings as AppData["settings"],
    backups: backups as AppData["backups"],
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const data = await getAppData();
  const today = todayIso();
  const currentMonth = monthKey();
  const activeStudents = data.students.filter((student) => student.student_status !== "Archived");
  const activePayments = data.payments;

  return {
    totalStudents: data.students.length,
    activeStudents: activeStudents.length,
    archivedStudents: data.students.filter((student) => student.student_status === "Archived").length,
    totalGroups: data.groups.length,
    activeGroups: data.groups.filter((group) => group.status !== "Archived").length,
    totalCollected: data.students.reduce((total, student) => total + Number(student.paid_amount || 0), 0),
    totalRemaining: data.students.reduce((total, student) => total + Number(student.remaining_amount || 0), 0),
    pendingPaymentsCount: data.students.filter((student) => Number(student.remaining_amount || 0) > 0).length,
    todayPayments: activePayments.filter((payment) => payment.payment_date === today).reduce((total, payment) => total + Number(payment.payment_amount || 0), 0),
    thisMonthRevenue: activePayments.filter((payment) => payment.payment_date?.startsWith(currentMonth)).reduce((total, payment) => total + Number(payment.payment_amount || 0), 0),
    recentPayments: data.payments.slice(0, 5),
    recentInvoices: data.invoices.slice(0, 5),
    recentAuditLogs: data.auditLogs.slice(0, 5),
  };
}

export async function createGroup(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const groupCode = await codeFor("GRP", "groups", "group_code");
  const row = {
    group_code: groupCode,
    group_name: String(payload.group_name || "").trim(),
    course: String(payload.course || "").trim() || null,
    instructor: String(payload.instructor || "").trim() || null,
    schedule: String(payload.schedule || "").trim() || null,
    start_date: String(payload.start_date || "") || null,
    end_date: String(payload.end_date || "") || null,
    status: String(payload.status || "Active"),
    notes: String(payload.notes || "").trim() || null,
  };
  if (!row.group_name) throw new Error("Group name is required");
  const { data, error } = await supabase.from("groups").insert(row).select("*").single();
  if (error) throw error;
  await addAudit("Add group", "Group", data.group_code, `Created group ${data.group_name}`);
  return data;
}

export async function updateGroup(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const patch = {
    group_name: String(payload.group_name || "").trim(),
    course: String(payload.course || "").trim() || null,
    instructor: String(payload.instructor || "").trim() || null,
    schedule: String(payload.schedule || "").trim() || null,
    start_date: String(payload.start_date || "") || null,
    end_date: String(payload.end_date || "") || null,
    status: String(payload.status || "Active"),
    notes: String(payload.notes || "").trim() || null,
  };
  const { data, error } = await supabase.from("groups").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await supabase.from("students").update({ group_name: data.group_name }).eq("group_id", id);
  await addAudit("Edit group", "Group", data.group_code, `Updated group ${data.group_name}`);
  return data;
}

export async function archiveGroup(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("groups").update({ status: "Archived" }).eq("id", id).select("*").single();
  if (error) throw error;
  await addAudit("Archive group", "Group", data.group_code, `Archived group ${data.group_name}`);
  return data;
}

export async function createStudent(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const studentCode = await codeFor("STU", "students", "student_code");
  const groupId = String(payload.group_id || "") || null;
  let groupName = String(payload.group_name || "").trim() || null;
  if (groupId) {
    const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).single();
    groupName = group?.group_name ?? groupName;
  }
  const calc = calculatePayment(payload.course_price, payload.paid_amount);
  const row = {
    student_code: studentCode,
    student_name: String(payload.student_name || "").trim(),
    phone: String(payload.phone || "").trim() || null,
    parent_phone: String(payload.parent_phone || payload.phone || "").trim() || null,
    course: String(payload.course || "").trim() || null,
    group_id: groupId,
    group_name: groupName,
    course_price: calc.coursePrice,
    paid_amount: calc.paidAmount,
    remaining_amount: calc.remainingAmount,
    payment_status: calc.paymentStatus,
    student_status: String(payload.student_status || "Active"),
    notes: String(payload.notes || "").trim() || null,
    registration_date: String(payload.registration_date || todayIso()),
  };
  if (!row.student_name) throw new Error("Student name is required");
  const { data, error } = await supabase.from("students").insert(row).select("*").single();
  if (error) throw error;
  await addAudit("Add student", "Student", data.student_code, `Created student ${data.student_name}`);
  return data;
}

export async function updateStudent(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const groupId = String(payload.group_id || "") || null;
  let groupName = String(payload.group_name || "").trim() || null;
  if (groupId) {
    const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).single();
    groupName = group?.group_name ?? groupName;
  }
  const calc = calculatePayment(payload.course_price, payload.paid_amount);
  const patch = {
    student_name: String(payload.student_name || "").trim(),
    phone: String(payload.phone || "").trim() || null,
    parent_phone: String(payload.parent_phone || payload.phone || "").trim() || null,
    course: String(payload.course || "").trim() || null,
    group_id: groupId,
    group_name: groupName,
    course_price: calc.coursePrice,
    paid_amount: calc.paidAmount,
    remaining_amount: calc.remainingAmount,
    payment_status: calc.paymentStatus,
    student_status: String(payload.student_status || "Active"),
    notes: String(payload.notes || "").trim() || null,
    registration_date: String(payload.registration_date || todayIso()),
  };
  const { data, error } = await supabase.from("students").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await addAudit("Edit student", "Student", data.student_code, `Updated student ${data.student_name}`);
  return data;
}

export async function archiveStudent(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("students").update({ student_status: "Archived" }).eq("id", id).select("*").single();
  if (error) throw error;
  await addAudit("Archive student", "Student", data.student_code, `Archived student ${data.student_name}`);
  return data;
}

export async function createPayment(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const studentId = String(payload.student_id || "");
  const paymentAmount = Number(payload.payment_amount || 0);
  if (!studentId || paymentAmount <= 0) throw new Error("Student and payment amount are required");

  const { data: student, error: studentError } = await supabase.from("students").select("*").eq("id", studentId).single<Student>();
  if (studentError || !student) throw studentError || new Error("Student not found");

  const newPaidAmount = Number(student.paid_amount || 0) + paymentAmount;
  const calc = calculatePayment(student.course_price, newPaidAmount);
  const paymentCode = await codeFor("PAY", "payments", "payment_code");
  const collectedBy = String(payload.collected_by || "محمد").trim();
  const notes = String(payload.notes || "").trim() || null;
  const row = {
    payment_code: paymentCode,
    student_id: student.id,
    student_code: student.student_code,
    student_name: student.student_name,
    group_id: student.group_id,
    group_name: student.group_name,
    course: student.course,
    payment_amount: paymentAmount,
    total_paid_after_payment: calc.paidAmount,
    remaining_after_payment: calc.remainingAmount,
    payment_method: String(payload.payment_method || "cash"),
    collected_by: collectedBy,
    payment_date: String(payload.payment_date || todayIso()),
    notes,
  };
  let { data: payment, error } = await supabase.from("payments").insert(row).select("*").single();
  if (error && String(error.message || "").includes("collected_by")) {
    const fallbackRow = {
      ...row,
      notes: [notes, `Collected by: ${collectedBy}`].filter(Boolean).join(" | "),
    };
    delete (fallbackRow as Partial<typeof row>).collected_by;
    const retry = await supabase.from("payments").insert(fallbackRow).select("*").single();
    payment = retry.data;
    error = retry.error;
  }
  if (error || !payment) throw error || new Error("Payment insert failed");
  await supabase.from("students").update({
    paid_amount: calc.paidAmount,
    remaining_amount: calc.remainingAmount,
    payment_status: calc.paymentStatus,
  }).eq("id", student.id);
  await supabase.from("cashbook").insert({
    cashbook_code: await codeFor("CASH", "cashbook", "cashbook_code"),
    date: row.payment_date,
    type: "Income",
    category: "Student Payment",
    description: `Payment from ${student.student_name}`,
    amount: paymentAmount,
    related_student_id: student.id,
    related_payment_id: payment.id,
    notes: row.notes,
  });
  await addAudit("Record payment", "Payment", payment.payment_code, `Recorded payment for ${student.student_name}`);
  return payment;
}

export async function createInvoice(studentId: string, notes = "") {
  const supabase = getSupabaseAdmin();
  const { data: student, error: studentError } = await supabase.from("students").select("*").eq("id", studentId).single<Student>();
  if (studentError || !student) throw studentError || new Error("Student not found");
  const invoiceCode = await codeFor("INV", "invoices", "invoice_code");
  const { data, error } = await supabase.from("invoices").insert({
    invoice_code: invoiceCode,
    student_id: student.id,
    student_code: student.student_code,
    student_name: student.student_name,
    invoice_date: todayIso(),
    course: student.course,
    group_name: student.group_name,
    course_price: student.course_price,
    paid_amount: student.paid_amount,
    remaining_amount: student.remaining_amount,
    payment_status: student.payment_status,
    notes,
  }).select("*").single();
  if (error) throw error;
  await addAudit("Generate invoice", "Invoice", data.invoice_code, `Generated invoice for ${student.student_name}`);
  return data;
}

export async function createCashbookEntry(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const cashbookCode = await codeFor("CASH", "cashbook", "cashbook_code");
  const { data, error } = await supabase.from("cashbook").insert({
    cashbook_code: cashbookCode,
    date: String(payload.date || todayIso()),
    type: String(payload.type || "Expense"),
    category: String(payload.category || "").trim() || null,
    description: String(payload.description || "").trim() || null,
    amount: Number(payload.amount || 0),
    notes: String(payload.notes || "").trim() || null,
  }).select("*").single();
  if (error) throw error;
  await addAudit("Add cashbook entry", "Cashbook", data.cashbook_code, `Added ${data.type} cashbook entry`);
  return data;
}

export async function updateSetting(key: string, value: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }).select("*").single();
  if (error) throw error;
  await addAudit("Update setting", "Setting", key, `Updated ${key}`);
  return data;
}

export async function createBackupRecord(fileName: string, backupType: string) {
  const supabase = getSupabaseAdmin();
  const backupCode = await codeFor("BKP", "backups", "backup_code");
  const { data, error } = await supabase.from("backups").insert({
    backup_code: backupCode,
    file_name: fileName,
    backup_type: backupType,
    tables_included: [...backupTables],
    notes: "Created from in-app full backup",
  }).select("*").single();
  if (error) throw error;
  await addAudit("Download backup", "Backup", data.backup_code, `Downloaded full backup ${fileName}`);
  return data;
}

export async function readBackupTables() {
  const entries = await Promise.all(backupTables.map(async (table) => [table, await readTable(table)] as const));
  return Object.fromEntries(entries);
}
