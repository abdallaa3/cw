"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { PaymentForm } from "@/components/PaymentForm";
import { AdjustmentForm } from "@/components/AdjustmentForm";
import { RenewStudentForm } from "@/components/RenewStudentForm";
import { StudentPaymentsModal } from "@/components/StudentPaymentsModal";
import { toast } from "@/components/toast";
import { saveStudentAction } from "@/lib/actions";
import { deleteStudentAction } from "@/lib/actions";
import { getStoredUser } from "@/components/useCurrentUser";
import { PAYMENT_METHODS, RECEIVERS, type CashBalances, type Group, type Student, type StudentStatusFilter } from "@/lib/types";
import { egp, formatDate, METHOD_LABELS, STUDY_TYPE_LABELS, ONLINE_TYPE_LABELS, todayIso } from "@/lib/utils";
import { writeXlsx } from "@/lib/xlsx";

type FormState = {
  name: string;
  phone: string;
  age: string;
  study_type: string;
  online_type: string;
  branch: string;
  group_id: string;
  total_amount: string;
  installments: string;
  installment_amount: string;
  next_due_date: string;
  notes: string;
  first_payment_amount: string;
  received_by: string;
  method: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    phone: "",
    age: "",
    study_type: "offline",
    online_type: "group",
    branch: "",
    group_id: "",
    total_amount: "",
    installments: "1",
    installment_amount: "",
    next_due_date: "",
    notes: "",
    first_payment_amount: "",
    received_by: getStoredUser(),
    method: "cash",
  };
}

function statusBadge(s: Student) {
  if (s.remaining_amount <= 0 && s.paid_amount > 0) return <span className="badge green">مكتمل</span>;
  if (s.paid_amount > 0) return <span className="badge yellow">جزئي</span>;
  return <span className="badge red">لم يدفع</span>;
}

export function StudentsView({
  students,
  groups,
  balances,
}: {
  students: Student[];
  groups: Group[];
  balances: CashBalances;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [filter, setFilter] = useState(""); // "" | no_group | online | offline | owed
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<Student | null>(null);
  const [adjFor, setAdjFor] = useState<{ id: string; name: string } | null>(null);
  const [renewFor, setRenewFor] = useState<Student | null>(null);
  const [trackFor, setTrackFor] = useState<Student | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Close the dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => { setOpenMenuId(null); setMenuPos(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  // "students" includes both active and archived rows — filtered client-side
  // so switching Active/Archived/All never needs a re-fetch.
  const studentOptions = useMemo(
    () => students.filter((s) => !s.archived_at).map((s) => ({ id: s.id, name: s.name })),
    [students],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter === "active" && s.archived_at) return false;
      if (statusFilter === "archived" && !s.archived_at) return false;
      if (groupId && s.group_id !== groupId) return false;
      if (filter === "no_group" && s.group_id) return false;
      if (filter === "online" && s.study_type !== "online") return false;
      if (filter === "offline" && s.study_type !== "offline") return false;
      if (filter === "owed" && s.remaining_amount <= 0) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.phone ?? "").includes(q))) return false;
      return true;
    });
  }, [students, search, groupId, filter, statusFilter]);

  // Students with no group first, to make them easy to spot.
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => Number(!!a.group_id) - Number(!!b.group_id)),
    [filtered],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  }
  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      ...emptyForm(),
      name: s.name,
      phone: s.phone ?? "",
      age: s.age != null ? String(s.age) : "",
      study_type: s.study_type ?? "offline",
      online_type: s.online_type ?? "group",
      branch: s.branch ?? "",
      group_id: s.group_id ?? "",
      total_amount: String(s.total_amount),
      installments: String(s.installments),
      installment_amount: String(s.installment_amount),
      next_due_date: s.next_due_date ?? "",
      notes: s.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError("");
    const base = {
      name: form.name,
      phone: form.phone,
      age: form.age,
      study_type: form.study_type,
      online_type: form.study_type === "online" ? form.online_type : "",
      branch: form.study_type === "offline" ? form.branch : "",
      group_id: form.group_id,
      total_amount: Number(form.total_amount || 0),
      installments: Number(form.installments || 1),
      installment_amount: Number(form.installment_amount || 0),
      next_due_date: form.next_due_date,
      notes: form.notes,
    };
    const firstAmount = Number(form.first_payment_amount || 0);
    const payload = editing
      ? base
      : {
          ...base,
          first_payment_amount: firstAmount,
          received_by: form.received_by,
          method: form.method,
          payment_date: todayIso(),
        };
    const res = await saveStudentAction(editing?.id ?? null, payload);
    setSaving(false);
    if (res.ok) {
      const msg = editing
        ? "تم تعديل الطالب"
        : firstAmount > 0
        ? "تم إضافة الطالب وتسجيل الدفعة الأولى"
        : "تم إضافة الطالب";
      toast(msg);
      setOpen(false);
      router.refresh();
    } else setError(res.error);
  }

  async function remove(s: Student) {
    if (!confirm(`حذف الطالب ${s.name}؟ سيتم حذف دفعاته المرتبطة أيضاً.`)) return;
    const res = await deleteStudentAction(s.id);
    if (res.ok) {
      toast("تم حذف الطالب");
      router.refresh();
    } else toast(res.error, "error");
  }

  // Opens the fixed-position ⋯ dropdown.
  // Always uses a single clamped `left` — never both left+right — to prevent stretching.
  // Flips upward when the menu would overflow the bottom of the viewport.
  function openMenu(e: MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    if (openMenuId === id) { setOpenMenuId(null); setMenuPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 210;
    const student = ordered.find((s) => s.id === id);
    const menuH = student?.archived_at ? 90 : 220;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Anchor left edge to button's right minus menuW, then clamp within viewport
    let left = rect.right - menuW;
    if (left < margin) left = margin;
    if (left + menuW > vw - margin) left = vw - menuW - margin;
    // Open below; flip above if near the bottom edge
    let top = rect.bottom + 8;
    if (top + menuH > vh - margin) top = Math.max(margin, rect.top - menuH - 4);
    setMenuPos({ top, left });
    setOpenMenuId(id);
  }

  async function exportStudents() {
    try {
      const rows: (string | number)[][] = [
        ["id", "الاسم", "التليفون", "السن", "نوع الدراسة", "أونلاين", "الفرع", "الجروب", "الإجمالي", "مدفوع", "متبقي", "تاريخ الاستحقاق", "ملاحظات"],
        ...students.map((s) => [
          s.id,
          s.name,
          s.phone ?? "",
          s.age ?? "",
          STUDY_TYPE_LABELS[s.study_type] ?? s.study_type,
          s.online_type ? ONLINE_TYPE_LABELS[s.online_type] ?? s.online_type : "",
          s.branch ?? "",
          s.group_number ?? "",
          s.total_amount,
          s.paid_amount,
          s.remaining_amount,
          s.next_due_date ?? "",
          s.notes ?? "",
        ]),
      ];
      const blob = await writeXlsx([{ name: "الطلاب", rows }]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${todayIso()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("تم تصدير الطلاب");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التصدير", "error");
    }
  }

  const firstAmount = Number(form.first_payment_amount || 0);
  const openStudent = openMenuId ? (ordered.find((s) => s.id === openMenuId) ?? null) : null;

  return (
    <>
      <div className="balance-chips">
        <span className="balance-chip m"><span className="lbl">رصيد محمد</span><span className="val">{egp(balances["محمد"])}</span></span>
        <span className="balance-chip a"><span className="lbl">رصيد عبدالله</span><span className="val">{egp(balances["عبدالله"])}</span></span>
      </div>

      <div className="toolbar students-toolbar">
        <input className="field" placeholder="بحث بالاسم أو التليفون..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">كل الجروبات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.group_number}</option>
          ))}
        </select>
        <select className="field" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">الكل</option>
          <option value="no_group">بدون جروب</option>
          <option value="online">أونلاين</option>
          <option value="offline">حضوري</option>
          <option value="owed">عليهم فلوس</option>
        </select>
        <select className="field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StudentStatusFilter)}>
          <option value="active">نشط</option>
          <option value="archived">مؤرشف (تم تجديده)</option>
          <option value="all">الكل (نشط + مؤرشف)</option>
        </select>
        <div className="spacer" />
        <span className="badge">{ordered.length} طالب</span>
        <button className="btn btn-success" onClick={exportStudents}>📥 تصدير</button>
        <button className="btn btn-primary" onClick={openCreate}>+ إضافة طالب</button>
      </div>

      <div className="table-wrap">
        {ordered.length === 0 ? (
          <EmptyState text="لا يوجد طلاب" emoji="👨‍🎓" />
        ) : (
          <table className="table-compact">
            <thead>
              <tr>
                {/* Phone column removed from table — still searchable and visible in modals */}
                <th>الاسم</th><th>النوع</th><th>الجروب</th><th>الإجمالي</th>
                <th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <span className="badge">{STUDY_TYPE_LABELS[s.study_type] ?? s.study_type}</span>
                    {s.study_type === "online" && s.online_type ? <span className="muted" style={{ fontSize: ".75rem" }}> {ONLINE_TYPE_LABELS[s.online_type]}</span> : null}
                    {s.study_type === "offline" && s.branch ? <span className="muted" style={{ fontSize: ".75rem" }}> {s.branch}</span> : null}
                  </td>
                  <td>{s.group_number ?? <span className="badge yellow">بدون جروب</span>}</td>
                  <td>{egp(s.total_amount)}</td>
                  <td style={{ color: "var(--accent2)" }}>{egp(s.paid_amount)}</td>
                  <td style={{ color: s.remaining_amount > 0 ? "var(--warn)" : "var(--text2)" }}>
                    {egp(s.remaining_amount)}
                    {s.remaining_amount > 0 && s.next_due_date ? <span className="muted" style={{ fontSize: ".72rem", display: "block" }}>استحقاق {formatDate(s.next_due_date)}</span> : null}
                  </td>
                  <td>
                    {s.archived_at ? <span className="badge" style={{ opacity: .8 }}>مؤرشف — تم التجديد</span> : statusBadge(s)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {s.archived_at ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <Link className="btn btn-outline btn-sm" href={`/invoice?student=${s.id}`}>فاتورة</Link>
                        <div className="actions-menu">
                          <button className="btn btn-outline btn-sm" onClick={(e) => openMenu(e, s.id)}>⋯</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button className="btn btn-success btn-sm" onClick={() => setPayFor(s)}>دفع</button>
                        <Link className="btn btn-outline btn-sm" href={`/invoice?student=${s.id}`}>فاتورة</Link>
                        <div className="actions-menu">
                          <button className="btn btn-outline btn-sm" onClick={(e) => openMenu(e, s.id)}>⋯</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Fixed-position dropdown — rendered outside table-wrap to avoid overflow clipping */}
      {openStudent && menuPos && (
        <div
          className="actions-dropdown"
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {openStudent.archived_at ? (
            <>
              <button onClick={() => { openEdit(openStudent); setOpenMenuId(null); setMenuPos(null); }}>تعديل</button>
              <hr className="dropdown-divider" />
              <button className="danger" onClick={() => { void remove(openStudent); setOpenMenuId(null); setMenuPos(null); }}>حذف</button>
            </>
          ) : (
            <>
              <button onClick={() => { setTrackFor(openStudent); setOpenMenuId(null); setMenuPos(null); }}>تتبع الدفعات</button>
              <button onClick={() => { setRenewFor(openStudent); setOpenMenuId(null); setMenuPos(null); }}>تجديد الاشتراك</button>
              <button onClick={() => { setAdjFor({ id: openStudent.id, name: openStudent.name }); setOpenMenuId(null); setMenuPos(null); }}>خصم / استرداد</button>
              <button onClick={() => { openEdit(openStudent); setOpenMenuId(null); setMenuPos(null); }}>تعديل</button>
              <hr className="dropdown-divider" />
              <button className="danger" onClick={() => { void remove(openStudent); setOpenMenuId(null); setMenuPos(null); }}>حذف</button>
            </>
          )}
        </div>
      )}

      {open && (
        <Modal title={editing ? "تعديل طالب" : "إضافة طالب"} onClose={() => setOpen(false)}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">اسم الطالب *</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">التليفون</label>
              <input className="form-control" type="text" inputMode="numeric" pattern="[0-9]*" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">السن</label>
              <input className="form-control" type="text" inputMode="numeric" pattern="[0-9]*" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">نوع الدراسة *</label>
              <select className="form-control" value={form.study_type} onChange={(e) => setForm({ ...form, study_type: e.target.value })}>
                <option value="offline">حضوري (Offline)</option>
                <option value="online">أونلاين (Online)</option>
              </select>
            </div>
          </div>
          {form.study_type === "online" ? (
            <div className="form-group">
              <label className="form-label">نوع الأونلاين</label>
              <select className="form-control" value={form.online_type} onChange={(e) => setForm({ ...form, online_type: e.target.value })}>
                <option value="group">جروب (Group)</option>
                <option value="private">خصوصي (Private)</option>
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">الفرع (Branch)</label>
              <input className="form-control" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="اكتب اسم الفرع" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">الجروب (اختياري — يمكن تعيينه لاحقاً)</label>
            <select className="form-control" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
              <option value="">بدون جروب</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.group_number}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">سعر الكورس / الإجمالي *</label>
              <input className="form-control" type="text" inputMode="decimal" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">تاريخ استحقاق القسط القادم (اختياري)</label>
              <input className="form-control" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">عدد الأقساط</label>
              <input className="form-control" type="text" inputMode="numeric" pattern="[0-9]*" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">قيمة القسط الواحد</label>
              <input className="form-control" type="text" inputMode="decimal" value={form.installment_amount} onChange={(e) => setForm({ ...form, installment_amount: e.target.value })} />
            </div>
          </div>

          {!editing && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>
                <span className="dot" /> الدفعة الأولى <span className="muted" style={{ fontWeight: 400, fontSize: ".8rem" }}>(اختياري — يمكن تسجيلها لاحقاً)</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">مبلغ الدفعة الأولى</label>
                  <input
                    className="form-control"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.first_payment_amount}
                    onChange={(e) => setForm({ ...form, first_payment_amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">المستلم {firstAmount > 0 ? "*" : ""}</label>
                  <select
                    className={`form-control ${firstAmount > 0 && RECEIVERS.includes(form.received_by as (typeof RECEIVERS)[number]) ? "receiver-highlight" : ""}`}
                    value={form.received_by}
                    onChange={(e) => setForm({ ...form, received_by: e.target.value })}
                    disabled={firstAmount === 0}
                  >
                    {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {firstAmount > 0 && RECEIVERS.includes(form.received_by as (typeof RECEIVERS)[number]) && (
                    <div className="receiver-helper">سيتم إضافة المبلغ إلى رصيد {form.received_by}</div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">طريقة الدفع {firstAmount > 0 ? "*" : ""}</label>
                <select
                  className="form-control"
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  disabled={firstAmount === 0}
                >
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">ملاحظات</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</button>
            <button className="btn btn-outline" onClick={() => setOpen(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {payFor && (
        <PaymentForm students={studentOptions} preselectedStudentId={payFor.id} onClose={() => setPayFor(null)} />
      )}

      {adjFor && (
        <AdjustmentForm student={adjFor} onClose={() => setAdjFor(null)} />
      )}

      {renewFor && (
        <RenewStudentForm student={renewFor} groups={groups} onClose={() => setRenewFor(null)} />
      )}

      {trackFor && (
        <StudentPaymentsModal student={trackFor} onClose={() => setTrackFor(null)} />
      )}
    </>
  );
}
