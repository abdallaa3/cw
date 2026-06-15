"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readXlsx, readAllSheets, writeXlsx } from "@/lib/xlsx";
import { importRowsAction, importBackupAction, getBackupAction } from "@/lib/actions";
import { toast } from "@/components/toast";
import { todayIso } from "@/lib/utils";

type LegacyResult = { created: number; payments: number; skipped: number; errors: Array<{ row: number; error: string }> };
type BackupResult = {
  students_new: number;
  students_updated: number;
  payments_new: number;
  cashbook_new: number;
  errors: Array<{ sheet: string; row: number; error: string }>;
};
type BackupSheets = { students?: string[][]; payments?: string[][]; cashbook?: string[][] };

// Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v !== "")) rows.push(row); }
  return rows;
}

function pickSheet(sheets: Record<string, string[][]>, keys: string[]): string[][] | undefined {
  for (const [name, rows] of Object.entries(sheets)) {
    const n = name.toLowerCase();
    if (keys.some((k) => n.includes(k))) return rows;
  }
  return undefined;
}

export function ImportView() {
  const router = useRouter();
  const [mode, setMode] = useState<"backup" | "legacy" | "">("");
  const [legacyRows, setLegacyRows] = useState<string[][]>([]);
  const [backup, setBackup] = useState<BackupSheets>({});
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [legacyResult, setLegacyResult] = useState<LegacyResult | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState("");

  async function exportBackup() {
    setBusy(true);
    try {
      const res = await getBackupAction();
      if (!res.ok) throw new Error(res.error);
      const data = res.data as { students: (string | number)[][]; payments: (string | number)[][]; cashbook: (string | number)[][] };
      const blob = await writeXlsx([
        { name: "Students", rows: data.students },
        { name: "Payments", rows: data.payments },
        { name: "Cashbook", rows: data.cashbook },
      ]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wave_backup_${todayIso()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("تم تصدير النسخة الاحتياطية");
    } catch (e) {
      toast(e instanceof Error ? e.message : "فشل التصدير", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setError(""); setLegacyResult(null); setBackupResult(null);
    setLegacyRows([]); setBackup({}); setMode("");
    setFileName(file.name);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    try {
      if (ext === "csv") {
        setLegacyRows(parseCsv(await file.text()));
        setMode("legacy");
      } else if (ext === "xlsx") {
        const sheets = await readAllSheets(await file.arrayBuffer());
        const students = pickSheet(sheets, ["student", "طلا"]);
        const payments = pickSheet(sheets, ["payment", "دفع"]);
        const cashbook = pickSheet(sheets, ["cash", "خزين"]);
        if (students) {
          setBackup({ students, payments, cashbook });
          setMode("backup");
        } else {
          // Single-sheet student file → legacy importer.
          setLegacyRows(await readXlsx(await file.arrayBuffer()));
          setMode("legacy");
        }
      } else {
        setError("الملف يجب أن يكون بصيغة xlsx أو csv");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل قراءة الملف");
    }
  }

  async function confirmImport() {
    setBusy(true);
    setError("");
    try {
      if (mode === "backup") {
        const res = await importBackupAction(backup);
        if (!res.ok) throw new Error(res.error);
        const data = res.data as BackupResult;
        setBackupResult(data);
        toast(`تم: ${data.students_new} جديد، ${data.students_updated} محدّث، ${data.payments_new} دفعة`);
        router.refresh();
      } else if (mode === "legacy") {
        if (legacyRows.length < 2) { setError("الملف فارغ أو لا يحتوي على بيانات"); return; }
        const res = await importRowsAction(legacyRows);
        if (!res.ok) throw new Error(res.error);
        const data = res.data as LegacyResult;
        setLegacyResult(data);
        toast(`تم استيراد ${data.created} طالب و ${data.payments} دفعة`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  const sCount = Math.max((backup.students?.length ?? 1) - 1, 0);
  const pCount = Math.max((backup.payments?.length ?? 1) - 1, 0);
  const cCount = Math.max((backup.cashbook?.length ?? 1) - 1, 0);
  const studentsHeader = backup.students?.[0] ?? [];
  const studentsPreview = (backup.students ?? []).slice(1, 6);
  const legacyHeader = legacyRows[0] ?? [];
  const legacyPreview = legacyRows.slice(1, 6);

  return (
    <>
      <div className="panel">
        <div className="section-title" style={{ marginBottom: 14 }}><span className="dot" /> النسخ الاحتياطي (Excel)</div>
        <p className="muted" style={{ fontSize: ".86rem", marginBottom: 14 }}>
          صدّر نسخة احتياطية كاملة (الطلاب + الدفعات + الخزينة) في ملف Excel واحد متعدد الصفحات. يمكنك لاحقاً رفع نفس الملف لاستعادة/تحديث البيانات بدون تكرار.
        </p>
        <button className="btn btn-success" onClick={exportBackup} disabled={busy}>تصدير نسخة احتياطية Excel</button>
      </div>

      <div className="panel">
        <div className="section-title" style={{ marginBottom: 14 }}><span className="dot green" /> استيراد ملف</div>
        <p className="muted" style={{ fontSize: ".86rem", marginBottom: 14 }}>
          ارفع نسخة احتياطية (Students / Payments / Cashbook) لاستعادتها، أو ملف طلاب مفرد (xlsx/csv). لن يتم حفظ أي شيء قبل تأكيدك.
        </p>
        <input className="form-control" type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {fileName && <div className="muted" style={{ fontSize: ".82rem", marginTop: 8 }}>الملف: {fileName} {mode === "backup" ? "— نسخة احتياطية" : mode === "legacy" ? "— ملف طلاب" : ""}</div>}
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

        {mode === "backup" && (
          <>
            <div className="stats-grid" style={{ marginTop: 14 }}>
              <div className="stat-card blue"><div className="card-label">طلاب في الملف</div><div className="card-value">{sCount}</div></div>
              <div className="stat-card green"><div className="card-label">دفعات في الملف</div><div className="card-value">{pCount}</div></div>
              <div className="stat-card yellow"><div className="card-label">حركات خزينة</div><div className="card-value">{cCount}</div></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={confirmImport} disabled={busy}>
              {busy ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
            </button>
          </>
        )}
        {mode === "legacy" && legacyRows.length > 1 && (
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={confirmImport} disabled={busy}>
            {busy ? "جاري الاستيراد..." : `تأكيد استيراد ${legacyRows.length - 1} صف`}
          </button>
        )}
      </div>

      {mode === "backup" && studentsPreview.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 10 }}><span className="dot green" /> معاينة الطلاب (أول 5)</div>
          <div className="table-wrap">
            <table>
              <thead><tr>{studentsHeader.map((h, i) => <th key={i}>{h || `عمود ${i + 1}`}</th>)}</tr></thead>
              <tbody>
                {studentsPreview.map((r, i) => (
                  <tr key={i}>{studentsHeader.map((_, c) => <td key={c} className="muted">{r[c] ?? ""}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {mode === "legacy" && legacyPreview.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 10 }}><span className="dot green" /> معاينة (أول 5 صفوف)</div>
          <div className="table-wrap">
            <table>
              <thead><tr>{legacyHeader.map((h, i) => <th key={i}>{h || `عمود ${i + 1}`}</th>)}</tr></thead>
              <tbody>
                {legacyPreview.map((r, i) => (
                  <tr key={i}>{legacyHeader.map((_, c) => <td key={c} className="muted">{r[c] ?? ""}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {backupResult && (
        <div className="panel">
          <div className="section-title" style={{ marginBottom: 14 }}><span className="dot green" /> نتيجة الاستيراد</div>
          <div className="stats-grid">
            <div className="stat-card green"><div className="card-label">طلاب جدد</div><div className="card-value">{backupResult.students_new}</div></div>
            <div className="stat-card blue"><div className="card-label">طلاب محدّثون</div><div className="card-value">{backupResult.students_updated}</div></div>
            <div className="stat-card green"><div className="card-label">دفعات جديدة</div><div className="card-value">{backupResult.payments_new}</div></div>
            <div className="stat-card yellow"><div className="card-label">حركات خزينة جديدة</div><div className="card-value">{backupResult.cashbook_new}</div></div>
          </div>
          {backupResult.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 6 }}>أخطاء ({backupResult.errors.length}):</div>
              {backupResult.errors.slice(0, 20).map((er, i) => (
                <div key={i} className="form-error">{er.sheet} صف {er.row}: {er.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
      {legacyResult && (
        <div className="panel">
          <div className="section-title" style={{ marginBottom: 14 }}><span className="dot green" /> نتيجة الاستيراد</div>
          <div className="stats-grid">
            <div className="stat-card green"><div className="card-label">طلاب أُضيفوا</div><div className="card-value">{legacyResult.created}</div></div>
            <div className="stat-card blue"><div className="card-label">دفعات أُضيفت</div><div className="card-value">{legacyResult.payments}</div></div>
            <div className="stat-card yellow"><div className="card-label">صفوف متخطّاة</div><div className="card-value">{legacyResult.skipped}</div></div>
          </div>
          {legacyResult.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 6 }}>أخطاء:</div>
              {legacyResult.errors.slice(0, 20).map((er, i) => (
                <div key={i} className="form-error">صف {er.row}: {er.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
