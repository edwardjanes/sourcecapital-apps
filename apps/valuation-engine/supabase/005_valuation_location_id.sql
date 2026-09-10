-- Track 11: allow valuation_companies rows to be owned by a GHL location
-- (via the headless compute route) instead of only a Supabase auth user.
--
-- Nothing about the existing wizard flow changes: owner_id-scoped rows and
-- their RLS policies behave exactly as before. This migration only adds a
-- second, parallel way for a row to exist -- keyed by location_id, written
-- and read exclusively through the service-role client (supabaseAdmin),
-- which bypasses RLS by construction and therefore doesn't depend on any
-- policy below to function. The policies here are defense in depth, not
-- the access-control mechanism itself.

alter table public.valuation_companies
  alter column owner_id drop not null;

alter table public.valuation_companies
  add column if not exists location_id text;

alter table public.valuation_companies
  add constraint valuation_companies_owner_or_location_chk
  check (owner_id is not null or location_id is not null);

create unique index if not exists idx_valuation_companies_location
  on public.valuation_companies (location_id)
  where location_id is not null;

-- Explicit deny for location-owned rows under anon/authenticated roles.
-- Redundant with "no matching owner_id" today, but makes the intent
-- unambiguous if a future policy is ever added without this constraint
-- in mind.
create policy "Location-owned rows are not visible to end users"
  on public.valuation_companies
  for all
  to anon, authenticated
  using (location_id is null);
