-- Track 11: valuation_snapshots.created_by must be nullable for the same
-- reason valuation_companies.owner_id was made nullable in
-- 005_valuation_location_id.sql -- a snapshot created by the headless
-- compute route (via supabaseAdmin, service role) has no Supabase auth
-- user behind it. The existing "Owner via company" RLS policy is
-- unaffected: it grants access via the parent company's owner_id, so a
-- snapshot whose company is location-owned (owner_id null) stays
-- inaccessible to anon/authenticated callers regardless of created_by.

alter table public.valuation_snapshots
  alter column created_by drop not null;
