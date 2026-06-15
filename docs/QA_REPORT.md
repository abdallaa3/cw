# Code Wave Academy — QA Report

**Generated:** by the engineering pass described below.
**Environment note:** This sandbox cannot run `next build` / `next dev` (the repo's
`node_modules` was installed on Windows, so the Linux SWC binary is missing, and
the sandbox network is allowlist-blocked). Therefore interactive runtime testing
must be done by you on Vercel. Every item below is marked:

- **PASS** — statically verified (TypeScript + ESLint clean, wiring/logic reviewed in code).
- **NEEDS MANUAL CHECK** — requires a running deployment to confirm end-to-end.

Static checks that PASS for the whole project: `npx tsc --noEmit` → 0 errors,
`npx eslint .` → 0 errors/0 warnings.

## Summary status

| Page | Button / Action | Expected result | Status | Notes |
|------|-----------------|-----------------|--------|-------|
| Login | Open /login | Full-screen centered dark card, logo, title, RTL | PASS (CSS verified) | Classes `.login-screen/.login-card` now exist in globals.css; verified by static render |
| Login | Enter password + دخول | POST /api/auth/login, redirect to next/dashboard | NEEDS MANUAL CHECK | Requires server + SESSION_SECRET/ADMIN_PASSWORD |
| Login | Wrong password | Arabic error "كلمة المرور غير صحيحة" | PASS (logic) | 401 branch returns Arabic string |
| Login | Loading state | Spinner + "جاري الدخول..." while submitting | PASS (logic) | |
| Global | Protected route while logged out | Redirect to /login?next=... | PASS (middleware) | middleware matcher covers all pages incl. /invoice /backups |
| Sidebar | All nav links incl. الفواتير, النسخ الاحتياطية | Navigate + active state | PASS (wiring) | 10 links present; active state by pathname |
| Dashboard | Load | Stats, cash balances, today's schedule, owed, no-group, recent payments/audits | NEEDS MANUAL CHECK | Server data; needs DB |
| Dashboard | Refresh | Re-fetch (router.refresh) | NEEDS MANUAL CHECK | |
| Students | Add student (+ first payment) | Creates student + payment + cashbook entry | NEEDS MANUAL CHECK | Logic verified in data.ts createStudent |
| Students | Edit student | Updates fields | NEEDS MANUAL CHECK | |
| Students | Delete student | Deletes + cascade payments/cash | NEEDS MANUAL CHECK | confirm() dialog |
| Students | فاتورة (invoice) button | Opens /invoice?student=ID printable invoice | PASS (wiring) | Link present in StudentsView |
| Students | Filters (بدون جروب/Online/Offline/عليهم فلوس) | Client filter | PASS (logic) | |
| Students | 📥 تصدير | Download students .xlsx | NEEDS MANUAL CHECK | Browser download |
| Groups | Add/Edit group (schedule + branch) | Saves day1/day2 times, branch | NEEDS MANUAL CHECK | day1 required |
| Groups | Delete group | Deletes; students become بدون جروب | NEEDS MANUAL CHECK | ON DELETE SET NULL |
| Payments | Add/Edit/Delete payment | Linked cashbook entry created/updated/removed | NEEDS MANUAL CHECK | No duplicate cash entries (verified logic) |
| Payments | 📥 تصدير | Download payments .xlsx | NEEDS MANUAL CHECK | |
| Cashbook | Add/Edit/Delete manual entry | Manual CRUD | NEEDS MANUAL CHECK | |
| Cashbook | Edit/Delete payment-linked entry | Blocked with message | PASS (logic) | updateCashEntry & deleteCashEntry guard linked_payment_id |
| Cashbook | 📥 تصدير | Download cashbook .xlsx | NEEDS MANUAL CHECK | |
| Reports | تصدير Excel | 3-sheet workbook download | NEEDS MANUAL CHECK | |
| Import | Upload + Analyze (تحليل) | Dry-run preview counts, no writes | PASS (logic) | importWorkbookAction dryRun=true writes nothing |
| Import | Confirm import | Upsert; creates groups/students/payments | NEEDS MANUAL CHECK | Matches by phone; no deletes |
| Import | Backup file re-import | Upsert by id/phone; creates missing groups | NEEDS MANUAL CHECK | |
| Invoice | /invoice (no student) | Student picker with search | PASS (wiring) | InvoicePicker |
| Invoice | عرض الفاتورة | Printable invoice, real totals | NEEDS MANUAL CHECK | Needs DB student |
| Invoice | Print | Hides sidebar/header, prints card only | PASS (CSS) | @media print rules |
| Invoice | حفظ PDF | html2canvas + jsPDF download | NEEDS MANUAL CHECK | Arabic raster via canvas (image-based, renders Arabic correctly) |
| Backups | تصدير نسخة احتياطية Excel | Build 5-sheet xlsx, upload to Storage | NEEDS MANUAL CHECK | Needs 'backups' bucket (migration 0005) |
| Backups | List + Download | Signed URLs listed | NEEDS MANUAL CHECK | |
| Backups | /api/cron/backup?secret= | Creates backup if secret matches | NEEDS MANUAL CHECK | Set BACKUP_CRON_SECRET |
| Audit Log | Load + filters | Lists actions | NEEDS MANUAL CHECK | |

## How to verify the highest-risk items on Vercel

1. **Login layout** — open `/login`; the card must be centered both axes with the logo on top. (Static render confirmed centering.)
2. **Invoice** — sidebar → الفواتير → search → عرض الفاتورة → Print preview shows only the invoice.
3. **Import** — Import page → upload your workbook → تحليل الملف shows counts (nothing saved) → تأكيد الاستيراد.
4. **Backups** — create the `backups` bucket (run migration 0005), then "تصدير نسخة احتياطية Excel" and confirm a file appears with a working download link.
