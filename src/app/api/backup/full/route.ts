import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createBackupRecord, readBackupTables } from "@/lib/data";
import { toCsv, todayIso } from "@/lib/utils";

export async function GET() {
  try {
    await requireAdmin();
    const tables = await readBackupTables();
    const date = todayIso();
    const fileName = `Code-Wave-Academy-Full-Backup-${date}.zip`;
    const zip = new JSZip();

    for (const [table, rows] of Object.entries(tables)) {
      const safeRows = rows as Array<Record<string, unknown>>;
      zip.file(`json/${table}.json`, JSON.stringify(safeRows, null, 2));
      zip.file(`csv/${table}.csv`, toCsv(safeRows));
    }

    await createBackupRecord(fileName, "JSON+CSV ZIP");
    const buffer = await zip.generateAsync({ type: "uint8array" });
    const blob = new Blob([buffer as BlobPart], { type: "application/zip" });

    return new NextResponse(blob, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Backup failed" }, { status: 500 });
  }
}
