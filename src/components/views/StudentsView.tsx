"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { PaymentForm } from "@/components/PaymentForm";
import { toast } from "@/components/toast";
import { saveStudentAction, deleteStudentAction } from "@/lib/actions";
import type { Group, Student } from "@/lib/types";
import { egp } from "@/lib/utils";

type FormState = {
  name: string;
  phone: string;
  group_id: string;
  total_amount: string;
  installments: string;
  installment_amount: string;
  notes: string;
};

const EMPTY: FormState = { name: "", phone: "", group_id: "", total_amount: "", installments: "1", installment_amount: "", notes: "" };

function statusBadge(s: Student) {
  if (s.remaining_amount <= 0 && s.paid_amount > 0) return <span className="badge green">مكتمل</span>;
  if (s.paid_amount > 0) return <span className="badge yellow">جزئي</span>;
  return <span className="badge red">لم يدفع</span>;
}

export function StudentsView({ students, groups }: { students: Student[]; groups: Group[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [paid, setPaid] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<Student | null>(null);

  const studentOptions = useMemo(() => students.map((s) => ({ id: s.id, name: s.name })), [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (groupId && s.group_id !== groupId) return false;
      if (paid === "yes" && s.remaining_amount > 0) return false;
      if (paid === "no" && s.remaining_amount <= 0) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.phone ?? "").includes(q))) return false;
      return true;
    });
  }, [students, search, groupId, paid]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setOpen(true);
  }
  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      group_id: s.group_id ?? "",
      total_amount: String(s.total_amount),
      installments: String(s.installments),
      installment_amount: String(s.installment_amount),
      notes: s.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError("");
    const res = await saveStudentAction(editing?.id ?? null, {
      ...form,
      total_amount: Number(form.total_amount || 0),
      installments: Number(form.installments || 1),
      installment_amount: Number(form.installment_amount || 0),
    });
    setSaving(false);
    if (res.ok) {
      toast(editing ? "تم تعديل الطالب" : "تم إضافة الطالب");
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

  return (
    <>
      <div className="toolbar">
        <input className="field" placeholder="بحث بالاسم أو التليفون..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
        <select className="field" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">كل الجروبات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.group_number}</option>
          ))}
        </select>
        <select className="field" value={paid} onChange={(e) => setPaid(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="yes">دافع بالكامل</option>
          <option value="no">عليه متبقي</option>
        </select>
        <div className="spacer" />
        <span className="badge">{filtered.length} طالب</span>
        <button className="btn btn-primary" onClick={openCreate}>+ إضافة طالب</button>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState text="لا يوجد طلاب" emoji="👨‍🎓" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>الاسم</th><th>التليفون</th><th>الجروب</th><th>الإجمالي</th>
                <th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="muted">{s.phone ?? "—"}</td>
                  <td>{s.group_number ?? <span className="muted">بدون</span>}</td>
                  <td>{egp(s.total_amount)}</td>
                  <td style={{ color: "var(--accent2)" }}>{egp(s.paid_amount)}</td>
                  <td style={{ color: s.remaining_amount > 0 ? "var(--warn)" : "var(--text2)" }}>{egp(s.remaining_amount)}</td>
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
          <div className="form-group">
            <label className="form-label">اسم الطالب</label>
            <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">التليفون</label>
              <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">الجروب</label>
              <select className="form-control" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                <option value="">بدون جروب</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.group_number}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">المبلغ الإجمالي</label>
              <input className="form-control" type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">عدد الأقساط</label>
              <input className="form-control" type="number" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">قيمة القسط الواحد</label>
            <input className="form-control" type="number" value={form.installment_amount} onChange={(e) => setForm({ ...form, installment_amount: e.target.value })} />
          </div>
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
