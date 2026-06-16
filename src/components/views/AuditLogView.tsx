"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import type { AuditLog } from "@/lib/types";
import { ACTION_LABELS, ENTITY_LABELS, formatDate } from "@/lib/utils";

// "renew" has no modifier — the base .badge class is already accent-blue.
const ACTION_COLOR: Record<string, string> = { create: "green", update: "yellow", delete: "red" };

export function AuditLogView({ logs }: { logs: AuditLog[] }) {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actor && l.actor !== actor) return false;
      if (action && l.action !== action) return false;
      if (entity && l.entity !== entity) return false;
      if (q && !l.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, actor, action, entity, search]);

  return (
    <>
      <div className="toolbar">
        <input className="field" placeholder="بحث في الوصف..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="field" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">كل المستخدمين</option>
          <option value="محمد">محمد</option>
          <option value="عبدالله">عبدالله</option>
          <option value="system">النظام</option>
        </select>
        <select className="field" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">كل العمليات</option>
          <option value="create">إضافة</option>
          <option value="update">تعديل</option>
          <option value="delete">حذف</option>
          <option value="renew">تجديد اشتراك</option>
        </select>
        <select className="field" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="student">طالب</option>
          <option value="group">جروب</option>
          <option value="payment">دفعة</option>
          <option value="cashbook">خزينة</option>
        </select>
        <div className="spacer" />
        <span className="badge">{filtered.length} عملية</span>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState text="لا توجد عمليات مسجّلة" emoji="📋" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>المستخدم</th><th>العملية</th><th>النوع</th><th>الوصف</th><th>التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>{l.actor}</td>
                  <td><span className={`badge ${ACTION_COLOR[l.action] ?? ""}`}>{ACTION_LABELS[l.action] ?? l.action}</span></td>
                  <td className="muted">{ENTITY_LABELS[l.entity] ?? l.entity}</td>
                  <td>{l.description}</td>
                  <td className="muted">{formatDate(l.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
