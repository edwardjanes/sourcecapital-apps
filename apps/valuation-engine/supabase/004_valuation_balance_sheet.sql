-- Balance sheet snapshot table for DCF and asset-based valuation
create table if not exists public.valuation_balance_sheet (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null unique references public.valuation_companies(id) on delete cascade,
  cash_and_equivalents numeric default 0,
  non_operating_cash numeric default 0,
  tangible_assets numeric default 0,
  intangible_assets numeric default 0,
  financial_assets numeric default 0,
  deferred_tax_assets numeric default 0,
  short_term_liabilities numeric default 0,
  long_term_liabilities numeric default 0,
  equity numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.valuation_balance_sheet enable row level security;

create policy "Users can access balance sheet via company" on public.valuation_balance_sheet
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can modify balance sheet via company" on public.valuation_balance_sheet
  for all using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));
