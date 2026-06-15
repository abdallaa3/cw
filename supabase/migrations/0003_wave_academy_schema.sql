-- ════════════════════════════════════════════════════════════════════════
-- Wave Academy (Code Wave) — Supabase schema matching the original Flask app
-- ------------------------------------------------------------------------
-- This migration REPLACES the previous English schema (0001/0002) with a
-- data model that mirrors app/models.py from the reference Flask project:
--   Group / Student / Payment / CashEntry / AuditLog
--
-- Run this in the Supabase SQL Editor on a fresh project, OR run it on top of
-- the old schema (it drops the old tables first).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Drop the old English schema (replace, per migration plan) ──────────────
drop table if exists public.backups       cascade;
drop table if exists public.courses       cascade;
drop table if exists public.settings      cascade;
drop table if exists public.invoices      cascade;
drop table if exists public.cashbook      cascade;
drop table if exists public.audit_logs    cascade;
drop table if exists public.payments      cascade;
drop table if exists public.students      cascade;
drop table if exists public.groups        cascade;
drop table if exists public.cash_entries  cascade;

drop type if exists public.student_status cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.cashbook_type  cascade;

-- ── groups ────────────────────────────────────────────────────────────────
-- Matches Flask Group: group_number, region, type(online/offline),
-- subscription_type(monthly/term), notes, created_at
create table public.groups (
  id                uuid primary key default gen_random_uuid(),
  group_number      text not null,
  region            text not null,                          -- زقازيق / عبور / أونلاين / غيره
  type              text not null default 'offline',        -- online / offline
  subscription_type text not null default 'monthly',        -- monthly / term
  notes             text,
  created_at        timestamptz not null default now(),
  constraint groups_type_check check (type in ('online', 'offline')),
  constraint groups_subscription_check check (subscription_type in ('monthly', 'term'))
);

-- ── students ──────────────────────────────────────────────────────────────
-- Matches Flask Student. paid_amount / remaining_amount are NOT stored — they
-- are derived from the payments table (see src/lib/data.ts), exactly like the
-- Flask model's paid_amount()/remaining_amount() methods.
-- group_id is ON DELETE SET NULL so deleting a group never deletes students
-- (data-integrity requirement #8); the app warns before unlinking.
create table public.students (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  phone              text,
  group_id           uuid references public.groups(id) on delete set null,
  total_amount       numeric(12,2) not null default 0,
  installments       integer not null default 1,            -- عدد الأقساط
  installment_amount numeric(12,2) not null default 0,      -- قيمة القسط الواحد
  notes              text,
  created_at         timestamptz not null default now(),
  constraint students_name_not_blank check (length(btrim(name)) > 0),
  constraint students_money_non_negative check (total_amount >= 0 and installment_amount >= 0),
  constraint students_installments_positive check (installments >= 1)
);

-- ── payments ──────────────────────────────────────────────────────────────
-- Matches Flask Payment. Deleting a student cascades its payments
-- (Flask: cascade="all, delete-orphan").
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  amount       numeric(12,2) not null,
  method       text not null default 'cash',               -- cash / bank_transfer / vodafone_cash / instapay
  received_by  text not null,                              -- محمد / عبدالله
  payment_date date not null default current_date,
  image_path   text,
  notes        text,
  created_at   timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_method_check check (method in ('cash', 'bank_transfer', 'vodafone_cash', 'instapay')),
  constraint payments_received_by_check check (received_by in ('محمد', 'عبدالله'))
);

-- ── cash_entries (دفتر الخزينة) ───────────────────────────────────────────
-- Matches Flask CashEntry. A payment auto-creates an "in" entry linked via
-- linked_payment_id; deleting the payment removes that entry (ON DELETE
-- CASCADE) so balances stay correct.
create table public.cash_entries (
  id                uuid primary key default gen_random_uuid(),
  owner             text not null,                          -- محمد / عبدالله
  entry_type        text not null,                          -- in / out
  amount            numeric(12,2) not null,
  notes             text,
  entry_date        date not null default current_date,
  linked_payment_id uuid references public.payments(id) on delete cascade,
  linked_student_id uuid references public.students(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint cash_entries_owner_check check (owner in ('محمد', 'عبدالله')),
  constraint cash_entries_type_check check (entry_type in ('in', 'out')),
  constraint cash_entries_amount_positive check (amount > 0)
);

-- ── audit_logs (سجل العمليات — لا يُحذف أبداً) ─────────────────────────────
-- Matches Flask AuditLog. entity_id is text so it can hold a uuid.
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null default 'system',              -- محمد / عبدالله / system
  action      text not null,                                -- create / update / delete
  entity      text not null,                                -- payment / student / cashbook / group
  entity_id   text,
  description text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
create index groups_created_at_idx        on public.groups(created_at desc);
create index students_group_id_idx        on public.students(group_id);
create index students_created_at_idx      on public.students(created_at desc);
create index payments_student_id_idx      on public.payments(student_id);
create index payments_payment_date_idx    on public.payments(payment_date desc);
create index payments_received_by_idx     on public.payments(received_by);
create index payments_method_idx          on public.payments(method);
create index cash_entries_owner_idx       on public.cash_entries(owner);
create index cash_entries_entry_date_idx  on public.cash_entries(entry_date);
create index cash_entries_payment_idx     on public.cash_entries(linked_payment_id);
create index audit_logs_created_at_idx    on public.audit_logs(created_at desc);
create index audit_logs_entity_idx        on public.audit_logs(entity, entity_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- The app talks to Supabase only through the server-side service-role key,
-- which bypasses RLS. We enable RLS (no public policies) so the anon/public
-- key cannot read or write these tables directly.
alter table public.groups       enable row level security;
alter table public.students     enable row level security;
alter table public.payments     enable row level security;
alter table public.cash_entries enable row level security;
alter table public.audit_logs   enable row level security;

-- ── Storage bucket for payment images ──────────────────────────────────────
-- Public bucket so uploaded receipt images can be displayed via their URL.
insert into storage.buckets (id, name, public)
values ('payment-images', 'payment-images', true)
on conflict (id) do nothing;
