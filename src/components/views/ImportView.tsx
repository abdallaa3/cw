"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readXlsx } from "@/lib/xlsx";
import { importRowsAction } from "@/lib/actions";
import { toast } from "@/components/toast";

type ImportResult = { created: number; payments: number; skipped: number; errors: Array<{ row: number; error: string }> };

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

export function ImportView() {
  const router = useRouter();
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function onFile(file: File) {
    setError("");
    setResult(null);
    setFileName(file.name);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    try {
      if (ext === "csv") {
        setRows(parseCsv(await file.text()));
      } else if (ext === "xlsx") {
        setRows(await readXlsx(await file.arrayBuffer()));
      } else {
        setError("الملف يجب أن يكون بصيغة xlsx أو csv");
        setRows([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل قراءة الملف");
      setRows([]);
    }
  }

  async function runImport() {
    if (rows.length < 2) {
      setError("الملف فارغ أو لا يحتوي على بيانات");
      return;
    }
    setImporting(true);
    const res = await importRowsAction(rows);
    setImporting(false);
    if (res.ok) {
      const data = res.data as ImportResult;
      setResult(data);
      toast(`تم استيراد ${data.created} طالب و ${data.payments} دفعة`);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  const header = rows[0] ?? [];
  const preview = rows.slice(1, 6);

  return (
    <>
      <div className="panel">
        <div className="section-title" style={{ marginBottom: 14 }}><span className="dot" /> استيراد من ملف Excel أو CSV</div>
        <p className="muted" style={{ fontSize: ".86rem", marginBottom: 14 }}>
          يدعم أعمدة: الاسم، التليفون، الجروب، الإجمالي، الخصم، عدد الأقساط، قيمة القسط، المدفوع، تاريخ الدفع، طريقة الدفع (مثل «محمد كاش» أو «عبدالله تحويل»)، ملاحظات.
        </p>
        <input className="form-control" type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {fileName && <div className="muted" style={{ fontSize: ".82rem", marginTop: 8 }}>الملف: {fileName} — {Math.max(rows.length - 1, 0)} صف بيانات</div>}
        {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}
        {rows.length > 1 && (
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={runImport} disabled={importing}>
            {importing ? "جاري الاستيراد..." : `استيراد ${rows.length - 1} صف`}
          </button>
        )}
      </div>

      {preview.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 10 }}><span className="dot green" /> معاينة (أول 5 صفوف)</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{header.map((h, i) => <th key={i}>{h || `عمود ${i + 1}`}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>{header.map((_, c) => <td key={c} className="muted">{r[c] ?? ""}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {result && (
        <div className="panel">
          <div className="section-title" style={{ marginBottom: 14 }}><span className="dot green" /> نتيجة الاستيراد</div>
          <div className="stats-grid">
            <div className="stat-card green"><div className="card-label">طلاب أُضيفوا</div><div className="card-value">{result.created}</div></div>
            <div className="stat-card blue"><div className="card-label">دفعات أُضيفت</div><div className="card-value">{result.payments}</div></div>
            <div className="stat-card yellow"><div className="card-label">صفوف متخطّاة</div><div className="card-value">{result.skipped}</div></div>
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 6 }}>أخطاء:</div>
              {result.errors.slice(0, 20).map((er, i) => (
                <div key={i} className="form-error">صف {er.row}: {er.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
