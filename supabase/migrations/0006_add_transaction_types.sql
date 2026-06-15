-- ════════════════════════════════════════════════════════════════════════
-- 0006 — Add transaction_type + direction to payments (SAFE / NON-DESTRUCTIVE)
-- ------------------------------------------------------------------------
-- Adds two columns to payments:
--   transaction_type  TEXT  default 'payment'
--      Values: payment | refund | adjustment | cancelled
--   direction         TEXT  nullable
--      Values: increase | decrease  (only meaningful for adjustment type)
--
-- All existing rows get transaction_type='payment' (the DEFAULT handles this).
-- The amount > 0 constraint is kept — amounts are ALWAYS stored as positive
-- numbers; the sign is implied by transaction_type + direction.
--
-- A linked cash_entries row still uses entry_type='in' for net-positive
-- transactions (payment, adjustment increase) and 'out' for net-negative
-- (refund, adjustment decrease). Cancelled rows have NO cash_entries row.
-- ════════════════════════════════════════════════════════════════════════

alter table public.payments
  add column if not exists transaction_type text not null default 'payment',
  add column if not exists direction        text;          -- 'increase' | 'decrease'

-- Ensure any pre-existing NULL values are corrected (NOT NULL + DEFAULT covers new rows)
update public.payments
  set transaction_type = 'payment'
  where transaction_type is null or transaction_type = '';

-- Constraints (idempotent guard)
do $$ begin
  alter table public.payments
    add constraint payments_transaction_type_check
    check (transaction_type in ('payment', 'refund', 'adjustment', 'cancelled'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.payments
    add constraint payments_direction_check
    check (direction is null or direction in ('increase', 'decrease'));
exception when duplicate_object then null; end $$;

-- Index for type-based filtering
create index if not exists payments_transaction_type_idx on public.payments(transaction_type);
