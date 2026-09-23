-- Make sure every new auth user gets a public.profiles row.
--
-- The previous version silently lost rows:
--   * the INSERT named `profiles` unqualified, and the function had no
--     `search_path` set, so resolution depended on whatever search_path the
--     caller (GoTrue) happened to run with;
--   * `EXCEPTION WHEN OTHERS THEN RETURN NEW` swallowed the failure with no
--     log line, so a miss was invisible until someone noticed a signed-in
--     user with no profile. Three of five users had no row by 2026-09-22.
--
-- Changes here:
--   * `set search_path = public` (also closes the SECURITY DEFINER
--     mutable-search_path warning) and a schema-qualified table name.
--   * `on conflict (id) do nothing`, so a row already created by the app
--     (raise-hq-portal's ensureProfile) is not an error.
--   * the exception handler stays — a failure here must not block signup —
--     but now raises a WARNING with the SQLSTATE/SQLERRM, so misses show up
--     in the Postgres logs instead of disappearing.
--
-- Privileged columns (sc_admin, plan, analyses_used, whop_order_id) are left
-- to their column defaults. This function is SECURITY DEFINER and owned by
-- postgres, so protect_profile_privileged_columns() does not restrict it.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- Never block signup, but never lose the failure silently either.
  raise warning 'handle_new_user: could not create profile for % (% - %)',
    new.id, sqlstate, sqlerrm;
  return new;
end;
$$;

-- Trigger already exists as on_auth_user_created; recreated here so the
-- migration is self-contained if replayed against a fresh database.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
