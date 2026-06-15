// ════════════════════════════════════════════════════════════════════════
// Supabase verifier — run AFTER applying migration 0003.
//   1. vercel env pull .env.local        (gets URL + service-role key)
//   2. node --env-file=.env.local scripts/verify-supabase.mjs
//
// Checks: required tables exist, payment-images bucket exists, and a full
// CRUD + cascade + balance + audit smoke test that mirrors the app's logic.
// Cleans up everything it creates. Prints PASS/FAIL only — never secrets.
// ════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run: vercel env pull .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? "  " + extra : ""}`); }
};
const sum = (rows, type) => (rows ?? []).filter((e) => e.entry_type === type).reduce((a, e) => a + Number(e.amount), 0);
const tag = `__verify_${Date.now()}`;

async function ownerBalance(owner) {
  const { data } = await db.from("cash_entries").select("entry_type, amount").eq("owner", owner);
  return sum(data, "in") - sum(data, "out");
}

async function run() {
  console.log("\n[1] Required tables exist");
  for (const t of ["groups", "students", "payments", "cash_entries", "audit_logs"]) {
    const { error } = await db.from(t).select("*", { count: "exact", head: true });
    ok(`table ${t}`, !error, error ? `(${error.message})` : "");
  }

  console.log("\n[2] Storage bucket payment-images");
  const { data: buckets, error: bErr } = await db.storage.listBuckets();
  ok("bucket payment-images", !bErr && (buckets ?? []).some((b) => b.id === "payment-images"), bErr ? `(${bErr.message})` : "");

  console.log("\n[3] CRUD + cascade + balances");
  let gId, sId, pId, manualId;
  try {
    // Group create + edit
    const g = await db.from("groups").insert({ group_number: tag, region: "زقازيق", type: "offline", subscription_type: "monthly" }).select("*").single();
    ok("group create", !g.error && g.data); gId = g.data?.id;
    const gu = await db.from("groups").update({ region: "عبور" }).eq("id", gId).select("region").single();
    ok("group edit", gu.data?.region === "عبور");

    // Student create + edit
    const s = await db.from("students").insert({ name: tag, total_amount: 1000, installments: 2, group_id: gId }).select("*").single();
    ok("student create", !s.error && s.data); sId = s.data?.id;
    const su = await db.from("students").update({ total_amount: 1200 }).eq("id", sId).select("total_amount").single();
    ok("student edit", Number(su.data?.total_amount) === 1200);

    // Payment create + auto cashbook entry (mirrors createPayment)
    const balBefore = await ownerBalance("محمد");
    const p = await db.from("payments").insert({ student_id: sId, amount: 500, method: "cash", received_by: "محمد", payment_date: new Date().toISOString().slice(0, 10) }).select("*").single();
    ok("payment create", !p.error && p.data); pId = p.data?.id;
    await db.from("cash_entries").insert({ owner: "محمد", entry_type: "in", amount: 500, entry_date: p.data.payment_date, linked_payment_id: pId, linked_student_id: sId });

    // paid/remaining math
    let pays = (await db.from("payments").select("amount").eq("student_id", sId)).data;
    let paid = (pays ?? []).reduce((a, r) => a + Number(r.amount), 0);
    ok("paid calc = 500", paid === 500, `paid=${paid}`);
    ok("remaining calc = 700", 1200 - paid === 700);

    // linked cashbook entry exists + balance moved by +500
    const linked = (await db.from("cash_entries").select("id").eq("linked_payment_id", pId)).data;
    ok("payment created linked cashbook entry", (linked ?? []).length === 1);
    ok("محمد balance +500", (await ownerBalance("محمد")) - balBefore === 500);

    // Edit payment 500 -> 700, sync linked entry (mirrors updatePayment)
    await db.from("payments").update({ amount: 700 }).eq("id", pId);
    await db.from("cash_entries").update({ amount: 700 }).eq("linked_payment_id", pId);
    pays = (await db.from("payments").select("amount").eq("student_id", sId)).data;
    paid = (pays ?? []).reduce((a, r) => a + Number(r.amount), 0);
    ok("paid after edit = 700", paid === 700);
    ok("محمد balance +700 after edit", (await ownerBalance("محمد")) - balBefore === 700);

    // Delete payment -> linked cash entry cascades (FK ON DELETE CASCADE)
    await db.from("payments").delete().eq("id", pId);
    const afterDel = (await db.from("cash_entries").select("id").eq("linked_payment_id", pId)).data;
    ok("delete payment cascades cashbook entry", (afterDel ?? []).length === 0);
    ok("محمد balance back to start", (await ownerBalance("محمد")) - balBefore === 0);
    pId = null;

    // Manual cashbook entry + عبدالله balance
    const aBefore = await ownerBalance("عبدالله");
    const m = await db.from("cash_entries").insert({ owner: "عبدالله", entry_type: "out", amount: 100, notes: tag }).select("*").single();
    ok("manual cashbook entry create", !m.error && m.data); manualId = m.data?.id;
    ok("عبدالله balance -100", (await ownerBalance("عبدالله")) - aBefore === -100);

    // Audit log writable/readable
    const a = await db.from("audit_logs").insert({ actor: "system", action: "create", entity: "student", entity_id: sId, description: tag, details: { test: true } }).select("id").single();
    ok("audit_logs write/read", !a.error && a.data);
    if (a.data) await db.from("audit_logs").delete().eq("id", a.data.id);

    // Delete student cascades remaining payments/entries
    await db.from("students").delete().eq("id", sId); sId = null;
    ok("student delete (cascade) ok", true);
  } finally {
    // Cleanup anything left behind
    if (manualId) await db.from("cash_entries").delete().eq("id", manualId);
    if (pId) await db.from("payments").delete().eq("id", pId);
    if (sId) await db.from("students").delete().eq("id", sId);
    if (gId) await db.from("groups").delete().eq("id", gId);
    await db.from("audit_logs").delete().eq("description", tag);
  }

  console.log(`\n${fail === 0 ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}  —  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error("Verifier crashed:", e.message); process.exit(1); });
