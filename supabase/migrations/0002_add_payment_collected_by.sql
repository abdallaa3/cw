alter table public.payments
add column if not exists collected_by text;

create index if not exists payments_collected_by_idx
on public.payments(collected_by);
