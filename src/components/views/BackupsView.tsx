"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/toast";
import { EmptyState } from "@/components/EmptyState";
import { createBackupAction, listBackupsAction } from "@/lib/actions";
import { formatDate } from "@/lib/utils";

type BackupFile = { name: string; size: number; created_at: string | null; url: string };

function humanSize(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function BackupsView() {
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Fetch helper: all setState calls happen AFTER the await (never synchronously
  // inside the effect body), to satisfy the React-compiler rules.
  async function fetchBackups() {
    const res = await listBackupsAction();
    if (res.ok) { setFiles(res.data as BackupFile[]); setError(""); }
    else setError(res.error);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    listBackupsAction().then((res) => {
      if (!active) return;
      if (res.ok) { setFiles(res.data as BackupFile[]); setError(""); }
      else setError(res.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function createNow() {
    setCreating(true);
    const res = await createBackupAction();
    setCreating(false);
    if (res.ok) { toast("تم إنشاء نسخة احتياطية"); setLoading(true); fetchBackups(); }
    else toast(res.error, "error");
  }

  return (
    <>
      <div className="panel">
        <div className="section-title" style={{ marginBottom: 12 }}><span className="dot" /> النسخ الاحتياطي إلى التخزين السحابي</div>
        <p className="muted" style={{ fontSize: ".86rem", marginBottom: 14 }}>
          تُحفظ النسخة الاحتياطية (الطلاب، الجروبات، الدفعات، الخزينة، سجل العمليات) كملف Excel داخل تخزين Supabase. يمكنك تنزيلها وقت ما تشاء. الملف نفسه قابل لإعادة الاستيراد من صفحة الاستيراد.
        </p>
        <button className="btn btn-success" onClick={createNow} disabled={creating}>
          {creating ? "جاري الإنشاء..." : "تصدير نسخة احتياطية Excel"}
        </button>
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="section-header">
        <div className="section-title"><span className="dot green" /> النسخ المتاحة</div>
        <span className="badge">{files.length}</span>
      </div>
      <div className="table-wrap">
        {loading ? (
          <div className="empty-state"><span className="spinner" /> جاري التحميل...</div>
        ) : files.length === 0 ? (
          <EmptyState text="لا توجد نسخ احتياطية بعد" emoji="🗂️" />
        ) : (
          <table>
            <thead><tr><th>اسم الملف</th><th>الحجم</th><th>التاريخ</th><th>تنزيل</th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name}>
                  <td style={{ fontWeight: 600 }}>{f.name}</td>
                  <td className="muted">{humanSize(f.size)}</td>
                  <td className="muted">{f.created_at ? formatDate(f.created_at, true) : "—"}</td>
                  <td>{f.url ? <a className="btn btn-outline btn-sm" href={f.url} target="_blank" rel="noreferrer">تنزيل</a> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
