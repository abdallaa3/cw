// ════════════════════════════════════════════════════════════════════════
// Tiny .xlsx reader/writer built on jszip (already a dependency).
// Enough for Wave Academy's import/export — strings, numbers, multi-sheet.
// No external Excel library required.
// ════════════════════════════════════════════════════════════════════════
import JSZip from "jszip";

// ── Column helpers (A1 <-> indices) ──────────────────────────────────────────
function colToIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function indexToCol(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── READ ─────────────────────────────────────────────────────────────────────
/** Parse the first worksheet of an .xlsx file into a 2D array of strings. */
export async function readXlsx(input: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const zip = await JSZip.loadAsync(input);

  // shared strings
  const shared: string[] = [];
  const sstFile = zip.file("xl/sharedStrings.xml");
  if (sstFile) {
    const sst = await sstFile.async("string");
    const matches = sst.match(/<si>[\s\S]*?<\/si>/g) ?? [];
    for (const si of matches) {
      const texts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]));
      shared.push(texts.join(""));
    }
  }

  // first worksheet path from workbook rels (fallback to sheet1.xml)
  let sheetPath = "xl/worksheets/sheet1.xml";
  if (!zip.file(sheetPath)) {
    const candidate = Object.keys(zip.files).find((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
    if (candidate) sheetPath = candidate;
  }
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return [];
  const sheet = await sheetFile.async("string");

  const rows: string[][] = [];
  const rowMatches = sheet.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? [];
  for (const rowXml of rowMatches) {
    const cells: string[] = [];
    const cellMatches = [...rowXml.matchAll(/<c\s+r="([A-Z]+)\d+"(?:[^>]*\st="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g)];
    for (const m of cellMatches) {
      const colIdx = colToIndex(m[1]);
      const type = m[2];
      const inner = m[3];
      let value = "";
      if (type === "s") {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) value = shared[Number(vMatch[1])] ?? "";
      } else if (type === "inlineStr") {
        const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (tMatch) value = decodeXml(tMatch[1]);
      } else {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) value = decodeXml(vMatch[1]);
      }
      cells[colIdx] = value;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows;
}

// ── WRITE ────────────────────────────────────────────────────────────────────
export type SheetData = { name: string; rows: (string | number)[][] };

function sheetXml(rows: (string | number)[][]): string {
  const rowXml = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${indexToCol(c)}${r + 1}`;
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          const text = encodeXml(String(value ?? ""));
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${rowXml}</sheetData></worksheet>`;
}

/** Build a multi-sheet .xlsx Blob from plain 2D arrays. */
export async function writeXlsx(sheets: SheetData[]): Promise<Blob> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("")}</Types>`,
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );

  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${encodeXml(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );

  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("")}</Relationships>`,
  );

  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)));

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
