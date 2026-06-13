"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  Boxes,
  CircleDollarSign,
  Download,
  Gauge,
  History,
  Import,
  Landmark,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { AppData, DashboardData, Group, Invoice, Payment, Student } from "@/lib/types";
import { formatCurrency, invoiceFileName, todayIso, whatsappUrl } from "@/lib/utils";

type PageKey = "dashboard" | "students" | "groups" | "payments" | "cashbook" | "reports" | "import" | "invoice" | "auditlog" | "settings" | "backup";
type ModalState =
  | { type: "student"; row?: Student }
  | { type: "group"; row?: Group }
  | { type: "payment"; student?: Student }
  | { type: "cashbook" }
  | null;

const navItems: Array<{ key: PageKey; href: string; label: string; icon: typeof Gauge }> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: Gauge },
  { key: "students", href: "/students", label: "Students", icon: Users },
  { key: "groups", href: "/groups", label: "Groups", icon: Boxes },
  { key: "payments", href: "/payments", label: "Payments", icon: CircleDollarSign },
  { key: "cashbook", href: "/cashbook", label: "Cashbook", icon: Landmark },
  { key: "reports", href: "/reports", label: "Reports", icon: BookOpen },
  { key: "import", href: "/import", label: "Import", icon: Import },
  { key: "invoice", href: "/invoice", label: "Invoice", icon: Receipt },
  { key: "auditlog", href: "/auditlog", label: "Audit Log", icon: History },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
  { key: "backup", href: "/backup", label: "Backup", icon: ShieldCheck },
];

const emptyData: AppData = {
  students: [],
  groups: [],
  payments: [],
  invoices: [],
  cashbook: [],
  auditLogs: [],
  settings: [],
  backups: [],
};

const emptyDashboard: DashboardData = {
  totalStudents: 0,
  activeStudents: 0,
  archivedStudents: 0,
  totalGroups: 0,
  activeGroups: 0,
  totalCollected: 0,
  totalRemaining: 0,
  pendingPaymentsCount: 0,
  todayPayments: 0,
  thisMonthRevenue: 0,
  recentPayments: [],
  recentInvoices: [],
  recentAuditLogs: [],
};

export function AdminApp({ page }: { page: PageKey }) {
  const router = useRouter();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const currency = setting("Currency", data.settings) || "EGP";
  const academyName = setting("Academy Name", data.settings) || "Code Wave Academy";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch("/api/app", { cache: "no-store", signal: controller.signal });
    } catch {
      setError("Dashboard data failed to load. Check Supabase environment variables and database schema.");
      setLoading(false);
      window.clearTimeout(timeout);
      return;
    }
    window.clearTimeout(timeout);
    if (response.status === 500) {
      const payload = await response.json().catch(() => ({}));
      if (String(payload.error || "").includes("Unauthorized")) {
        router.push("/login");
        return;
      }
      setError(payload.error || "Failed to load dashboard data.");
      setLoading(false);
      return;
    }
    const payload = await response.json();
    setData(payload.appData || emptyData);
    setDashboard(payload.dashboard || emptyDashboard);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function action(name: string, payload: Record<string, unknown>, message: string) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: name, payload }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(result.error || "Action failed.");
      return null;
    }
    setData(result.appData);
    setDashboard(result.dashboard);
    setToast(message);
    setModal(null);
    setTimeout(() => setToast(""), 3200);
    return result.data;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const filteredStudents = useMemo(() => {
    const search = query.toLowerCase().trim();
    return data.students.filter((student) => {
      const matchesSearch = !search || [student.student_name, student.student_code, student.phone, student.parent_phone].some((value) => String(value || "").toLowerCase().includes(search));
      const matchesGroup = !groupFilter || student.group_id === groupFilter || student.group_name === groupFilter;
      const matchesPayment = !paymentFilter || student.payment_status === paymentFilter;
      return matchesSearch && matchesGroup && matchesPayment;
    });
  }, [data.students, groupFilter, paymentFilter, query]);

  const selectedStudent = data.students.find((student) => student.id === selectedStudentId) || data.students[0];
  const selectedPayments = selectedStudent ? data.payments.filter((payment) => payment.student_id === selectedStudent.id) : [];

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="card flex items-center gap-4 rounded-3xl p-8">
          <Loader2 className="animate-spin text-blue-600" />
          <div>
            <p className="font-black">Loading Code Wave Academy</p>
            <p className="text-sm text-slate-500">Fetching dashboard data from Supabase...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white/90 p-5 backdrop-blur-xl lg:block">
        <div className="mb-8 flex items-center gap-3">
          <Image src="/logo.jpg" alt="Code Wave logo" width={56} height={56} className="rounded-2xl object-cover" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Code Wave</p>
            <h1 className="text-lg font-black">Academy</h1>
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.key === page;
            return (
              <Link key={item.key} href={item.href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="btn btn-soft mt-8 w-full">
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-600">{academyName}</p>
              <h2 className="text-2xl font-black capitalize text-slate-950">{page.replace("auditlog", "audit log")}</h2>
            </div>
            <div className="hidden items-center gap-2 rounded-2xl bg-slate-100 p-1 lg:flex">
              {navItems.slice(0, 5).map((item) => (
                <Link key={item.key} href={item.href} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.key === page ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>{item.label}</Link>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">
          {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700">{error}</div> : null}
          {toast ? <div className="no-print fixed right-5 top-5 z-50 rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white shadow-2xl">{toast}</div> : null}
          {page === "dashboard" ? renderDashboard() : null}
          {page === "students" ? renderStudents() : null}
          {page === "groups" ? renderGroups() : null}
          {page === "payments" ? renderPayments() : null}
          {page === "cashbook" ? renderCashbook() : null}
          {page === "reports" ? renderReports() : null}
          {page === "import" ? renderImport() : null}
          {page === "invoice" ? renderInvoicePage() : null}
          {page === "auditlog" ? renderAuditLog() : null}
          {page === "settings" ? renderSettings() : null}
          {page === "backup" ? renderBackup() : null}
        </main>
      </div>

      {modal ? renderModal() : null}
    </div>
  );

  function renderDashboard() {
    return (
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stat("Total students", dashboard.totalStudents, "Active " + dashboard.activeStudents, <Users />)}
          {stat("Total collected", formatCurrency(dashboard.totalCollected, currency), "This month " + formatCurrency(dashboard.thisMonthRevenue, currency), <CircleDollarSign />)}
          {stat("Total remaining", formatCurrency(dashboard.totalRemaining, currency), "Pending " + dashboard.pendingPaymentsCount, <Receipt />)}
          {stat("Active groups", dashboard.activeGroups, "Total " + dashboard.totalGroups, <Boxes />)}
        </section>
        <section className="grid gap-6 xl:grid-cols-3">
          <Panel title="Recent payments" action={<Link href="/payments" className="text-sm font-bold text-blue-600">View all</Link>}>
            <MiniPayments rows={dashboard.recentPayments} />
          </Panel>
          <Panel title="Recent invoices" action={<Link href="/invoice" className="text-sm font-bold text-blue-600">Create invoice</Link>}>
            {dashboard.recentInvoices.length ? dashboard.recentInvoices.map((invoice) => <Row key={invoice.id} title={invoice.invoice_code} sub={invoice.student_name} value={formatCurrency(invoice.remaining_amount, currency)} />) : <Empty text="No invoices yet." />}
          </Panel>
          <Panel title="Recent audit logs">
            {dashboard.recentAuditLogs.length ? dashboard.recentAuditLogs.map((log) => <Row key={log.id} title={log.action} sub={log.description || ""} value={new Date(log.timestamp).toLocaleDateString()} />) : <Empty text="No audit entries yet." />}
          </Panel>
        </section>
      </div>
    );
  }

  function renderStudents() {
    return (
      <div className="space-y-5">
        <Toolbar>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="input pl-10" placeholder="Search by name, ID, or phone" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="input max-w-52" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="">All groups</option>
            {data.groups.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}
          </select>
          <select className="input max-w-52" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="">All payment statuses</option>
            <option>Paid</option>
            <option>Partially Paid</option>
            <option>Unpaid</option>
          </select>
          <button className="btn btn-primary" onClick={() => setModal({ type: "student" })}><Plus size={16} /> Add student</button>
        </Toolbar>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Group</th><th>Course</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.student_code}</td>
                  <td><strong>{student.student_name}</strong><div className="text-xs text-slate-500">{student.parent_phone || student.phone}</div></td>
                  <td>{student.group_name || "-"}</td>
                  <td>{student.course || "-"}</td>
                  <td>{formatCurrency(student.paid_amount, currency)}</td>
                  <td>{formatCurrency(student.remaining_amount, currency)}</td>
                  <td>{paymentBadge(student.payment_status)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-soft px-3 py-2" onClick={() => setModal({ type: "student", row: student })}>Edit</button>
                      <button className="btn btn-soft px-3 py-2" onClick={() => setModal({ type: "payment", student })}>Pay</button>
                      <button className="btn btn-soft px-3 py-2" onClick={() => generateInvoice(student.id)}>Invoice</button>
                      <a className="btn btn-soft px-3 py-2" href={whatsapp(student)} target="_blank"><MessageCircle size={15} /></a>
                      <button className="btn btn-danger px-3 py-2" onClick={() => confirm("Archive student?") && action("archiveStudent", { id: student.id }, "Student archived")}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredStudents.length ? <tr><td colSpan={8}><Empty text="No students match your filters." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderGroups() {
    const groupStats = data.groups.map((group) => {
      const students = data.students.filter((student) => student.group_id === group.id || student.group_name === group.group_name);
      return {
        group,
        count: students.length,
        price: students.reduce((sum, student) => sum + Number(student.course_price || 0), 0),
        paid: students.reduce((sum, student) => sum + Number(student.paid_amount || 0), 0),
        remaining: students.reduce((sum, student) => sum + Number(student.remaining_amount || 0), 0),
        paidStudents: students.filter((student) => student.payment_status === "Paid").length,
        partialStudents: students.filter((student) => student.payment_status === "Partially Paid").length,
        unpaidStudents: students.filter((student) => student.payment_status === "Unpaid").length,
      };
    });
    return (
      <div className="space-y-5">
        <Toolbar><button className="btn btn-primary" onClick={() => setModal({ type: "group" })}><Plus size={16} /> Add group</button></Toolbar>
        <div className="grid gap-4 lg:grid-cols-2">
          {groupStats.map(({ group, count, price, paid, remaining, paidStudents, partialStudents, unpaidStudents }) => (
            <article key={group.id} className="card rounded-3xl p-5">
              <div className="mb-4 flex items-start justify-between">
                <div><p className="text-sm font-bold text-blue-600">{group.group_code}</p><h3 className="text-2xl font-black">{group.group_name}</h3><p className="text-sm text-slate-500">{group.course || "No course"} · {group.schedule || "No schedule"}</p></div>
                <span className="badge bg-slate-100 text-slate-700">{group.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Metric label="Students" value={count} />
                <Metric label="Prices" value={formatCurrency(price, currency)} />
                <Metric label="Paid" value={formatCurrency(paid, currency)} />
                <Metric label="Remaining" value={formatCurrency(remaining, currency)} />
              </div>
              <p className="mt-4 text-sm text-slate-500">Paid {paidStudents} · Partial {partialStudents} · Unpaid {unpaidStudents}</p>
              <div className="mt-4 flex gap-2"><button className="btn btn-soft" onClick={() => setModal({ type: "group", row: group })}>Edit</button><button className="btn btn-danger" onClick={() => confirm("Archive group? Students will stay safe.") && action("archiveGroup", { id: group.id }, "Group archived")}>Archive</button></div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  function renderPayments() {
    return (
      <div className="space-y-5">
        <Toolbar><button className="btn btn-primary" onClick={() => setModal({ type: "payment" })}><Plus size={16} /> Add payment</button></Toolbar>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Payment</th><th>Student</th><th>Group</th><th>Amount</th><th>Total paid</th><th>Remaining</th><th>Method</th><th>Date</th><th>Notes</th></tr></thead>
            <tbody>{data.payments.map((payment) => <tr key={payment.id}><td>{payment.payment_code}</td><td>{payment.student_name}</td><td>{payment.group_name || "-"}</td><td>{formatCurrency(payment.payment_amount, currency)}</td><td>{formatCurrency(payment.total_paid_after_payment, currency)}</td><td>{formatCurrency(payment.remaining_after_payment, currency)}</td><td>{payment.payment_method || "-"}</td><td>{payment.payment_date}</td><td>{payment.notes}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderCashbook() {
    const income = data.cashbook.filter((row) => row.type === "Income").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expense = data.cashbook.filter((row) => row.type === "Expense").reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return (
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3">{stat("Income", formatCurrency(income, currency), "Cashbook", <CircleDollarSign />)}{stat("Expenses", formatCurrency(expense, currency), "Cashbook", <Landmark />)}{stat("Net", formatCurrency(income - expense, currency), "Income - Expense", <Gauge />)}</section>
        <Toolbar><button className="btn btn-primary" onClick={() => setModal({ type: "cashbook" })}><Plus size={16} /> Add entry</button></Toolbar>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Notes</th></tr></thead><tbody>{data.cashbook.map((row) => <tr key={row.id}><td>{row.cashbook_code}</td><td>{row.date}</td><td>{row.type}</td><td>{row.category}</td><td>{row.description}</td><td>{formatCurrency(row.amount, currency)}</td><td>{row.notes}</td></tr>)}</tbody></table></div>
      </div>
    );
  }

  function renderReports() {
    const paid = data.students.filter((student) => student.payment_status === "Paid").length;
    const partial = data.students.filter((student) => student.payment_status === "Partially Paid").length;
    const unpaid = data.students.filter((student) => student.payment_status === "Unpaid").length;
    return (
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">{stat("Paid students", paid, "Fully settled", <Users />)}{stat("Partially paid", partial, "Need follow-up", <Receipt />)}{stat("Unpaid students", unpaid, "No payment yet", <Archive />)}</section>
        <Panel title="Group report">
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Group</th><th>Students</th><th>Paid</th><th>Remaining</th><th>Paid students</th><th>Partial</th><th>Unpaid</th></tr></thead><tbody>{data.groups.map((group) => {
            const rows = data.students.filter((student) => student.group_id === group.id || student.group_name === group.group_name);
            return <tr key={group.id}><td>{group.group_name}</td><td>{rows.length}</td><td>{formatCurrency(rows.reduce((sum, student) => sum + Number(student.paid_amount || 0), 0), currency)}</td><td>{formatCurrency(rows.reduce((sum, student) => sum + Number(student.remaining_amount || 0), 0), currency)}</td><td>{rows.filter((student) => student.payment_status === "Paid").length}</td><td>{rows.filter((student) => student.payment_status === "Partially Paid").length}</td><td>{rows.filter((student) => student.payment_status === "Unpaid").length}</td></tr>;
          })}</tbody></table></div>
        </Panel>
      </div>
    );
  }

  function renderImport() {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Migration status">
          <div className="space-y-3 text-sm text-slate-600">
            <p>Validated source data after the Apps Script import:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Students: 83</li>
              <li>Groups: 18</li>
              <li>Payments: 76</li>
              <li>Total paid: 254900</li>
              <li>Total remaining: 137600</li>
              <li>Pending payments count: 40</li>
            </ul>
            <p>Use the SQL schema first, then import exported Google Sheets data into Supabase. This page intentionally does not rerun the old import.</p>
          </div>
        </Panel>
        <Panel title="Validation checklist">
          <div className="space-y-3 text-sm text-slate-600">
            {["No duplicate students", "Payments link to valid students", "Students link to valid groups", "Balances and payment status are recalculated", "Totals match dashboard"].map((item) => <p key={item} className="flex items-center gap-2"><ShieldCheck className="text-green-600" size={18} /> {item}</p>)}
          </div>
        </Panel>
      </div>
    );
  }

  function renderInvoicePage() {
    return (
      <div className="space-y-5">
        <Toolbar>
          <select className="input max-w-md" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
            {data.students.map((student) => <option key={student.id} value={student.id}>{student.student_code} - {student.student_name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!selectedStudent} onClick={() => selectedStudent && generateInvoice(selectedStudent.id)}>Generate invoice</button>
          <button className="btn btn-soft" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="btn btn-soft" onClick={downloadInvoicePdf}><Download size={16} /> Download PDF</button>
        </Toolbar>
        {selectedStudent ? <InvoicePreview refEl={invoiceRef} academyName={academyName} student={selectedStudent} payments={selectedPayments} invoice={selectedInvoice} currency={currency} /> : <Empty text="No students available." />}
      </div>
    );
  }

  function renderAuditLog() {
    return <div className="table-wrap"><table className="data-table"><thead><tr><th>ID</th><th>Time</th><th>Action</th><th>Entity</th><th>Description</th><th>User</th></tr></thead><tbody>{data.auditLogs.map((log) => <tr key={log.id}><td>{log.log_code}</td><td>{new Date(log.timestamp).toLocaleString()}</td><td>{log.action}</td><td>{log.entity_type}</td><td>{log.description}</td><td>{log.user}</td></tr>)}</tbody></table></div>;
  }

  function renderSettings() {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {["Academy Name", "Currency", "Invoice Prefix", "WhatsApp Message Template", "Default Course Price"].map((key) => (
          <SettingCard key={key} label={key} value={setting(key, data.settings)} onSave={(value) => action("updateSetting", { key, value }, "Setting saved")} />
        ))}
      </div>
    );
  }

  function renderBackup() {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Download full backup" action={<button className="btn btn-primary" onClick={downloadBackup}><Download size={16} /> Download Full Backup</button>}>
          <p className="text-sm leading-7 text-slate-600">Exports all important tables as JSON and CSV inside one ZIP file, then records the backup in the database and audit log.</p>
        </Panel>
        <Panel title="Backup history">
          <div className="table-wrap"><table className="data-table"><thead><tr><th>ID</th><th>File</th><th>Type</th><th>Date</th></tr></thead><tbody>{data.backups.map((backup) => <tr key={backup.id}><td>{backup.backup_code}</td><td>{backup.file_name}</td><td>{backup.backup_type}</td><td>{new Date(backup.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    );
  }

  function renderModal() {
    return <div className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="card w-full max-w-2xl rounded-3xl p-6">{modal?.type === "student" ? <StudentForm row={modal.row} groups={data.groups} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action(modal.row ? "updateStudent" : "createStudent", modal.row ? { ...payload, id: modal.row.id } : payload, modal.row ? "Student updated" : "Student added")} /> : null}{modal?.type === "group" ? <GroupForm row={modal.row} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action(modal.row ? "updateGroup" : "createGroup", modal.row ? { ...payload, id: modal.row.id } : payload, modal.row ? "Group updated" : "Group added")} /> : null}{modal?.type === "payment" ? <PaymentForm students={data.students} selected={modal.student} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action("createPayment", payload, "Payment recorded")} /> : null}{modal?.type === "cashbook" ? <CashbookForm saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action("createCashbookEntry", payload, "Cashbook entry added")} /> : null}</div></div>;
  }

  async function generateInvoice(studentId: string) {
    const invoice = await action("createInvoice", { student_id: studentId }, "Invoice generated");
    if (invoice) {
      setSelectedInvoice(invoice as Invoice);
      setSelectedStudentId(studentId);
      router.push("/invoice");
    }
  }

  async function downloadInvoicePdf() {
    if (!invoiceRef.current || !selectedStudent) return;
    const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(image, "PNG", 0, 0, width, height);
    pdf.save(invoiceFileName(selectedInvoice?.invoice_code || "INV-DRAFT", selectedStudent.student_name));
  }

  async function downloadBackup() {
    const response = await fetch("/api/backup/full");
    if (!response.ok) {
      setError((await response.json()).error || "Backup failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Code-Wave-Academy-Full-Backup-${todayIso()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Backup downloaded");
    void loadData();
  }

  function whatsapp(student: Student) {
    const template = setting("WhatsApp Message Template", data.settings) || "Hello {student_name}, your remaining amount is {remaining_amount} {currency}.";
    const message = template.replaceAll("{student_name}", student.student_name).replaceAll("{remaining_amount}", String(student.remaining_amount)).replaceAll("{currency}", currency);
    return whatsappUrl(student.parent_phone || student.phone, message) || "#";
  }

  function stat(label: string, value: string | number, sub: string, icon: React.ReactNode) {
    return <article className="card rounded-3xl p-5"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">{icon}</div><p className="text-sm font-bold text-slate-500">{label}</p><h3 className="mt-1 text-3xl font-black text-slate-950">{value}</h3><p className="mt-2 text-sm text-slate-500">{sub}</p></article>;
  }
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="card rounded-3xl p-5"><div className="mb-4 flex items-center justify-between gap-4"><h3 className="text-lg font-black">{title}</h3>{action}</div>{children}</section>;
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="card flex flex-col gap-3 rounded-3xl p-4 lg:flex-row lg:items-center">{children}</div>;
}

function Row({ title, sub, value }: { title: string; sub: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"><div><p className="font-bold">{title}</p><p className="text-sm text-slate-500">{sub}</p></div><p className="text-sm font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 font-black text-slate-950">{value}</p></div>;
}

function paymentBadge(status: string) {
  const className = status === "Paid" ? "badge-paid" : status === "Partially Paid" ? "badge-partial" : "badge-unpaid";
  return <span className={`badge ${className}`}>{status}</span>;
}

function setting(key: string, settings: AppData["settings"]) {
  return settings.find((row) => row.key === key)?.value || "";
}

function MiniPayments({ rows }: { rows: Payment[] }) {
  return rows.length ? rows.map((payment) => <Row key={payment.id} title={payment.student_name} sub={payment.payment_code} value={String(payment.payment_amount)} />) : <Empty text="No payments yet." />;
}

function StudentForm({ row, groups, saving, onSubmit, onClose }: { row?: Student; groups: Group[]; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  return <FormShell title={row ? "Edit student" : "Add student"} saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={row || { registration_date: todayIso(), student_status: "Active" }} fields={[["student_name", "Student name"], ["phone", "Phone"], ["parent_phone", "Parent phone"], ["course", "Course"], ["course_price", "Course price", "number"], ["paid_amount", "Paid amount", "number"], ["registration_date", "Registration date", "date"], ["notes", "Notes"]]} select={{ name: "group_id", label: "Group", options: groups.map((group) => [group.id, group.group_name]) }} />;
}

function GroupForm({ row, saving, onSubmit, onClose }: { row?: Group; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  return <FormShell title={row ? "Edit group" : "Add group"} saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={row || { status: "Active" }} fields={[["group_name", "Group name"], ["course", "Course"], ["instructor", "Instructor"], ["schedule", "Schedule"], ["start_date", "Start date", "date"], ["end_date", "End date", "date"], ["status", "Status"], ["notes", "Notes"]]} />;
}

function PaymentForm({ students, selected, saving, onSubmit, onClose }: { students: Student[]; selected?: Student; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  return <FormShell title="Record payment" saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={{ student_id: selected?.id || students[0]?.id, payment_date: todayIso(), payment_method: "cash" }} fields={[["payment_amount", "Payment amount", "number"], ["payment_method", "Payment method"], ["payment_date", "Payment date", "date"], ["notes", "Notes"]]} select={{ name: "student_id", label: "Student", options: students.map((student) => [student.id, `${student.student_code} - ${student.student_name}`]) }} />;
}

function CashbookForm({ saving, onSubmit, onClose }: { saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  return <FormShell title="Add cashbook entry" saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={{ date: todayIso(), type: "Expense" }} fields={[["date", "Date", "date"], ["type", "Type"], ["category", "Category"], ["description", "Description"], ["amount", "Amount", "number"], ["notes", "Notes"]]} />;
}

function FormShell({ title, fields, select, defaults, saving, onSubmit, onClose }: { title: string; fields: string[][]; select?: { name: string; label: string; options: string[][] }; defaults: Record<string, unknown>; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries(form.entries()));
  }
  return <form onSubmit={submit}><div className="mb-5 flex items-center justify-between"><h3 className="text-2xl font-black">{title}</h3><button type="button" className="btn btn-soft" onClick={onClose}>Close</button></div><div className="grid gap-4 md:grid-cols-2">{select ? <label className="text-sm font-bold">{select.label}<select className="input mt-2" name={select.name} defaultValue={String(defaults[select.name] || "")}>{select.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{fields.map(([name, label, type]) => <label key={name} className="text-sm font-bold">{label}<input className="input mt-2" name={name} type={type || "text"} defaultValue={String(defaults[name] || "")} /></label>)}</div><button className="btn btn-primary mt-6 w-full" disabled={saving}>{saving ? "Saving..." : "Save"}</button></form>;
}

function SettingCard({ label, value, onSave }: { label: string; value: string; onSave: (value: string) => void }) {
  const [local, setLocal] = useState(value);
  return <section className="card rounded-3xl p-5"><label className="text-sm font-bold text-slate-600">{label}</label><textarea className="input mt-2 min-h-24" value={local} onChange={(event) => setLocal(event.target.value)} /><button className="btn btn-primary mt-4" onClick={() => onSave(local)}>Save</button></section>;
}

function InvoicePreview({ refEl, academyName, student, payments, invoice, currency }: { refEl: React.RefObject<HTMLDivElement | null>; academyName: string; student: Student; payments: Payment[]; invoice: Invoice | null; currency: string }) {
  return <section ref={refEl} className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-xl"><div className="mb-8 flex items-center justify-between border-b pb-6"><div className="flex items-center gap-4"><Image src="/logo.jpg" alt="Code Wave logo" width={78} height={78} className="rounded-2xl object-cover" /><div><h1 className="text-3xl font-black">{academyName}</h1><p className="text-slate-500">Professional training invoice</p></div></div><div className="text-right"><p className="text-sm text-slate-500">Invoice</p><h2 className="text-2xl font-black">{invoice?.invoice_code || "INV-DRAFT"}</h2><p className="text-sm text-slate-500">{invoice?.invoice_date || todayIso()}</p></div></div><div className="grid gap-4 md:grid-cols-2"><Metric label="Student ID" value={student.student_code} /><Metric label="Student Name" value={student.student_name} /><Metric label="Phone" value={student.phone || "-"} /><Metric label="Parent Phone" value={student.parent_phone || "-"} /><Metric label="Course" value={student.course || "-"} /><Metric label="Group" value={student.group_name || "-"} /><Metric label="Course Price" value={formatCurrency(student.course_price, currency)} /><Metric label="Paid Amount" value={formatCurrency(student.paid_amount, currency)} /><Metric label="Remaining Amount" value={formatCurrency(student.remaining_amount, currency)} /><Metric label="Payment Status" value={student.payment_status} /></div><h3 className="mt-8 text-xl font-black">Payment history</h3><div className="mt-3 table-wrap shadow-none"><table className="data-table"><thead><tr><th>ID</th><th>Date</th><th>Amount</th><th>Method</th><th>Remaining</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.payment_code}</td><td>{payment.payment_date}</td><td>{formatCurrency(payment.payment_amount, currency)}</td><td>{payment.payment_method}</td><td>{formatCurrency(payment.remaining_after_payment, currency)}</td></tr>)}</tbody></table></div><p className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Notes: {student.notes || invoice?.notes || "Thank you for choosing Code Wave Academy."}</p></section>;
}
