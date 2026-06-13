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
  Menu,
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
type Language = "ar" | "en";
type ModalState =
  | { type: "student"; row?: Student }
  | { type: "group"; row?: Group }
  | { type: "payment"; student?: Student }
  | { type: "cashbook" }
  | null;

const navItems: Array<{ key: PageKey; href: string; section: "main" | "management" | "finance" | "reports"; label: Record<Language, string>; icon: typeof Gauge }> = [
  { key: "dashboard", href: "/dashboard", section: "main", label: { ar: "لوحة التحكم", en: "Dashboard" }, icon: Gauge },
  { key: "students", href: "/students", section: "management", label: { ar: "الطلاب", en: "Students" }, icon: Users },
  { key: "groups", href: "/groups", section: "management", label: { ar: "الجروبات", en: "Groups" }, icon: Boxes },
  { key: "payments", href: "/payments", section: "management", label: { ar: "الدفعات", en: "Payments" }, icon: CircleDollarSign },
  { key: "invoice", href: "/invoice", section: "management", label: { ar: "الفاتورة", en: "Invoice" }, icon: Receipt },
  { key: "cashbook", href: "/cashbook", section: "finance", label: { ar: "الخزينة", en: "Cashbook" }, icon: Landmark },
  { key: "reports", href: "/reports", section: "reports", label: { ar: "التقارير", en: "Reports" }, icon: BookOpen },
  { key: "import", href: "/import", section: "reports", label: { ar: "استيراد", en: "Import" }, icon: Import },
  { key: "auditlog", href: "/auditlog", section: "reports", label: { ar: "سجل العمليات", en: "Audit Log" }, icon: History },
  { key: "settings", href: "/settings", section: "reports", label: { ar: "الإعدادات", en: "Settings" }, icon: Settings },
  { key: "backup", href: "/backup", section: "reports", label: { ar: "النسخ الاحتياطي", en: "Backup" }, icon: ShieldCheck },
];

const sectionLabels: Record<"main" | "management" | "finance" | "reports", Record<Language, string>> = {
  main: { ar: "الرئيسية", en: "Main" },
  management: { ar: "الإدارة", en: "Management" },
  finance: { ar: "المالية", en: "Finance" },
  reports: { ar: "التقارير", en: "Reports" },
};

const text = {
  ar: {
    loadingTitle: "تحميل Code Wave Academy",
    loadingSub: "جاري تحميل بيانات لوحة التحكم من Supabase...",
    adminSystem: "نظام الإدارة المالية",
    refresh: "تحديث",
    backupNow: "Backup",
    logout: "خروج",
    language: "English",
    totalStudents: "إجمالي الطلاب",
    active: "نشط",
    totalCollected: "إجمالي المدفوع",
    thisMonth: "هذا الشهر",
    totalRemaining: "إجمالي المتبقي",
    pending: "متأخر",
    activeGroups: "الجروبات النشطة",
    recentPayments: "آخر الدفعات",
    pendingPayments: "لسه ما دفعوش",
    recentInvoices: "آخر الفواتير",
    auditLogs: "سجل العمليات",
    viewAll: "عرض الكل",
    addStudent: "+ إضافة طالب",
    searchStudent: "اسم أو تليفون...",
    allGroups: "كل الجروبات",
    allPaymentStatuses: "كل حالات الدفع",
    addGroup: "+ إضافة جروب",
    addPayment: "+ تسجيل دفعة",
    addEntry: "+ حركة خزينة",
    generateInvoice: "Generate invoice",
    print: "Print invoice",
    downloadPdf: "Export PDF",
    whatsapp: "WhatsApp",
    importStatus: "حالة الاستيراد",
    validationChecklist: "قائمة التحقق",
    downloadBackup: "Download Full Backup",
    backupHistory: "سجل النسخ الاحتياطي",
    noRows: "لا توجد بيانات.",
    edit: "تعديل",
    pay: "دفع",
    invoice: "فاتورة",
    archive: "أرشفة",
    close: "إغلاق",
    save: "حفظ",
    saving: "جاري الحفظ...",
  },
  en: {
    loadingTitle: "Loading Code Wave Academy",
    loadingSub: "Fetching dashboard data from Supabase...",
    adminSystem: "Financial management system",
    refresh: "Refresh",
    backupNow: "Backup",
    logout: "Logout",
    language: "العربية",
    totalStudents: "Total students",
    active: "Active",
    totalCollected: "Total collected",
    thisMonth: "This month",
    totalRemaining: "Total remaining",
    pending: "Pending",
    activeGroups: "Active groups",
    recentPayments: "Recent payments",
    pendingPayments: "Pending payments",
    recentInvoices: "Recent invoices",
    auditLogs: "Audit logs",
    viewAll: "View all",
    addStudent: "+ Add student",
    searchStudent: "Name or phone...",
    allGroups: "All groups",
    allPaymentStatuses: "All payment statuses",
    addGroup: "+ Add group",
    addPayment: "+ Add payment",
    addEntry: "+ Add entry",
    generateInvoice: "Generate invoice",
    print: "Print invoice",
    downloadPdf: "Export PDF",
    whatsapp: "WhatsApp",
    importStatus: "Migration status",
    validationChecklist: "Validation checklist",
    downloadBackup: "Download Full Backup",
    backupHistory: "Backup history",
    noRows: "No data.",
    edit: "Edit",
    pay: "Pay",
    invoice: "Invoice",
    archive: "Archive",
    close: "Close",
    save: "Save",
    saving: "Saving...",
  },
} satisfies Record<Language, Record<string, string>>;

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
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "ar";
    const saved = window.localStorage.getItem("code-wave-language");
    return saved === "ar" || saved === "en" ? saved : "ar";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currency = setting("Currency", data.settings) || "EGP";
  const academyName = setting("Academy Name", data.settings) || "Code Wave Academy";
  const isArabic = language === "ar";
  const copy = text[language];

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

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    window.localStorage.setItem("code-wave-language", language);
  }, [isArabic, language]);

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
      <main className="grid min-h-screen place-items-center bg-[var(--background)]">
        <div className="card flex items-center gap-4 rounded-xl p-8">
          <Loader2 className="animate-spin text-[var(--primary)]" />
          <div>
            <p className="font-black">{copy.loadingTitle}</p>
            <p className="muted">{copy.loadingSub}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className={`admin-shell ${isArabic ? "rtl" : "ltr"} flex min-h-screen lg:h-screen lg:overflow-hidden`}>
      <aside className={`admin-sidebar no-print ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <Image src="/logo.jpg" alt="Code Wave logo" width={44} height={44} className="logo-image" />
          <div>
            <div className="logo-text">Wave Academy</div>
            <div className="logo-sub">{copy.adminSystem}</div>
          </div>
        </div>
        <nav className="sidebar-nav sidebar-scroll">
          {(["main", "management", "finance", "reports"] as const).map((section) => (
            <div key={section}>
              <div className="nav-section">{sectionLabels[section][language]}</div>
              {navItems.filter((item) => item.section === section).map((item) => {
                const Icon = item.icon;
                const active = item.key === page;
                return (
                  <Link key={item.key} href={item.href} onClick={() => setMobileMenuOpen(false)} className={`nav-item ${active ? "active" : ""}`}>
                    <Icon size={18} className="icon" />
                    <span>{item.label[language]}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar">CW</div>
          <div className="user-info">
            <div className="user-name">Admin</div>
            <div className="user-role">{copy.adminSystem}</div>
          </div>
          <button onClick={() => setLanguage(isArabic ? "en" : "ar")} className="btn-switch">{copy.language}</button>
          <button onClick={logout} className="btn-switch">{copy.logout}</button>
        </div>
      </aside>

      <div className="admin-main flex min-h-screen flex-1 flex-col lg:h-screen lg:min-h-0">
        <header className="admin-header no-print">
          <button className="btn btn-outline mobile-only" onClick={() => setMobileMenuOpen((value) => !value)}><Menu size={16} /></button>
          <div className="header-title">{navItems.find((item) => item.key === page)?.label[language]} - <span>{academyName}</span></div>
          <div className="header-actions">
            <span className="header-date">{new Date().toLocaleDateString(isArabic ? "ar-EG" : "en-US")}</span>
            <button className="btn btn-outline" onClick={() => void loadData()}>↻ {copy.refresh}</button>
            <Link href="/backup" className="btn btn-success">{copy.backupNow}</Link>
            <button onClick={() => setLanguage(isArabic ? "en" : "ar")} className="btn btn-outline">{copy.language}</button>
            <button onClick={logout} className="btn btn-outline"><LogOut size={16} /> {copy.logout}</button>
          </div>
          <nav className="mobile-nav sidebar-scroll">
            {navItems.map((item) => (
              <Link key={item.key} href={item.href} className={`mobile-nav-item ${item.key === page ? "active" : ""}`}>{item.label[language]}</Link>
            ))}
          </nav>
        </header>

        <main className="content-area flex-1 lg:min-h-0 lg:overflow-y-auto">
          {error ? (
            <div className="app-error">
              <strong>App loading error</strong>
              <div>{error}</div>
              <button className="btn btn-outline" type="button" onClick={() => void loadData()}>Retry</button>
            </div>
          ) : null}
          {toast ? <div className="toast success no-print">{toast}</div> : null}
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
    const pendingStudents = data.students.filter((student) => Number(student.remaining_amount || 0) > 0).slice(0, 8);
    return (
      <div className="space-y-6">
        <section className="stats-grid">
          {stat(copy.totalStudents, dashboard.totalStudents, `${copy.active} ${dashboard.activeStudents}`, <Users />, "blue")}
          {stat(copy.totalCollected, formatCurrency(dashboard.totalCollected, currency), `${copy.thisMonth} ${formatCurrency(dashboard.thisMonthRevenue, currency)}`, <CircleDollarSign />, "green")}
          {stat(copy.totalRemaining, formatCurrency(dashboard.totalRemaining, currency), `${copy.pending} ${dashboard.pendingPaymentsCount}`, <Receipt />, "red")}
          {stat(copy.activeGroups, dashboard.activeGroups, `Total ${dashboard.totalGroups}`, <Boxes />, "yellow")}
        </section>
        <section className="grid-2">
          <Panel title={copy.pendingPayments} action={<span className="badge red">{pendingStudents.length}</span>}>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>{isArabic ? "اسم الطالب" : "Student"}</th><th>{isArabic ? "الجروب" : "Group"}</th><th>{isArabic ? "المدفوع" : "Paid"}</th><th>{isArabic ? "المتبقي" : "Remaining"}</th><th>{copy.whatsapp}</th></tr></thead>
                <tbody>
                  {pendingStudents.map((student) => <tr key={student.id}><td>{student.student_name}</td><td>{student.group_name || "-"}</td><td>{formatCurrency(student.paid_amount, currency)}</td><td className="red-text">{formatCurrency(student.remaining_amount, currency)}</td><td><a className="btn btn-outline btn-sm" href={whatsapp(student)} target="_blank"><MessageCircle size={14} /></a></td></tr>)}
                  {!pendingStudents.length ? <tr><td colSpan={5}><Empty text={copy.noRows} /></td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title={copy.recentPayments} action={<Link href="/payments" className="badge">{copy.viewAll}</Link>}>
            <MiniPayments rows={dashboard.recentPayments} />
          </Panel>
        </section>
        <section className="grid-2">
          <Panel title={copy.recentInvoices} action={<Link href="/invoice" className="badge">{copy.generateInvoice}</Link>}>
            {dashboard.recentInvoices.length ? dashboard.recentInvoices.map((invoice) => <Row key={invoice.id} title={invoice.invoice_code} sub={invoice.student_name} value={formatCurrency(invoice.remaining_amount, currency)} />) : <Empty text={copy.noRows} />}
          </Panel>
          <Panel title={copy.auditLogs}>
            {dashboard.recentAuditLogs.length ? dashboard.recentAuditLogs.map((log) => <Row key={log.id} title={log.action} sub={log.description || ""} value={new Date(log.timestamp).toLocaleDateString()} />) : <Empty text={copy.noRows} />}
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
            <Search className="search-icon" size={18} />
            <input className="input search-input" placeholder={copy.searchStudent} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="input" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
            <option value="">{copy.allGroups}</option>
            {data.groups.map((group) => <option key={group.id} value={group.id}>{group.group_name}</option>)}
          </select>
          <select className="input" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="">{copy.allPaymentStatuses}</option>
            <option>Paid</option>
            <option>Partially Paid</option>
            <option>Unpaid</option>
          </select>
          <button className="btn btn-primary" onClick={() => setModal({ type: "student" })}><Plus size={16} /> {copy.addStudent}</button>
        </Toolbar>
        <div className="status-tabs">
          <Metric label="Paid" value={data.students.filter((student) => student.payment_status === "Paid").length} />
          <Metric label="Partial" value={data.students.filter((student) => student.payment_status === "Partially Paid").length} />
          <Metric label="Unpaid" value={data.students.filter((student) => student.payment_status === "Unpaid").length} />
        </div>
        <div className="section-header"><h2 className="section-title"><span className="dot" />{isArabic ? "قائمة الطلاب" : "Students list"}</h2><span className="badge">{filteredStudents.length}</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>ID</th><th>{isArabic ? "الاسم" : "Name"}</th><th>{isArabic ? "التليفون" : "Phone"}</th><th>{isArabic ? "ولي الأمر" : "Parent"}</th><th>{isArabic ? "الجروب" : "Group"}</th><th>{isArabic ? "الكورس" : "Course"}</th><th>{isArabic ? "الإجمالي" : "Price"}</th><th>{isArabic ? "مدفوع" : "Paid"}</th><th>{isArabic ? "متبقي" : "Remaining"}</th><th>{isArabic ? "حالة الدفع" : "Payment status"}</th><th>{isArabic ? "حالة الطالب" : "Student status"}</th><th>{isArabic ? "إجراءات" : "Actions"}</th></tr></thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.student_code}</td>
                  <td><strong>{student.student_name}</strong></td>
                  <td>{student.phone || "-"}</td>
                  <td>{student.parent_phone || "-"}</td>
                  <td>{student.group_name || "-"}</td>
                  <td>{student.course || "-"}</td>
                  <td>{formatCurrency(student.course_price, currency)}</td>
                  <td>{formatCurrency(student.paid_amount, currency)}</td>
                  <td className={Number(student.remaining_amount) > 0 ? "red-text" : "green-text"}>{formatCurrency(student.remaining_amount, currency)}</td>
                  <td>{paymentBadge(student.payment_status)}</td>
                  <td>{student.student_status}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: "student", row: student })}>{copy.edit}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: "payment", student })}>{copy.pay}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => generateInvoice(student.id)}>{copy.invoice}</button>
                      <a className="btn btn-outline btn-sm" href={whatsapp(student)} target="_blank"><MessageCircle size={15} /></a>
                      <button className="btn btn-danger btn-sm" onClick={() => confirm("Archive student?") && action("archiveStudent", { id: student.id }, "Student archived")}>{copy.archive}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredStudents.length ? <tr><td colSpan={12}><Empty text={copy.noRows} /></td></tr> : null}
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
        <Toolbar><button className="btn btn-primary" onClick={() => setModal({ type: "group" })}><Plus size={16} /> {copy.addGroup}</button></Toolbar>
        <div className="grid gap-4 lg:grid-cols-2">
          {groupStats.map(({ group, count, price, paid, remaining, paidStudents, partialStudents, unpaidStudents }) => (
            <article key={group.id} className="card">
              <div className="mb-4 flex items-start justify-between">
                <div><p className="badge">{group.group_code}</p><h3 className="text-2xl font-black">{group.group_name}</h3><p className="muted">{group.course || "No course"} · {group.schedule || "No schedule"}</p></div>
                <span className="badge">{group.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Metric label="Students" value={count} />
                <Metric label="Prices" value={formatCurrency(price, currency)} />
                <Metric label="Paid" value={formatCurrency(paid, currency)} />
                <Metric label="Remaining" value={formatCurrency(remaining, currency)} />
              </div>
              <p className="mt-4 muted">Paid {paidStudents} · Partial {partialStudents} · Unpaid {unpaidStudents}</p>
              <div className="mt-4 flex gap-2"><button className="btn btn-outline" onClick={() => setModal({ type: "group", row: group })}>{copy.edit}</button><button className="btn btn-danger" onClick={() => confirm("Archive group? Students will stay safe.") && action("archiveGroup", { id: group.id }, "Group archived")}>{copy.archive}</button></div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  function renderPayments() {
    return (
      <div className="space-y-5">
        <Toolbar><button className="btn btn-primary" onClick={() => setModal({ type: "payment" })}><Plus size={16} /> {copy.addPayment}</button></Toolbar>
        <section className="stats-grid compact">
          {stat(copy.totalCollected, formatCurrency(data.payments.reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0), currency), `${data.payments.length} ${isArabic ? "دفعة" : "payments"}`, <CircleDollarSign />, "green")}
          {stat("محمد", formatCurrency(data.payments.filter((payment) => (payment.collected_by || payment.notes || "").includes("محمد")).reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0), currency), isArabic ? "استلمه محمد" : "Collected by Mohamed", <Users />, "blue")}
          {stat("عبدالله", formatCurrency(data.payments.filter((payment) => (payment.collected_by || payment.notes || "").includes("عبدالله")).reduce((sum, payment) => sum + Number(payment.payment_amount || 0), 0), currency), isArabic ? "استلمه عبدالله" : "Collected by Abdallah", <Users />, "yellow")}
        </section>
        <div className="section-header"><h2 className="section-title"><span className="dot" />{isArabic ? "الدفعات" : "Payments"}</h2><span className="badge">{data.payments.length}</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>#</th><th>{isArabic ? "اسم الطالب" : "Student"}</th><th>{isArabic ? "الجروب" : "Group"}</th><th>{isArabic ? "المبلغ" : "Amount"}</th><th>{isArabic ? "إجمالي المدفوع" : "Total paid"}</th><th>{isArabic ? "المتبقي" : "Remaining"}</th><th>{isArabic ? "الطريقة" : "Method"}</th><th>{isArabic ? "استلمه" : "Collected by"}</th><th>{isArabic ? "التاريخ" : "Date"}</th><th>{isArabic ? "ملاحظات" : "Notes"}</th></tr></thead>
            <tbody>{data.payments.map((payment) => <tr key={payment.id}><td>{payment.payment_code}</td><td>{payment.student_name}</td><td>{payment.group_name || "-"}</td><td className="green-text">{formatCurrency(payment.payment_amount, currency)}</td><td>{formatCurrency(payment.total_paid_after_payment, currency)}</td><td className={Number(payment.remaining_after_payment) > 0 ? "red-text" : "green-text"}>{formatCurrency(payment.remaining_after_payment, currency)}</td><td>{payment.payment_method || "-"}</td><td><span className="badge">{payment.collected_by || extractCollector(payment.notes) || "-"}</span></td><td>{payment.payment_date}</td><td>{payment.notes}</td></tr>)}</tbody>
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
        <section className="stats-grid compact">{stat("Income", formatCurrency(income, currency), "Cashbook", <CircleDollarSign />, "green")}{stat("Expenses", formatCurrency(expense, currency), "Cashbook", <Landmark />, "red")}{stat("Net", formatCurrency(income - expense, currency), "Income - Expense", <Gauge />, "blue")}</section>
        <Toolbar><button className="btn btn-primary" onClick={() => setModal({ type: "cashbook" })}><Plus size={16} /> {copy.addEntry}</button></Toolbar>
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
        <section className="stats-grid compact">{stat("Paid students", paid, "Fully settled", <Users />, "green")}{stat("Partially paid", partial, "Need follow-up", <Receipt />, "yellow")}{stat("Unpaid students", unpaid, "No payment yet", <Archive />, "red")}</section>
        <Panel title={isArabic ? "تقرير الجروبات" : "Group report"}>
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
        <Panel title={copy.importStatus}>
          <div className="space-y-3 text-sm muted">
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
        <Panel title={copy.validationChecklist}>
          <div className="space-y-3 text-sm muted">
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
          <select className="input wide" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
            {data.students.map((student) => <option key={student.id} value={student.id}>{student.student_code} - {student.student_name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!selectedStudent} onClick={() => selectedStudent && generateInvoice(selectedStudent.id)}>{copy.generateInvoice}</button>
          <a className="btn btn-success" href={selectedStudent ? whatsapp(selectedStudent) : "#"} target="_blank"><MessageCircle size={16} /> {copy.whatsapp}</a>
          <button className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> {copy.print}</button>
          <button className="btn btn-outline" onClick={downloadInvoicePdf}><Download size={16} /> {copy.downloadPdf}</button>
        </Toolbar>
        {selectedStudent ? <InvoicePreview refEl={invoiceRef} academyName={academyName} student={selectedStudent} payments={selectedPayments} invoice={selectedInvoice} currency={currency} language={language} /> : <Empty text={copy.noRows} />}
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
        <Panel title={copy.downloadBackup} action={<button className="btn btn-primary" onClick={downloadBackup}><Download size={16} /> {copy.downloadBackup}</button>}>
          <p className="text-sm leading-7 muted">Exports all important tables as JSON and CSV inside one ZIP file, then records the backup in the database and audit log.</p>
        </Panel>
        <Panel title={copy.backupHistory}>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>ID</th><th>File</th><th>Type</th><th>Date</th></tr></thead><tbody>{data.backups.map((backup) => <tr key={backup.id}><td>{backup.backup_code}</td><td>{backup.file_name}</td><td>{backup.backup_type}</td><td>{new Date(backup.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
        </Panel>
      </div>
    );
  }

  function renderModal() {
    return <div className="modal-overlay open no-print"><div className="modal">{modal?.type === "student" ? <StudentForm language={language} row={modal.row} groups={data.groups} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action(modal.row ? "updateStudent" : "createStudent", modal.row ? { ...payload, id: modal.row.id } : payload, modal.row ? "Student updated" : "Student added")} /> : null}{modal?.type === "group" ? <GroupForm language={language} row={modal.row} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action(modal.row ? "updateGroup" : "createGroup", modal.row ? { ...payload, id: modal.row.id } : payload, modal.row ? "Group updated" : "Group added")} /> : null}{modal?.type === "payment" ? <PaymentForm language={language} students={data.students} selected={modal.student} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action("createPayment", payload, "Payment recorded")} /> : null}{modal?.type === "cashbook" ? <CashbookForm language={language} saving={saving} onClose={() => setModal(null)} onSubmit={(payload) => action("createCashbookEntry", payload, "Cashbook entry added")} /> : null}</div></div>;
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

  function stat(label: string, value: string | number, sub: string, icon: React.ReactNode, tone = "blue") {
    return <article className={`stat-card ${tone}`}><div className="card-icon">{icon}</div><p className="card-label">{label}</p><h3 className="card-value">{value}</h3><p className="card-sub">{sub}</p></article>;
  }
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="section-header"><h3 className="section-title"><span className="dot" />{title}</h3>{action}</div>{children}</section>;
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

function Row({ title, sub, value }: { title: string; sub: string; value: string }) {
  return <div className="receiver-row"><div><p className="font-bold">{title}</p><p className="muted">{sub}</p></div><p className="font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric"><p className="metric-label">{label}</p><p className="metric-value">{value}</p></div>;
}

function paymentBadge(status: string) {
  const className = status === "Paid" ? "badge-paid" : status === "Partially Paid" ? "badge-partial" : "badge-unpaid";
  return <span className={`badge ${className}`}>{status}</span>;
}

function setting(key: string, settings: AppData["settings"]) {
  return settings.find((row) => row.key === key)?.value || "";
}

function extractCollector(notes: string | null) {
  const value = notes || "";
  if (value.includes("محمد")) return "محمد";
  if (value.includes("عبدالله")) return "عبدالله";
  return "";
}

function MiniPayments({ rows }: { rows: Payment[] }) {
  return rows.length ? rows.map((payment) => <Row key={payment.id} title={payment.student_name} sub={payment.payment_code} value={String(payment.payment_amount)} />) : <Empty text="No payments yet." />;
}

function StudentForm({ language, row, groups, saving, onSubmit, onClose }: { language: Language; row?: Student; groups: Group[]; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  const ar = language === "ar";
  return <FormShell title={row ? (ar ? "تعديل طالب" : "Edit student") : (ar ? "إضافة طالب" : "Add student")} saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={row || { registration_date: todayIso(), student_status: "Active" }} fields={[["student_name", ar ? "اسم الطالب" : "Student name"], ["phone", ar ? "التليفون" : "Phone"], ["parent_phone", ar ? "تليفون ولي الأمر" : "Parent phone"], ["course", ar ? "الكورس" : "Course"], ["course_price", ar ? "سعر الكورس" : "Course price", "number"], ["paid_amount", ar ? "المدفوع" : "Paid amount", "number"], ["registration_date", ar ? "تاريخ التسجيل" : "Registration date", "date"], ["notes", ar ? "ملاحظات" : "Notes"]]} select={{ name: "group_id", label: ar ? "الجروب" : "Group", options: groups.map((group) => [group.id, group.group_name]) }} language={language} />;
}

function GroupForm({ language, row, saving, onSubmit, onClose }: { language: Language; row?: Group; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  const ar = language === "ar";
  return <FormShell title={row ? (ar ? "تعديل جروب" : "Edit group") : (ar ? "إضافة جروب" : "Add group")} saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={row || { status: "Active" }} fields={[["group_name", ar ? "اسم الجروب" : "Group name"], ["course", ar ? "الكورس" : "Course"], ["instructor", ar ? "المحاضر" : "Instructor"], ["schedule", ar ? "المواعيد" : "Schedule"], ["start_date", ar ? "تاريخ البداية" : "Start date", "date"], ["end_date", ar ? "تاريخ النهاية" : "End date", "date"], ["status", ar ? "الحالة" : "Status"], ["notes", ar ? "ملاحظات" : "Notes"]]} language={language} />;
}

function PaymentForm({ language, students, selected, saving, onSubmit, onClose }: { language: Language; students: Student[]; selected?: Student; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  const ar = language === "ar";
  return <FormShell title={ar ? "تسجيل دفعة" : "Record payment"} saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={{ student_id: selected?.id || students[0]?.id, payment_date: todayIso(), payment_method: "cash", collected_by: "محمد" }} fields={[["payment_amount", ar ? "المبلغ المدفوع" : "Payment amount", "number"], ["payment_method", ar ? "طريقة الدفع" : "Payment method"], ["collected_by", ar ? "المستلم" : "Collected by", "receiver"], ["payment_date", ar ? "تاريخ الدفع" : "Payment date", "date"], ["notes", ar ? "ملاحظات" : "Notes"]]} select={{ name: "student_id", label: ar ? "الطالب" : "Student", options: students.map((student) => [student.id, `${student.student_code} - ${student.student_name}`]) }} language={language} />;
}

function CashbookForm({ language, saving, onSubmit, onClose }: { language: Language; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void }) {
  const ar = language === "ar";
  return <FormShell title={ar ? "إضافة حركة خزينة" : "Add cashbook entry"} saving={saving} onClose={onClose} onSubmit={onSubmit} defaults={{ date: todayIso(), type: "Expense" }} fields={[["date", ar ? "التاريخ" : "Date", "date"], ["type", ar ? "النوع" : "Type"], ["category", ar ? "التصنيف" : "Category"], ["description", ar ? "الوصف" : "Description"], ["amount", ar ? "المبلغ" : "Amount", "number"], ["notes", ar ? "ملاحظات" : "Notes"]]} language={language} />;
}

function FormShell({ title, fields, select, defaults, saving, onSubmit, onClose, language }: { title: string; fields: string[][]; select?: { name: string; label: string; options: string[][] }; defaults: Record<string, unknown>; saving: boolean; onSubmit: (payload: Record<string, unknown>) => void; onClose: () => void; language: Language }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries(form.entries()));
  }
  return <form onSubmit={submit}><div className="mb-5 flex items-center justify-between"><h3 className="modal-title">{title}</h3><button type="button" className="btn btn-outline" onClick={onClose}>{language === "ar" ? "إغلاق" : "Close"}</button></div><div className="field-grid">{select ? <label className="form-label">{select.label}<select className="input mt-2" name={select.name} defaultValue={String(defaults[select.name] || "")}>{select.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}{fields.map(([name, label, type]) => <label key={name} className="form-label">{label}{type === "receiver" ? <select className="input mt-2" name={name} defaultValue={String(defaults[name] || "محمد")}><option value="محمد">محمد</option><option value="عبدالله">عبدالله</option></select> : <input className="input mt-2" name={name} type={type || "text"} defaultValue={String(defaults[name] || "")} />}</label>)}</div><button className="btn btn-primary mt-6 w-full" disabled={saving}>{saving ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : (language === "ar" ? "حفظ" : "Save")}</button></form>;
}

function SettingCard({ label, value, onSave }: { label: string; value: string; onSave: (value: string) => void }) {
  const [local, setLocal] = useState(value);
  return <section className="card"><label className="form-label">{label}</label><textarea className="input mt-2 min-h-24" value={local} onChange={(event) => setLocal(event.target.value)} /><button className="btn btn-primary mt-4" onClick={() => onSave(local)}>Save</button></section>;
}

function InvoicePreview({ refEl, academyName, student, payments, invoice, currency, language }: { refEl: React.RefObject<HTMLDivElement | null>; academyName: string; student: Student; payments: Payment[]; invoice: Invoice | null; currency: string; language: Language }) {
  const ar = language === "ar";
  return <section ref={refEl} className="invoice-paper" dir={ar ? "rtl" : "ltr"}><div className="invoice-head"><div className="flex items-center gap-4"><Image src="/logo.jpg" alt="Code Wave logo" width={78} height={78} className="rounded-xl object-cover" /><div><h1 className="invoice-title">{academyName}</h1><p className="muted-dark">{ar ? "فاتورة تدريب" : "Professional training invoice"}</p></div></div><div className={ar ? "text-left" : "text-right"}><p className="muted-dark">{ar ? "فاتورة" : "Invoice"}</p><h2 className="text-2xl font-black">{invoice?.invoice_code || "INV-DRAFT"}</h2><p className="muted-dark">{invoice?.invoice_date || todayIso()}</p></div></div><div className="invoice-grid"><Metric label="Student ID" value={student.student_code} /><Metric label={ar ? "اسم الطالب" : "Student Name"} value={student.student_name} /><Metric label={ar ? "التليفون" : "Phone"} value={student.phone || "-"} /><Metric label={ar ? "ولي الأمر" : "Parent Phone"} value={student.parent_phone || "-"} /><Metric label={ar ? "الكورس" : "Course"} value={student.course || "-"} /><Metric label={ar ? "الجروب" : "Group"} value={student.group_name || "-"} /><Metric label={ar ? "سعر الكورس" : "Course Price"} value={formatCurrency(student.course_price, currency)} /><Metric label={ar ? "المدفوع" : "Paid Amount"} value={formatCurrency(student.paid_amount, currency)} /><Metric label={ar ? "المتبقي" : "Remaining Amount"} value={formatCurrency(student.remaining_amount, currency)} /><Metric label={ar ? "حالة الدفع" : "Payment Status"} value={student.payment_status} /></div><h3 className="mt-8 text-xl font-black">{ar ? "سجل الدفعات" : "Payment history"}</h3><div className="mt-3 table-wrap invoice-table"><table className="data-table"><thead><tr><th>ID</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "الطريقة" : "Method"}</th><th>{ar ? "استلمه" : "Collected by"}</th><th>{ar ? "المتبقي" : "Remaining"}</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.payment_code}</td><td>{payment.payment_date}</td><td>{formatCurrency(payment.payment_amount, currency)}</td><td>{payment.payment_method}</td><td>{payment.collected_by || extractCollector(payment.notes) || "-"}</td><td>{formatCurrency(payment.remaining_after_payment, currency)}</td></tr>)}</tbody></table></div><p className="mt-8 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Notes: {student.notes || invoice?.notes || "Thank you for choosing Code Wave Academy."}</p></section>;
}
