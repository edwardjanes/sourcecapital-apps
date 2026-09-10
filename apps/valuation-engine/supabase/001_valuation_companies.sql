-- Valuation Companies Table
create table if not exists public.valuation_companies (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  raise_project_id uuid references public.raise_projects(id) on delete set null,

  -- Profile
  name text not null,
  country text,
  industry text,
  stage text default 'development',
  description text,
  website text,

  -- Team
  founders_count integer default 1,
  employees_count integer default 1,
  business_model text,
  scalable boolean,
  exit_strategy text,

  -- Legal & IP
  business_activity text,
  started_year integer,
  incorporated boolean,
  incorporated_year integer,
  founders_committed_capital numeric,
  advisory_board boolean,
  shareholder_types text,
  legal_counsel text,
  ip_type text,
  ip_protection_stage text,
  profitability_status text,
  breakeven_reached boolean,

  -- Status
  wizard_step text default 'profile',
  report_status text default 'draft',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: Users can only access their own companies
alter table public.valuation_companies enable row level security;

create policy "Users can read own companies" on public.valuation_companies
  for select using (auth.uid() = owner_id);

create policy "Users can insert own companies" on public.valuation_companies
  for insert with check (auth.uid() = owner_id);

create policy "Users can update own companies" on public.valuation_companies
  for update using (auth.uid() = owner_id);

-- Update trigger
create or replace function public.update_valuation_companies_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger valuation_companies_updated_at
  before update on public.valuation_companies
  for each row
  execute function public.update_valuation_companies_updated_at();

create index idx_valuation_companies_owner on public.valuation_companies(owner_id);
