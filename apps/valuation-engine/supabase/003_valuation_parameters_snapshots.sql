-- Valuation Parameters
create table if not exists public.valuation_parameters (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null unique references public.valuation_companies(id) on delete cascade,
  current jsonb,
  defaults_snapshot jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.valuation_parameters enable row level security;

create policy "Users can access parameters via company" on public.valuation_parameters
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can modify parameters via company" on public.valuation_parameters
  for all using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

-- Valuation Snapshots (Historical Reports)
create table if not exists public.valuation_snapshots (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.valuation_companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  inputs jsonb,
  outputs jsonb,

  is_current boolean default false,

  created_at timestamptz default now()
);

alter table public.valuation_snapshots enable row level security;

create policy "Users can access snapshots via company" on public.valuation_snapshots
  for select using (exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid()));

create policy "Users can create snapshots for own company" on public.valuation_snapshots
  for insert with check (
    auth.uid() = created_by and
    exists (select 1 from public.valuation_companies c where c.id = company_id and c.owner_id = auth.uid())
  );

create policy "Users can update own snapshots" on public.valuation_snapshots
  for update using (auth.uid() = created_by);

create index idx_valuation_snapshots_company on public.valuation_snapshots(company_id);
create index idx_valuation_snapshots_current on public.valuation_snapshots(company_id, is_current);
create index idx_valuation_snapshots_created on public.valuation_snapshots(company_id, created_at desc);
