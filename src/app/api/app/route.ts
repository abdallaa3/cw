import { NextResponse } from "next/server";
import {
  archiveGroup,
  archiveStudent,
  createCashbookEntry,
  createGroup,
  createInvoice,
  createPayment,
  createStudent,
  getAppData,
  getDashboardData,
  updateGroup,
  updateSetting,
  updateStudent,
} from "@/lib/data";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const [appData, dashboard] = await Promise.all([getAppData(), getDashboardData()]);
    return NextResponse.json({ ok: true, appData, dashboard });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const action = String(body.action || "");
    const payload = body.payload || {};
    let data: unknown;

    if (action === "createStudent") data = await createStudent(payload);
    else if (action === "updateStudent") data = await updateStudent(String(payload.id), payload);
    else if (action === "archiveStudent") data = await archiveStudent(String(payload.id));
    else if (action === "createGroup") data = await createGroup(payload);
    else if (action === "updateGroup") data = await updateGroup(String(payload.id), payload);
    else if (action === "archiveGroup") data = await archiveGroup(String(payload.id));
    else if (action === "createPayment") data = await createPayment(payload);
    else if (action === "createInvoice") data = await createInvoice(String(payload.student_id), String(payload.notes || ""));
    else if (action === "createCashbookEntry") data = await createCashbookEntry(payload);
    else if (action === "updateSetting") data = await updateSetting(String(payload.key), String(payload.value || ""));
    else throw new Error(`Unknown action: ${action}`);

    const [appData, dashboard] = await Promise.all([getAppData(), getDashboardData()]);
    return NextResponse.json({ ok: true, data, appData, dashboard });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action failed" }, { status: 500 });
  }
}
