// Domain types — mirror the Flask models (app/models.py) of Wave Academy.

export const RECEIVERS = ["محمد", "عبدالله"] as const;
export type Receiver = (typeof RECEIVERS)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "vodafone_cash", "instapay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const GROUP_TYPES = ["online", "offline"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const SUBSCRIPTION_TYPES = ["monthly", "term"] as const;
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

export const ENTRY_TYPES = ["in", "out"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export type Group = {
  id: string;
  group_number: string;
  region: string;
  type: GroupType;
  subscription_type: SubscriptionType;
  notes: string | null;
  created_at: string;
  students_count?: number;
};

export type Student = {
  id: string;
  name: string;
  phone: string | null;
  group_id: string | null;
  group_number: string | null;
  region: string | null;
  total_amount: number;
  installments: number;
  installment_amount: number;
  notes: string | null;
  created_at: string;
  paid_amount: number;
  remaining_amount: number;
  payments?: Payment[];
};

export type Payment = {
  id: string;
  student_id: string;
  student_name: string | null;
  group_number?: string | null;
  amount: number;
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

export type DashboardData = {
  total_collected: number;
  total_expected: number;
  total_remaining: number;
  total_students: number;
  paid_students_count: number;
  not_paid_students_count: number;
  receivers_summary: ReceiverSummary[];
  methods_summary: MethodSummary[];
  groups_summary: GroupSummary[];
  recent_payments: Payment[];
};

export type CashBalances = Record<Receiver, number>;
