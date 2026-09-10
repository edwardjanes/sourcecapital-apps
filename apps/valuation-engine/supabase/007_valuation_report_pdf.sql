alter table public.valuation_snapshots
  add column if not exists report_url text;

alter table public.valuation_snapshots
  add column if not exists report_generated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('valuation-reports', 'valuation-reports', false)
on conflict (id) do nothing;
