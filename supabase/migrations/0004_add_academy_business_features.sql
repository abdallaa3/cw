-- ════════════════════════════════════════════════════════════════════════
-- 0004 — Add academy business features (SAFE / NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------
-- This migration ONLY ADDS columns / indexes. It NEVER drops or recreates
-- existing tables and NEVER deletes data. Safe to run on a live database.
-- Every statement is idempotent (IF NOT EXISTS / guarded constraints), so it
-- can be re-run without error.
--
-- Adds:
--   students: age, study_type (online/offline), online_type (private/group),
--             branch (offline branch name), next_due_date (optional)
--   groups:   branch, weekly schedule (day1/start_time1/end_time1 and an
--             optional second day2/start_time2/end_time2)
-- ════════════════════════════════════════════════════════════════════════

-- ── students: new columns ──────────────────────────────────────────────────
alter table public.students add column if not exists age            integer;
alter table public.students add column if not exists study_type     text not null default 'offline';
alter table public.students add column if not exists online_type    text;          -- private / group (online students only)
alter table public.students add column if not exists branch         text;          -- branch name (offline students only)
alter table public.students add column if not exists next_due_date  date;          -- optional next installment due date

-- ── students: guarded check constraints ─────────────────────────────────────
do $$ begin
  alter table public.students
    add constraint students_study_type_check check (study_type in ('online','offline'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.students
    add constraint students_online_type_check check (online_type is null or online_type in ('private','group'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.students
    add constraint students_age_non_negative check (age is null or age >= 0);
exception when duplicate_object then null; end $$;

-- ── groups: new columns ─────────────────────────────────────────────────────
-- NOTE: groups.type already stores online/offline (study type) — reused as-is.
alter table public.groups add column if not exists branch       text;             -- branch name (offline groups)
alter table public.groups add column if not exists day1         text;             -- e.g. الأحد
alter table public.groups add column if not exists start_time1  text;             -- e.g. 18:00
alter table public.groups add column if not exists end_time1    text;             -- e.g. 20:00
alter table public.groups add column if not exists day2         text;             -- optional second weekly day
alter table public.groups add column if not exists start_time2  text;
alter table public.groups add column if not exists end_time2    text;

-- ── indexes (idempotent) ────────────────────────────────────────────────────
create index if not exists students_study_type_idx    on public.students(study_type);
create index if not exists students_next_due_date_idx  on public.students(next_due_date);
create index if not exists groups_day1_idx             on public.groups(day1);
create index if not exists groups_day2_idx             on public.groups(day2);
