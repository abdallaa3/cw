"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/toast";
import { saveGroupAction, deleteGroupAction } from "@/lib/actions";
import { GROUP_TYPES, SUBSCRIPTION_TYPES, WEEKDAYS, type Group } from "@/lib/types";
import { formatTime } from "@/lib/utils";

const REGIONS = ["زقازيق", "عبور", "أونلاين", "غيره"];
const TYPE_LABEL: Record<string, string> = { online: "أونلاين", offline: "حضوري" };
const SUB_LABEL: Record<string, string> = { monthly: "شهري", term: "ترم" };

type FormState = {
  group_number: string;
  region: string;
  type: string;
  subscription_type: string;
  branch: string;
  day1: string;
  start_time1: string;
  end_time1: string;
  day2: string;
  start_time2: string;
  end_time2: string;
  notes: string;
};

const EMPTY: FormState = {
  group_number: "",
  region: "زقازيق",
  type: "offline",
  subscription_type: "monthly",
  branch: "",
  day1: "السبت",
  start_time1: "18:00",
  end_time1: "20:00",
  day2: "",
  start_time2: "",
  end_time2: "",
  notes: "",
};

function scheduleText(g: Group): string {
  const parts: string[] = [];
  if (g.day1) parts.push(`${g.day1} ${formatTime(g.start_time1)}${g.end_time1 ? ` - ${formatTime(g.end_time1)}` : ""}`.trim());
  if (g.day2) parts.push(`${g.day2} ${formatTime(g.start_time2)}${g.end_time2 ? ` - ${formatTime(g.end_time2)}` : ""}`.trim());
  return parts.join(" — ");
}

export function GroupsView({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [editing, setEditing] = useState<Group | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => groups.filter((g) => (!region || g.region === region) && (!type || g.type === type)),
    [groups, region, type],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setOpen(true);
  }

  function openEdit(g: Group) {
    setEditing(g);
    setForm({
      group_number: g.group_number,
      region: g.region,
      type: g.type,
      subscription_type: g.subscription_type,
      branch: g.branch ?? "",
      day1: g.day1 ?? "",
      start_time1: g.start_time1 ?? "",
      end_time1: g.end_time1 ?? "",
      day2: g.day2 ?? "",
      start_time2: g.start_time2 ?? "",
      end_time2: g.end_time2 ?? "",
      notes: g.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError("");
    const payload = { ...form, branch: form.type === "offline" ? form.branch : "" };
    const res = await saveGroupAction(editing?.id ?? null, payload);
    setSaving(false);
    if (res.ok) {
      toast(editing ? "تم تعديل الجروب" : "تم إضافة الجروب");
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function remove(g: Group) {
    if (!confirm(`حذف الجروب ${g.group_number}؟ الطلاب المرتبطون لن يُحذفوا (سيصبحون بدون جروب).`)) return;
    const res = await deleteGroupAction(g.id);
    if (res.ok) {
      toast("تم حذف الجروب");
      router.refresh();
    } else {
      toast(res.error, "error");
    }
  }

  return (
    <>
      <div className="toolbar">
        <select className="field" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">كل المناطق</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {GROUP_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={openCreate}>+ إضافة جروب</button>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState text="لا توجد جروبات" emoji="📚" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>رقم الجروب</th><th>النوع</th><th>الفرع / المنطقة</th><th>الميعاد</th>
                <th>الاشتراك</th><th>عدد الطلاب</th><th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 700 }}>{g.group_number}</td>
                  <td><span className="badge">{TYPE_LABEL[g.type]}</span></td>
                  <td className="muted">{g.type === "offline" ? (g.branch || g.region) : g.region}</td>
                  <td className="muted" style={{ fontSize: ".82rem" }}>{scheduleText(g) || "—"}</td>
                  <td className="muted">{SUB_LABEL[g.subscription_type]}</td>
                  <td>{g.students_count ?? 0}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(g)}>تعديل</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(g)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={editing ? "تعديل جروب" : "إضافة جروب"} onClose={() => setOpen(false)}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">رقم الجروب *</label>
              <input className="form-control" value={form.group_number} onChange={(e) => setForm({ ...form, group_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">النوع</label>
              <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {GROUP_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">المنطقة *</label>
              <select className="form-control" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">نوع الاشتراك</label>
              <select className="form-control" value={form.subscription_type} onChange={(e) => setForm({ ...form, subscription_type: e.target.value })}>
                {SUBSCRIPTION_TYPES.map((s) => <option key={s} value={s}>{SUB_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          {form.type === "offline" && (
            <div className="form-group">
              <label className="form-label">الفرع (Branch)</label>
              <input className="form-control" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="اكتب اسم الفرع" />
            </div>
          )}

          <div className="section-title" style={{ margin: "6px 0 10px" }}><span className="dot" /> الميعاد الأول *</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">اليوم</label>
              <select className="form-control" value={form.day1} onChange={(e) => setForm({ ...form, day1: e.target.value })}>
                {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">من</label>
              <input className="form-control" type="time" value={form.start_time1} onChange={(e) => setForm({ ...form, start_time1: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">إلى</label>
              <input className="form-control" type="time" value={form.end_time1} onChange={(e) => setForm({ ...form, end_time1: e.target.value })} />
            </div>
          </div>

          <div className="section-title" style={{ margin: "6px 0 10px" }}><span className="dot" /> الميعاد الثاني (اختياري)</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">اليوم</label>
              <select className="form-control" value={form.day2} onChange={(e) => setForm({ ...form, day2: e.target.value })}>
                <option value="">بدون</option>
                {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">من</label>
              <input className="form-control" type="time" value={form.start_time2} onChange={(e) => setForm({ ...form, start_time2: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">إلى</label>
              <input className="form-control" type="time" value={form.end_time2} onChange={(e) => setForm({ ...form, end_time2: e.target.value })} />
            </div>
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
    </>
  );
}
