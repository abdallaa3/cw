-- Code Wave Academy - Supabase PostgreSQL schema
-- Run this file in Supabase SQL Editor for a fresh project.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.student_status as enum ('Active', 'Paused', 'Completed', 'Cancelled', 'Archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('Unpaid', 'Partially Paid', 'Paid');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.cashbook_type as enum ('Income', 'Expense');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null unique,
  group_name text not null unique,
  course text,
  instructor text,
  schedule text,
  start_date date,
  end_date date,
  status public.student_status not null default 'Active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_group_code_format check (group_code ~ '^GRP-[0-9]{4,}$'),
  constraint groups_name_not_blank check (length(btrim(group_name)) > 0)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  student_name text not null,
  phone text,
  parent_phone text,
  course text,
  group_id uuid references public.groups(id) on delete set null,
  group_name text,
  course_price numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payment_status public.payment_status not null default 'Unpaid',
  student_status public.student_status not null default 'Active',
  notes text,
  registration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_student_code_format check (student_code ~ '^STU-[0-9]{4,}$'),
  constraint students_name_not_blank check (length(btrim(student_name)) > 0),
  constraint students_money_non_negative check (
    course_price >= 0 and paid_amount >= 0 and remaining_amount >= 0
  ),
  constraint students_remaining_amount_matches_balance check (
    remaining_amount = greatest(course_price - paid_amount, 0)
  ),
  constraint students_payment_status_matches_amounts check (
    (paid_amount = 0 and payment_status = 'Unpaid')
    or (paid_amount > 0 and paid_amount < course_price and payment_status = 'Partially Paid')
    or (paid_amount >= course_price and course_price > 0 and payment_status = 'Paid')
    or (course_price = 0 and paid_amount > 0 and payment_status = 'Paid')
  )
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_code text not null unique,
  student_id uuid not null references public.students(id) on delete restrict,
  student_code text not null,
  student_name text not null,
  group_id uuid references public.groups(id) on delete set null,
  group_name text,
  course text,
  payment_amount numeric(12,2) not null,
  total_paid_after_payment numeric(12,2) not null default 0,
  remaining_after_payment numeric(12,2) not null default 0,
  payment_method text,
  collected_by text,
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  constraint payments_payment_code_format check (payment_code ~ '^PAY-[0-9]{4,}$'),
  constraint payments_amount_positive check (payment_amount > 0),
  constraint payments_totals_non_negative check (
    total_paid_after_payment >= 0 and remaining_after_payment >= 0
  )
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_code text not null unique,
  student_id uuid not null references public.students(id) on delete restrict,
  student_code text not null,
  student_name text not null,
  invoice_date date not null default current_date,
  course text,
  group_name text,
  course_price numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payment_status public.payment_status not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint invoices_invoice_code_format check (invoice_code ~ '^INV-[0-9]{4,}$'),
  constraint invoices_money_non_negative check (
    course_price >= 0 and paid_amount >= 0 and remaining_amount >= 0
  )
);

create table if not exists public.cashbook (
  id uuid primary key default gen_random_uuid(),
  cashbook_code text not null unique,
  date date not null default current_date,
  type public.cashbook_type not null,
  category text,
  description text,
  amount numeric(12,2) not null,
  related_student_id uuid references public.students(id) on delete set null,
  related_payment_id uuid references public.payments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint cashbook_code_format check (cashbook_code ~ '^CASH-[0-9]{4,}$'),
  constraint cashbook_amount_non_negative check (amount >= 0)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  log_code text not null unique,
  timestamp timestamptz not null default now(),
  action text not null,
  entity_type text,
  entity_id text,
  description text,
  "user" text not null default 'Admin',
  notes text,
  created_at timestamptz not null default now(),
  constraint audit_logs_log_code_format check (log_code ~ '^LOG-[0-9]{4,}$'),
  constraint audit_logs_action_not_blank check (length(btrim(action)) > 0)
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_key_not_blank check (length(btrim(key)) > 0)
);

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  backup_code text not null unique,
  file_name text not null,
  backup_type text not null,
  tables_included text[] not null default '{}',
  created_at timestamptz not null default now(),
  notes text,
  constraint backups_backup_code_format check (backup_code ~ '^BKP-[0-9]{4,}$'),
  constraint backups_file_name_not_blank check (length(btrim(file_name)) > 0)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_name text not null unique,
  course_price numeric(12,2) not null default 0,
  duration text,
  status public.student_status not null default 'Active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_course_code_format check (course_code ~ '^CRS-[0-9]{4,}$'),
  constraint courses_name_not_blank check (length(btrim(course_name)) > 0),
  constraint courses_price_non_negative check (course_price >= 0)
);

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create index if not exists groups_status_idx on public.groups(status);
create index if not exists groups_created_at_idx on public.groups(created_at desc);

create index if not exists students_group_id_idx on public.students(group_id);
create index if not exists students_group_name_idx on public.students(group_name);
create index if not exists students_payment_status_idx on public.students(payment_status);
create index if not exists students_student_status_idx on public.students(student_status);
create index if not exists students_registration_date_idx on public.students(registration_date desc);
create index if not exists students_created_at_idx on public.students(created_at desc);

create unique index if not exists students_unique_active_name_parent_phone_idx
on public.students (lower(student_name), coalesce(parent_phone, ''))
where coalesce(parent_phone, '') <> '' and student_status <> 'Archived';

create unique index if not exists students_unique_active_name_phone_idx
on public.students (lower(student_name), coalesce(phone, ''))
where coalesce(phone, '') <> '' and student_status <> 'Archived';

create index if not exists payments_student_id_idx on public.payments(student_id);
create index if not exists payments_group_id_idx on public.payments(group_id);
create index if not exists payments_payment_date_idx on public.payments(payment_date desc);
create index if not exists payments_created_at_idx on public.payments(created_at desc);

create index if not exists invoices_student_id_idx on public.invoices(student_id);
create index if not exists invoices_invoice_date_idx on public.invoices(invoice_date desc);
create index if not exists invoices_created_at_idx on public.invoices(created_at desc);

create index if not exists cashbook_related_student_id_idx on public.cashbook(related_student_id);
create index if not exists cashbook_related_payment_id_idx on public.cashbook(related_payment_id);
create index if not exists cashbook_date_idx on public.cashbook(date desc);
create index if not exists cashbook_created_at_idx on public.cashbook(created_at desc);

create index if not exists audit_logs_timestamp_idx on public.audit_logs(timestamp desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

create index if not exists settings_created_at_idx on public.settings(created_at desc);
create index if not exists backups_created_at_idx on public.backups(created_at desc);
create index if not exists courses_created_at_idx on public.courses(created_at desc);

alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.cashbook enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;
alter table public.backups enable row level security;
alter table public.courses enable row level security;

insert into public.settings (key, value) values
  ('Academy Name', 'Code Wave Academy'),
  ('Currency', 'EGP'),
  ('Invoice Prefix', 'INV'),
  ('WhatsApp Message Template', 'Hello {student_name}, your remaining amount is {remaining_amount} {currency}.'),
  ('Default Course Price', '3000'),
  ('Backup Retention Days', '90')
on conflict (key) do nothing;

insert into public.courses (course_code, course_name, course_price, duration, status, description) values
  ('CRS-0001', 'Imported Course', 3000, null, 'Active', 'Default course used during migration')
on conflict (course_code) do nothing;
