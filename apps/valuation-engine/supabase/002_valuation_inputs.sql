-- Questionnaire Responses
create table if not exists public.valuation_questionnaire_responses (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null unique references public.valuation_companies(id) on delete cascade,
  answers jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.valuation_questionnaire_responses enable row level security;

create policy "Users can access via company" on public.valuation_questionnaire_responses
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can insert via company" on public.valuation_questionnaire_responses
  for insert with check (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can update via company" on public.valuation_questionnaire_responses
  for update using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

-- Financials
create table if not exists public.valuation_financials (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.valuation_companies(id) on delete cascade,
  year_offset integer not null,

  revenue numeric default 0,
  cogs numeric default 0,
  salaries numeric default 0,
  other_opex numeric default 0,
  total_da numeric default 0,
  interest numeric default 0,
  taxes numeric default 0,

  receivables numeric default 0,
  inventory numeric default 0,
  payables numeric default 0,
  capex numeric default 0,
  debt numeric default 0,
  fundraising_plan numeric default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(company_id, year_offset)
);

alter table public.valuation_financials enable row level security;

create policy "Users can access financials via company" on public.valuation_financials
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can insert financials via company" on public.valuation_financials
  for insert with check (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can update financials via company" on public.valuation_financials
  for update using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

-- Cap Table
create table if not exists public.valuation_cap_table (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.valuation_companies(id) on delete cascade,
  shareholder_name text not null,
  share_percent numeric default 0,
  order_index integer,
  created_at timestamptz default now()
);

alter table public.valuation_cap_table enable row level security;

create policy "Users can access cap table via company" on public.valuation_cap_table
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can modify cap table via company" on public.valuation_cap_table
  for all using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

-- Funding Rounds
create table if not exists public.valuation_funding_rounds (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.valuation_companies(id) on delete cascade,
  round_name text,
  round_type text,
  closed_date date,
  post_money_or_cap numeric,
  investment_amount numeric,
  equity_percent numeric,
  created_at timestamptz default now()
);

alter table public.valuation_funding_rounds enable row level security;

create policy "Users can access rounds via company" on public.valuation_funding_rounds
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can modify rounds via company" on public.valuation_funding_rounds
  for all using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

-- Comparables
create table if not exists public.valuation_comparables (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.valuation_companies(id) on delete cascade,
  company_name text,
  metric numeric,
  multiple numeric,
  metric_type text,
  date_observed date,
  source text,
  gathered_by text,
  created_at timestamptz default now()
);

alter table public.valuation_comparables enable row level security;

create policy "Users can access comparables via company" on public.valuation_comparables
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can modify comparables via company" on public.valuation_comparables
  for all using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

-- Transaction
create table if not exists public.valuation_transaction (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null unique references public.valuation_companies(id) on delete cascade,
  capital_needed numeric,
  use_of_funds jsonb,
  created_at timestamptz default now()
);

alter table public.valuation_transaction enable row level security;

create policy "Users can access transaction via company" on public.valuation_transaction
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can modify transaction via company" on public.valuation_transaction
  for all using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));
