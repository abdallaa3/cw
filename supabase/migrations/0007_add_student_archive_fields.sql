-- ════════════════════════════════════════════════════════════════════════
-- 0007 — Add student archive/renewal fields (SAFE / NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------
-- Supports the "renew subscription" flow: renewing a student NEVER deletes
-- or mutates old data. Instead, the old student row is archived in place
-- and a brand-new student row is created for the new subscription. Old
-- payments, old cashbook entries and receiver balances are never touched.
--
-- New columns on students:
--   archived_at              timestamptz  nullable — set when archived
--   archive_reason           text         nullable — e.g. 'renewed'
--   renewed_to_student_id    uuid         nullable — old → points at the new row
--   renewed_from_student_id  uuid         nullable — new → points back at the old row
--
-- All columns are nullable with no default change to existing rows, so
-- every existing student is unaffected (archived_at stays NULL = active).
--
-- No DROP. No DELETE. No TRUNCATE. No data rewritten.
-- ════════════════════════════════════════════════════════════════════════

alter table public.students
  add column if not exists archived_at             timestamptz,
  add column if not exists archive_reason           text,
  add column if not exists renewed_to_student_id    uuid references public.students(id),
  add column if not exists renewed_from_student_id  uuid references public.students(id);

-- Fast filtering for "active students" (archived_at is null) on the Students page.
create index if not exists students_archived_at_idx on public.students(archived_at);
