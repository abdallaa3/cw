// Domain types — mirror the Flask models (app/models.py) of Wave Academy.

export const RECEIVERS = ["محمد", "عبدالله"] as const;
export type Receiver = (typeof RECEIVERS)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "vodafone_cash", "instapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const GROUP_TYPES = ["online", "offline"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const SUBSCRIPTION_TYPES = ["monthly", "term"] as const;
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

// Study type (online / offline) — applies to both students and groups.
export const STUDY_TYPES = ["online", "offline"] as const;
export type StudyType = (typeof STUDY_TYPES)[number];

// Online students can be private or group.
export const ONLINE_TYPES = ["private", "group"] as const;
export type OnlineType = (typeof ONLINE_TYPES)[number];

// Arabic weekday names, indexed to match JS Date.getUTCDay() (0 = الأحد).
export const WEEKDAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const ENTRY_TYPES = ["in", "out"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

// Financial transaction types on the payments table.
// amount is ALWAYS stored positive; the sign is implied by type + direction.
export const TRANSACTION_TYPES = ["payment", "refund", "adjustment", "cancelled"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Direction for adjustment transactions only.
export const ADJUSTMENT_DIRECTIONS = ["increase", "decrease"] as const;
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number];

export type Group = {
  id: string;
  group_number: string;
  region: string;
  type: GroupType;
  subscription_type: SubscriptionType;
  branch: string | null;
  day1: string | null;
  start_time1: string | null;
  end_time1: string | null;
  day2: string | null;
  start_time2: string | null;
  end_time2: string | null;
  notes: string | null;
  created_at: string;
  students_count?: number;
};

export type Student = {
  id: string;
  name: string;
  phone: string | null;
  age: number | null;
  study_type: StudyType;
  online_type: OnlineType | null;
  branch: string | null;
  group_id: string | null;
  group_number: string | null;
  region: string | null;
  total_amount: number;
  installments: number;
  installment_amount: number;
  next_due_date: string | null;
  notes: string | null;
  created_at: string;
  paid_amount: number;
  remaining_amount: number;
  payments?: Payment[];
  // Renewal / archive (see migration 0007) — archived_at set ⇒ this is an old,
  // renewed-from record kept only for history; never deleted.
  archived_at: string | null;
  archive_reason: string | null;
  renewed_to_student_id: string | null;
  renewed_from_student_id: string | null;
};

export type StudentStatusFilter = "active" | "archived" | "all";

export type Payment = {
  id: string;
  student_id: string;
  student_name: string | null;
  group_number?: string | null;
  amount: number;
  transaction_type: TransactionType;
  direction: AdjustmentDirection | null;
  method: PaymentMethod;
  received_by: Receiver;
  payment_date: string;
  image_path: string | null;
  notes: string | null;
  created_at: string;
};

export type CashEntry = {
  id: string;
  owner: Receiver;
  entry_type: EntryType;
  amount: number;
  notes: string | null;
  entry_date: string;
  linked_payment_id: string | null;
  linked_student_id: string | null;
  linked_student_name: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string;
  details: string | null;
  created_at: string;
};

export type ReceiverSummary = { received_by: string; total: number; count: number };
export type MethodSummary = { method: string; total: number; count: number };
export type GroupSummary = {
  group_id: string;
  group_number: string;
  region: string;
  students_count: number;
  total_expected: number;
  total_paid: number;
  total_remaining: number;
};

export type TodayGroup = {
  id: string;
  group_number: string;
  type: GroupType;
  region: string;
  branch: string | null;
  students_count: number;
  day: string;
  start_time: string | null;
  end_time: string | null;
};

export type OwedStudent = {
  id: string;
  name: string;
  phone: string | null;
  group_number: string | null;
  remaining_amount: number;
  next_due_date: string | null;
};

export type NoGroupStudent = {
  id: string;
  name: string;
  phone: string | null;
  study_type: StudyType;
  remaining_amount: number;
};

export type DashboardData = {
  total_collected: number;
  total_expected: number;
  total_remaining: number;
  total_students: number;
  total_groups: number;
  paid_students_count: number;
  not_paid_students_count: number;
  cash_balances: CashBalances;
  receivers_summary: ReceiverSummary[];
  methods_summary: MethodSummary[];
  groups_summary: GroupSummary[];
  recent_payments: Payment[];
  today_schedule: TodayGroup[];
  owed_students: OwedStudent[];
  no_group_students: NoGroupStudent[];
  recent_audits: AuditLog[];
};

export type CashBalances = Record<Receiver, number>;
