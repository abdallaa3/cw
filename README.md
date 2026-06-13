# Code Wave Academy

Modern academy management system built with Next.js, TypeScript, Tailwind CSS, and Supabase PostgreSQL.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Server-side admin API with signed cookie session
- In-app JSON/CSV ZIP backups
- Local SQL backups with `pg_dump`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment example:

```bash
copy .env.example .env.local
```

3. Fill `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=code.wave
SESSION_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code.

4. Run the Supabase schema:

Open Supabase SQL Editor and run:

```bash
supabase/migrations/0001_initial_schema.sql
```

5. Start development:

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Validated Migration Targets

The old Google Apps Script system was validated after import with:

- Students: 83
- Groups: 18
- Payments: 76
- Total paid: 254900
- Total remaining: 137600
- Pending payments count: 40

Migration should import these tables into Supabase:

- `students`
- `groups`
- `payments`
- `invoices` if available
- `cashbook` if available
- `audit_logs` if useful
- `settings`

Validation rules:

- Every payment must link to a valid `students.id`.
- Every student should link to `groups.id` where available.
- `remaining_amount = course_price - paid_amount`.
- `payment_status` must be:
  - `Unpaid` when paid amount is 0
  - `Partially Paid` when paid amount is greater than 0 and less than course price
  - `Paid` when paid amount is greater than or equal to course price

## In-App Full Backup

Go to:

```bash
/backup
```

Click:

```bash
Download Full Backup
```

The app downloads:

```bash
Code-Wave-Academy-Full-Backup-YYYY-MM-DD.zip
```

ZIP structure:

```bash
json/students.json
json/groups.json
json/payments.json
json/invoices.json
json/cashbook.json
json/audit_logs.json
json/settings.json
json/backups.json
json/courses.json
csv/students.csv
csv/groups.csv
csv/payments.csv
csv/invoices.csv
csv/cashbook.csv
csv/audit_logs.csv
csv/settings.csv
csv/backups.csv
csv/courses.csv
```

After download, the app creates a row in `backups` and an entry in `audit_logs`.

## SQL Database Backup

Install PostgreSQL tools so `pg_dump` is available in `PATH`.

Run:

```bash
npm run backup
```

Output:

```bash
backups/Code-Wave-Academy-DB-Backup-YYYY-MM-DD.sql
```

The `backups/` folder is ignored by Git.

## Weekly Backup on Windows

Create a weekly scheduled task from PowerShell:

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd F:\cwpro; npm run backup`""
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 9am
Register-ScheduledTask -TaskName "Code Wave Academy Weekly Backup" -Action $Action -Trigger $Trigger -Description "Weekly Supabase SQL backup for Code Wave Academy"
```

Make sure `.env.local` contains `DATABASE_URL`, or set `DATABASE_URL` at the system/user environment level.

## Restore from JSON/CSV Backup

1. Extract the ZIP.
2. Import tables in this order:
   - `groups`
   - `students`
   - `payments`
   - `invoices`
   - `cashbook`
   - `settings`
   - `backups`
   - `audit_logs`
   - `courses`
3. Use Supabase Table Editor, SQL scripts, or a temporary import script.
4. Validate totals after restore.

## Restore from SQL Dump

Use `psql`:

```bash
psql "postgresql://postgres:password@host:5432/postgres" -f backups/Code-Wave-Academy-DB-Backup-YYYY-MM-DD.sql
```

Confirm tables and totals after restore.

## Vercel Deployment

1. Push this project to GitHub.
2. Create a Vercel project from the repository.
3. Add environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
SESSION_SECRET
DATABASE_URL
```

4. Deploy.
5. Test login, dashboard, students, payments, invoices, backup download, and PDF download.

## GitHub

If GitHub CLI is available:

```bash
gh auth login
gh repo create code-wave-academy --private --source=. --remote=origin --push
```

Do not commit `.env.local`, SQL dumps, or generated backups.

## Core Checks Before Production

- `npm run build`
- Login works with `ADMIN_PASSWORD`
- Dashboard loads from Supabase
- Add/edit/archive student
- Add/edit/archive group
- Record payment and verify balance recalculation
- Generate invoice
- Download invoice PDF
- WhatsApp links use parent phone first
- Download Full Backup ZIP
- `npm run backup`
- Migration totals match validated old data
