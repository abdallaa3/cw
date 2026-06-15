-- ════════════════════════════════════════════════════════════════════════
-- 0005 — Backups storage bucket (SAFE / NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------
-- Adds a PRIVATE storage bucket "backups" for generated Excel backup files.
-- Idempotent: does nothing if the bucket already exists. No tables touched.
-- Files are accessed only through the server (service-role) via signed URLs,
-- so no public policies are added.
-- ════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
