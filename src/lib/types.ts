export type Status = "Active" | "Paused" | "Completed" | "Cancelled" | "Archived";
export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid";
export type CashbookType = "Income" | "Expense";

export type Student = {
  id: string;
  student_code: string;
  student_name: string;
  phone: string | null;
  parent_phone: string | null;
  course: string | null;
  group_id: string | null;
  group_name: string | null;
  course_price: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  student_status: Status;
  notes: string | null;
  registration_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Group = {
  id: string;
  group_code: string;
  group_name: string;
  course: string | null;
  instructor: string | null;
  schedule: string | null;
  start_date: string | null;
  end_date: string | null;
  status: Status;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  payment_code: string;
  student_id: string;
  student_code: string;
  student_name: string;
  group_id: string | null;
  group_name: string | null;
  course: string | null;
  payment_amount: number;
  total_paid_after_payment: number;
  remaining_after_payment: number;
  payment_method: string | null;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  invoice_code: string;
  student_id: string;
  student_code: string;
  student_name: string;
  invoice_date: string;
  course: string | null;
  group_name: string | null;
  course_price: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
};

export type CashbookEntry = {
  id: string;
  cashbook_code: string;
  date: string;
  type: CashbookType;
  category: string | null;
  description: string | null;
  amount: number;
  related_student_id: string | null;
  related_payment_id: string | null;
  notes: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  log_code: string;
  timestamp: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  user: string;
  notes: string | null;
};

export type Setting = {
  id: string;
  key: string;
  value: string | null;
  updated_at: string;
};

export type BackupRecord = {
  id: string;
  backup_code: string;
  file_name: string;
  backup_type: string;
  tables_included: string[] | null;
  created_at: string;
  notes: string | null;
};

export type DashboardData = {
  totalStudents: number;
  activeStudents: number;
  archivedStudents: number;
  totalGroups: number;
  activeGroups: number;
  totalCollected: number;
  totalRemaining: number;
  pendingPaymentsCount: number;
  todayPayments: number;
  thisMonthRevenue: number;
  recentPayments: Payment[];
  recentInvoices: Invoice[];
  recentAuditLogs: AuditLog[];
};

export type AppData = {
  students: Student[];
  groups: Group[];
  payments: Payment[];
  invoices: Invoice[];
  cashbook: CashbookEntry[];
  auditLogs: AuditLog[];
  settings: Setting[];
  backups: BackupRecord[];
};

export const backupTables = [
  "students",
  "groups",
  "payments",
  "invoices",
  "cashbook",
  "audit_logs",
  "settings",
  "backups",
  "courses",
] as const;
