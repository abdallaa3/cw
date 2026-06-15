// Server-side data layer — mirrors the Flask routes/business logic.
// All access goes through the service-role client (RLS bypassed).
import { getSupabaseAdmin } from "./supabase";
import { todayIso } from "./utils";
import type {
  AuditLog,
  CashBalances,
  CashEntry,
  DashboardData,
  Group,
  Payment,
  Receiver,
  Student,
} from "./types";

const RECEIVERS: Receiver[] = ["محمد", "عبدالله"];

export async function addAudit(
  actor: string,
  action: string,
  entity: string,
  entityId: string | null,
  description: string,
  details?: Record<string, unknown>,
) {
  const supabase = getSupabaseAdmin();
  await supabase.from("audit_logs").insert({
    actor: actor || "system",
    action,
    entity,
    entity_id: entityId,
    description,
    details: details ? details : null,
  });
}

// ── GROUPS ──────────────────────────────────────────────────────────────────
export async function listGroups(filters: {
  region?: string;
  type?: string;
  subscription_type?: string;
} = {}): Promise<Group[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("groups").select("*").order("created_at", { ascending: false });
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.subscription_type) query = query.eq("subscription_type", filters.subscription_type);
  const { data: groups, error } = await query;
  if (error) throw error;

  const { data: students } = await supabase.from("students").select("id, group_id");
  const counts = new Map<string, number>();
  for (const s of students ?? []) {
    if (s.group_id) counts.set(s.group_id, (counts.get(s.group_id) ?? 0) + 1);
  }
  return (groups ?? []).map((g) => ({ ...g, students_count: counts.get(g.id) ?? 0 })) as Group[];
}

export async function getGroup(id: string): Promise<(Group & { students: Student[] }) | null> {
  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase.from("groups").select("*").eq("id", id).single();
  if (!group) return null;
  const students = await listStudents({ group_id: id });
  return { ...(group as Group), students_count: students.length, students };
}

export async function createGroup(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const row = {
    group_number: String(payload.group_number ?? "").trim(),
    region: String(payload.region ?? "").trim(),
    type: String(payload.type ?? "offline"),
    subscription_type: String(payload.subscription_type ?? "monthly"),
    notes: String(payload.notes ?? "").trim() || null,
  };
  if (!row.group_number || !row.region) throw new Error("رقم الجروب والمنطقة مطلوبان");
  const { data, error } = await supabase.from("groups").insert(row).select("*").single();
  if (error) throw error;
  await addAudit("system", "create", "group", data.id, `إضافة جروب جديد — ${data.group_number}`, row);
  return data as Group;
}

export async function updateGroup(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  for (const key of ["group_number", "region", "type", "subscription_type"]) {
    if (payload[key] != null) patch[key] = String(payload[key]).trim();
  }
  if ("notes" in payload) patch.notes = String(payload.notes ?? "").trim() || null;
  const { data, error } = await supabase.from("groups").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await addAudit("system", "update", "group", id, `تعديل الجروب — ${data.group_number}`, patch);
  return data as Group;
}

export async function deleteGroup(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: group } = await supabase.from("groups").select("group_number").eq("id", id).single();
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) throw error;
  await addAudit("system", "delete", "group", id, `حذف الجروب — ${group?.group_number ?? ""}`, {
    group_number: group?.group_number,
  });
  return true;
}

// ── STUDENTS ────────────────────────────────────────────────────────────────
function attachDerived(
  student: Record<string, unknown>,
  groupsById: Map<string, Group>,
  paidByStudent: Map<string, number>,
): Student {
  const group = student.group_id ? groupsById.get(student.group_id as string) : undefined;
  const total = Number(student.total_amount ?? 0);
  const paid = paidByStudent.get(student.id as string) ?? 0;
  return {
    ...(student as object),
    group_number: group?.group_number ?? null,
    region: group?.region ?? null,
    paid_amount: paid,
    remaining_amount: total - paid,
  } as Student;
}

export async function listStudents(filters: {
  group_id?: string;
  search?: string;
  paid?: "yes" | "no";
} = {}): Promise<Student[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("students").select("*").order("created_at", { ascending: false });
  if (filters.group_id) query = query.eq("group_id", filters.group_id);
  if (filters.search) {
    const s = filters.search.trim();
    query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data: students, error } = await query;
  if (error) throw error;

  const [{ data: groups }, { data: payments }] = await Promise.all([
    supabase.from("groups").select("*"),
    supabase.from("payments").select("student_id, amount"),
  ]);
  const groupsById = new Map<string, Group>((groups ?? []).map((g) => [g.id, g as Group]));
  const paidByStudent = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) ?? 0) + Number(p.amount));
  }

  let result = (students ?? []).map((s) => attachDerived(s, groupsById, paidByStudent));
  if (filters.paid === "yes") result = result.filter((s) => s.remaining_amount <= 0);
  else if (filters.paid === "no") result = result.filter((s) => s.remaining_amount > 0);
  return result;
}

export async function getStudent(id: string): Promise<Student | null> {
  const supabase = getSupabaseAdmin();
  const { data: student } = await supabase.from("students").select("*").eq("id", id).single();
  if (!student) return null;
  const [{ data: group }, { data: payments }] = await Promise.all([
    student.group_id
      ? supabase.from("groups").select("*").eq("id", student.group_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("payments").select("*").eq("student_id", id).order("payment_date", { ascending: false }),
  ]);
  const paid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    ...(student as object),
    group_number: (group as Group | null)?.group_number ?? null,
    region: (group as Group | null)?.region ?? null,
    paid_amount: paid,
    remaining_amount: Number(student.total_amount ?? 0) - paid,
    payments: (payments ?? []) as Payment[],
  } as Student;
}

export async function createStudent(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const name = String(payload.name ?? "").trim();
  if (!name) throw new Error("اسم الطالب مطلوب");
  const row = {
    name,
    phone: String(payload.phone ?? "").trim() || null,
    group_id: String(payload.group_id ?? "") || null,
    total_amount: Number(payload.total_amount ?? 0),
    installments: Number(payload.installments ?? 1) || 1,
    installment_amount: Number(payload.installment_amount ?? 0),
    notes: String(payload.notes ?? "").trim() || null,
  };
  const { data, error } = await supabase.from("students").insert(row).select("*").single();
  if (error) throw error;
  await addAudit("system", "create", "student", data.id, `إضافة طالب جديد — ${data.name}`, {
    name: data.name,
    phone: data.phone ?? "",
    group_id: data.group_id,
  });
  return data as Student;
}

export async function updateStudent(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (payload.name != null) {
    const name = String(payload.name).trim();
    if (!name) throw new Error("اسم الطالب لا يمكن أن يكون فارغاً");
    patch.name = name;
  }
  if ("phone" in payload) patch.phone = String(payload.phone ?? "").trim() || null;
  if ("group_id" in payload) patch.group_id = String(payload.group_id ?? "") || null;
  if ("total_amount" in payload) patch.total_amount = Number(payload.total_amount ?? 0);
  if ("installments" in payload) patch.installments = Number(payload.installments ?? 1) || 1;
  if ("installment_amount" in payload) patch.installment_amount = Number(payload.installment_amount ?? 0);
  if ("notes" in payload) patch.notes = String(payload.notes ?? "").trim() || null;
  const { data, error } = await supabase.from("students").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await addAudit("system", "update", "student", id, `تعديل بيانات الطالب — ${data.name}`, patch);
  return data as Student;
}

export async function deleteStudent(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: student } = await supabase.from("students").select("name").eq("id", id).single();
  await addAudit("system", "delete", "student", id, `حذف الطالب — ${student?.name ?? ""}`, {
    name: student?.name,
  });
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
  return true;
}

// ── PAYMENTS ────────────────────────────────────────────────────────────────
export async function listPayments(filters: {
  student_id?: string;
  received_by?: string;
  method?: string;
  date_from?: string;
  date_to?: string;
} = {}): Promise<{ data: Payment[]; total: number }> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("payments").select("*").order("payment_date", { ascending: false });
  if (filters.student_id) query = query.eq("student_id", filters.student_id);
  if (filters.received_by) query = query.eq("received_by", filters.received_by);
  if (filters.method) query = query.eq("method", filters.method);
  if (filters.date_from) query = query.gte("payment_date", filters.date_from);
  if (filters.date_to) query = query.lte("payment_date", filters.date_to);
  const { data: payments, error } = await query;
  if (error) throw error;

  const [{ data: students }, { data: groups }] = await Promise.all([
    supabase.from("students").select("id, name, group_id"),
    supabase.from("groups").select("id, group_number"),
  ]);
  const studentsById = new Map((students ?? []).map((s) => [s.id, s]));
  const groupsById = new Map((groups ?? []).map((g) => [g.id, g]));

  const data = (payments ?? []).map((p) => {
    const s = studentsById.get(p.student_id);
    return {
      ...p,
      student_name: s?.name ?? null,
      group_number: s?.group_id ? groupsById.get(s.group_id)?.group_number ?? null : null,
    } as Payment;
  });
  const total = data.reduce((sum, p) => sum + Number(p.amount), 0);
  return { data, total };
}

export async function createPayment(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const studentId = String(payload.student_id ?? "");
  const amount = Number(payload.amount ?? 0);
  const method = String(payload.method ?? "cash");
  const receivedBy = String(payload.received_by ?? "") as Receiver;
  if (!studentId || amount <= 0 || !method || !receivedBy) {
    throw new Error("الحقول المطلوبة ناقصة: الطالب، المبلغ، الطريقة، المستلم");
  }
  const { data: student } = await supabase.from("students").select("id, name").eq("id", studentId).single();
  if (!student) throw new Error("الطالب غير موجود");

  const row = {
    student_id: studentId,
    amount,
    method,
    received_by: receivedBy,
    payment_date: String(payload.payment_date || todayIso()),
    image_path: String(payload.image_path ?? "") || null,
    notes: String(payload.notes ?? "").trim() || null,
  };
  const { data: payment, error } = await supabase.from("payments").insert(row).select("*").single();
  if (error) throw error;

  if (RECEIVERS.includes(receivedBy)) {
    let cashNote = `دفعة من ${student.name}`;
    if (row.notes) cashNote += ` — ${row.notes}`;
    await supabase.from("cash_entries").insert({
      owner: receivedBy,
      entry_type: "in",
      amount,
      notes: cashNote,
      entry_date: row.payment_date,
      linked_payment_id: payment.id,
      linked_student_id: studentId,
    });
  }

  await addAudit(
    receivedBy,
    "create",
    "payment",
    payment.id,
    `تسجيل دفعة جديدة — ${student.name} — ${amount} ج — ${method}`,
    { student_id: studentId, amount, method, date: row.payment_date },
  );
  return payment as Payment;
}

export async function updatePayment(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if ("amount" in payload) patch.amount = Number(payload.amount ?? 0);
  if ("method" in payload) patch.method = String(payload.method);
  if ("received_by" in payload) patch.received_by = String(payload.received_by);
  if ("payment_date" in payload) patch.payment_date = String(payload.payment_date);
  if ("image_path" in payload) patch.image_path = String(payload.image_path ?? "") || null;
  if ("notes" in payload) patch.notes = String(payload.notes ?? "").trim() || null;
  const { data: payment, error } = await supabase.from("payments").update(patch).eq("id", id).select("*").single();
  if (error) throw error;

  const { data: linked } = await supabase
    .from("cash_entries")
    .select("id")
    .eq("linked_payment_id", id)
    .maybeSingle();
  if (linked) {
    await supabase
      .from("cash_entries")
      .update({ amount: Number(payment.amount), owner: payment.received_by, entry_date: payment.payment_date })
      .eq("id", linked.id);
  }

  const { data: student } = await supabase.from("students").select("name").eq("id", payment.student_id).single();
  await addAudit(payment.received_by, "update", "payment", id, `تعديل دفعة — ${student?.name ?? ""} — ${payment.amount} ج`, patch);
  return payment as Payment;
}

export async function deletePayment(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: payment } = await supabase.from("payments").select("*").eq("id", id).single();
  if (!payment) return true;
  const { data: student } = await supabase.from("students").select("name").eq("id", payment.student_id).single();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
  await addAudit(payment.received_by, "delete", "payment", id, `حذف دفعة — ${student?.name ?? ""} — ${payment.amount} ج`, {
    student_name: student?.name,
    amount: payment.amount,
  });
  return true;
}

// ── CASHBOOK ────────────────────────────────────────────────────────────────
export async function listCashbook(filters: { owner?: string; type?: string } = {}): Promise<{
  data: CashEntry[];
  balances: CashBalances;
}> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("cash_entries")
    .select("*")
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (filters.owner) query = query.eq("owner", filters.owner);
  if (filters.type) query = query.eq("entry_type", filters.type);
  const { data: entries, error } = await query;
  if (error) throw error;

  const [{ data: allEntries }, { data: students }] = await Promise.all([
    supabase.from("cash_entries").select("owner, entry_type, amount"),
    supabase.from("students").select("id, name"),
  ]);
  const studentsById = new Map((students ?? []).map((s) => [s.id, s.name]));
  const balances: CashBalances = { محمد: 0, عبدالله: 0 };
  for (const e of allEntries ?? []) {
    if (e.owner in balances) {
      balances[e.owner as Receiver] += e.entry_type === "in" ? Number(e.amount) : -Number(e.amount);
    }
  }

  const data = (entries ?? []).map((e) => ({
    ...e,
    linked_student_name: e.linked_student_id ? studentsById.get(e.linked_student_id) ?? null : null,
  })) as CashEntry[];
  return { data, balances };
}

export async function createCashEntry(payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const owner = String(payload.owner ?? "").trim() as Receiver;
  const entryType = String(payload.entry_type ?? "").trim();
  const amount = Number(payload.amount ?? 0);
  if (!RECEIVERS.includes(owner)) throw new Error("owner يجب أن يكون محمد أو عبدالله");
  if (entryType !== "in" && entryType !== "out") throw new Error("entry_type يجب أن يكون in أو out");
  if (amount <= 0) throw new Error("المبلغ مطلوب");
  const row = {
    owner,
    entry_type: entryType,
    amount,
    notes: String(payload.notes ?? "").trim() || null,
    entry_date: String(payload.entry_date || todayIso()),
    linked_student_id: String(payload.linked_student_id ?? "") || null,
  };
  const { data, error } = await supabase.from("cash_entries").insert(row).select("*").single();
  if (error) throw error;
  await addAudit(owner, "create", "cashbook", data.id, `إضافة حركة خزينة — ${owner} — ${entryType === "in" ? "دخل" : "مصروف"} — ${amount} ج`, row);
  return data as CashEntry;
}

export async function updateCashEntry(id: string, payload: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if ("amount" in payload) patch.amount = Number(payload.amount ?? 0);
  if ("notes" in payload) patch.notes = String(payload.notes ?? "").trim() || null;
  if ("entry_date" in payload) patch.entry_date = String(payload.entry_date);
  if (payload.entry_type === "in" || payload.entry_type === "out") patch.entry_type = payload.entry_type;
  if (payload.owner === "محمد" || payload.owner === "عبدالله") patch.owner = payload.owner;
  if ("linked_student_id" in payload) patch.linked_student_id = String(payload.linked_student_id ?? "") || null;
  const { data, error } = await supabase.from("cash_entries").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  await addAudit(data.owner, "update", "cashbook", id, `تعديل حركة خزينة — ${data.owner} — ${data.amount} ج`, patch);
  return data as CashEntry;
}

export async function deleteCashEntry(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: entry } = await supabase.from("cash_entries").select("*").eq("id", id).single();
  if (!entry) return true;
  if (entry.linked_payment_id) {
    throw new Error("هذه الحركة مرتبطة بدفعة طالب، احذف الدفعة من صفحة الدفعات");
  }
  await addAudit(entry.owner, "delete", "cashbook", id, `حذف حركة خزينة — ${entry.owner} — ${entry.amount} ج`, {
    owner: entry.owner,
    amount: entry.amount,
    notes: entry.notes ?? "",
  });
  const { error } = await supabase.from("cash_entries").delete().eq("id", id);
  if (error) throw error;
  return true;
}

// ── AUDIT LOG ───────────────────────────────────────────────────────────────
export async function listAuditLogs(filters: {
  actor?: string;
  action?: string;
  entity?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  limit?: number;
} = {}): Promise<AuditLog[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(filters.limit ?? 500);
  if (filters.actor) query = query.eq("actor", filters.actor);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entity) query = query.eq("entity", filters.entity);
  if (filters.date_from) query = query.gte("created_at", `${filters.date_from} 00:00:00`);
  if (filters.date_to) query = query.lte("created_at", `${filters.date_to} 23:59:59`);
  if (filters.search) query = query.ilike("description", `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((l) => ({
    ...l,
    details: l.details ? (typeof l.details === "string" ? l.details : JSON.stringify(l.details)) : null,
  })) as AuditLog[];
}

// ── DASHBOARD ───────────────────────────────────────────────────────────────
export async function getDashboard(): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();
  const [{ data: students }, { data: payments }, { data: groups }] = await Promise.all([
    supabase.from("students").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("groups").select("*"),
  ]);

  const paidByStudent = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByStudent.set(p.student_id, (paidByStudent.get(p.student_id) ?? 0) + Number(p.amount));
  }

  const total_collected = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const total_expected = (students ?? []).reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const total_students = (students ?? []).length;

  let paid_students_count = 0;
  let not_paid_students_count = 0;
  for (const s of students ?? []) {
    const remaining = Number(s.total_amount ?? 0) - (paidByStudent.get(s.id) ?? 0);
    if (remaining <= 0) paid_students_count += 1;
    else not_paid_students_count += 1;
  }

  const recvMap = new Map<string, { total: number; count: number }>();
  const methodMap = new Map<string, { total: number; count: number }>();
  for (const p of payments ?? []) {
    const r = recvMap.get(p.received_by) ?? { total: 0, count: 0 };
    r.total += Number(p.amount);
    r.count += 1;
    recvMap.set(p.received_by, r);
    const m = methodMap.get(p.method) ?? { total: 0, count: 0 };
    m.total += Number(p.amount);
    m.count += 1;
    methodMap.set(p.method, m);
  }

  const studentsByGroup = new Map<string, Array<Record<string, unknown>>>();
  for (const s of students ?? []) {
    if (!s.group_id) continue;
    const arr = studentsByGroup.get(s.group_id) ?? [];
    arr.push(s);
    studentsByGroup.set(s.group_id, arr);
  }
  const groups_summary = (groups ?? []).map((g) => {
    const gs = studentsByGroup.get(g.id) ?? [];
    const expected = gs.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
    const paid = gs.reduce((sum, s) => sum + (paidByStudent.get(s.id as string) ?? 0), 0);
    return {
      group_id: g.id,
      group_number: g.group_number,
      region: g.region,
      students_count: gs.length,
      total_expected: expected,
      total_paid: paid,
      total_remaining: expected - paid,
    };
  });

  const studentsById = new Map((students ?? []).map((s) => [s.id, s]));
  const groupsById = new Map((groups ?? []).map((g) => [g.id, g]));
  const recent_payments = [...(payments ?? [])]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 8)
    .map((p) => {
      const s = studentsById.get(p.student_id);
      return {
        ...p,
        student_name: s?.name ?? null,
        group_number: s?.group_id ? groupsById.get(s.group_id)?.group_number ?? null : null,
      } as Payment;
    });

  return {
    total_collected,
    total_expected,
    total_remaining: total_expected - total_collected,
    total_students,
    paid_students_count,
    not_paid_students_count,
    receivers_summary: [...recvMap.entries()].map(([received_by, v]) => ({ received_by, ...v })),
    methods_summary: [...methodMap.entries()].map(([method, v]) => ({ method, ...v })),
    groups_summary,
    recent_payments,
  };
}
