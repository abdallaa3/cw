# Wave Academy (Code Wave) — Next.js + Supabase

نظام الإدارة المالية لأكاديمية Code Wave. هذه النسخة (Next.js + Supabase) تطابق التطبيق الأصلي
(Flask + SQLite) في الواجهة العربية RTL، الثيم الداكن، المنطق، وبنية البيانات.

## التقنيات
- Next.js (App Router) + React + TypeScript
- Supabase PostgreSQL (Server Components + Server Actions، عبر service-role key)
- تصميم GitHub-dark RTL مطابق للأصل (بدون مكتبات UI خارجية)

## الصفحات
لوحة التحكم · الطلاب · الجروبات · الدفعات · الخزينة · التقارير · استيراد Excel · سجل العمليات · الفاتورة

## نموذج البيانات (يطابق app/models.py الأصلي)
- `groups` — group_number, region, type(online/offline), subscription_type(monthly/term), notes, created_at
- `students` — name, phone, group_id, total_amount, installments, installment_amount, notes, created_at
  - المدفوع/المتبقي محسوبان من جدول الدفعات (غير مخزّنين) تماماً مثل paid_amount()/remaining_amount()
- `payments` — amount, method, received_by(محمد/عبدالله), payment_date, image_path, notes
- `cash_entries` — owner, entry_type(in/out), amount, entry_date, linked_payment_id, linked_student_id
- `audit_logs` — actor, action, entity, entity_id, description, details(jsonb), created_at

## المنطق المنقول من Flask
- تسجيل دفعة ينشئ تلقائياً حركة خزينة (in) للمستلم، مرتبطة بالدفعة.
- حذف دفعة يحذف حركة الخزينة المرتبطة (ON DELETE CASCADE).
- لا يمكن حذف حركة خزينة مرتبطة بدفعة من صفحة الخزينة.
- حذف طالب يحذف دفعاته (cascade). حذف جروب لا يحذف الطلاب (group_id → SET NULL).
- كل عمليات الإضافة/التعديل/الحذف تُسجَّل في سجل العمليات.
- التواريخ بتوقيت القاهرة (UTC+3).

## الإعداد المحلي

1. التثبيت:
```bash
npm install
```

2. انسخ ملف البيئة واملأه:
```bash
cp .env.example .env.local
```
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # سرّي — server only
ADMIN_PASSWORD=code.wave
SESSION_SECRET=at-least-24-characters-long-random
```

3. شغّل المايجريشن على Supabase (SQL Editor):
```
supabase/migrations/0003_wave_academy_schema.sql
```
> هذا يستبدل المخطط الإنجليزي القديم بالمخطط المطابق للأصل، وينشئ bucket باسم
> `payment-images` لرفع صور الإيصالات.

4. التشغيل:
```bash
npm run dev      # http://localhost:3000
npm run build    # بناء الإنتاج
npm run lint     # فحص ESLint
```

## رفع صور الإيصالات
يتم الرفع إلى Supabase Storage (bucket: `payment-images`) عبر service-role، ويُحفظ الرابط
العام في `payments.image_path`.

## استيراد / تصدير Excel
- الاستيراد: يدعم `.xlsx` و `.csv` (قارئ xlsx مبني على jszip بدون مكتبات خارجية)،
  ويتعرف على أعمدة عربية/إنجليزية ويحلّل «محمد كاش» / «عبدالله تحويل» للمستلم والطريقة.
- التصدير: من صفحة التقارير إلى `.xlsx` (الطلاب/الدفعات/الجروبات).
