"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { PaymentForm } from "@/components/PaymentForm";
import { toast } from "@/components/toast";
import { saveStudentAction, deleteStudentAction } from "@/lib/actions";
import { getStoredUser } from "@/components/useCurrentUser";
import { PAYMENT_METHODS, RECEIVERS, type Group, type Student } from "@/lib/types";
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

export function StudentsView({ students, groups }: { students: Student[]; groups: Group[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [filter, setFilter] = useState(""); // "" | no_group | online | offline | owed
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<Student | null>(null);

  const studentOptions = useMemo(() => students.map((s) => ({ id: s.id, name: s.name })), [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (groupId && s.group_id !== groupId) return false;
      if (filter === "no_group" && s.group_id) return false;
      if (filter === "online" && s.study_type !== "online") return false;
      if (filter === "offline" && s.study_type !== "offline") return false;
      if (filter === "owed" && s.remaining_amount <= 0) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.phone ?? "").includes(q))) return false;
      return true;
    });
  }, [students, search, groupId, filter]);

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
    const payload = editing
      ? base
      : {
          ...base,
          first_payment_amount: Number(form.first_payment_amount || 0),
          received_by: form.received_by,
          method: form.method,
          payment_date: todayIso(),
        };
    const res = await saveStudentAction(editing?.id ?? null, payload);
    setSaving(false);
    if (res.ok) {
      toast(editing ? "تم تعديل الطالب" : "تم إضافة الطالب وتسجيل الدفعة الأولى");
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

  return (
    <>
      <div className="toolbar">
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
        <div className="spacer" />
        <span className="badge">{ordered.length} طالب</span>
        <button className="btn btn-success" onClick={exportStudents}>📥 تصدير</button>
        <button className="btn btn-primary" onClick={openCreate}>+ إضافة طالب</button>
      </div>

      <div className="table-wrap">
        {ordered.length === 0 ? (
          <EmptyState text="لا يوجد طلاب" emoji="👨‍🎓" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>الاسم</th><th>التليفون</th><th>النوع</th><th>الجروب</th><th>الإجمالي</th>
                <th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}{s.age != null ? <span className="muted" style={{ fontWeight: 400 }}> · {s.age} سنة</span> : null}</td>
                  <td className="muted">{s.phone ?? "—"}</td>
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
                  <td>{statusBadge(s)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-success btn-sm" onClick={() => setPayFor(s)}>دفع</button>{" "}
                    <Link className="btn btn-outline btn-sm" href={`/invoice?student=${s.id}`}>فاتورة</Link>{" "}
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>تعديل</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={editing ? "تعديل طالب" : "إضافة طالب"} onClose={() => setOpen(false)}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">اسم الطالب *</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">التليفون *</label>
              <input className="form-control" type="text" inputMode="numeric" pattern="[0-9]*" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">السن *</label>
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
              <div className="section-title" style={{ marginBottom: 10 }}><span className="dot green" /> الدفعة الأولى (إجبارية)</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">مبلغ الدفعة الأولى *</label>
                  <input className="form-control" type="text" inputMode="decimal" value={form.first_payment_amount} onChange={(e) => setForm({ ...form, first_payment_amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">المستلم *</label>
                  <select className="form-control" value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })}>
                    {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">طريقة الدفع *</label>
                <select className="form-control" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
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
    </>
  );
}
