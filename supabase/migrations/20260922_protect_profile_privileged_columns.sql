-- Stop browser clients from granting themselves privileges via public.profiles.
--
-- The "Users can update own profile" RLS policy (USING auth.uid() = id, no
-- WITH CHECK, no column list) plus table-level UPDATE grants to anon and
-- authenticated let any signed-in user set these on their own row with the
-- public anon key:
--   sc_admin       -- unlocks /api/admin/submit and raise-listing approve/reject
--   plan           -- paid-plan status
--   analyses_used  -- the free-analysis limit counter
--   whop_order_id  -- payment linkage
--
-- This trigger only restricts requests running as the anon/authenticated
-- roles (PostgREST requests from browser clients). Everything else keeps
-- working unchanged:
--   * service_role requests (supabaseAdmin in the deck app, n8n)
--   * SECURITY DEFINER functions owned by postgres: handle_new_user(),
--     increment_analyses_used()
--   * SQL editor / migrations
--
-- Inserts from the browser (raise-hq-portal's ensureProfile) are allowed but
-- the privileged columns are forced to their safe defaults. Updates that try
-- to change a privileged column are rejected outright rather than silently
-- ignored, so a legitimate caller that hits this fails loudly.
--
-- NOT covered here, by design: client_name / location_id. raise-hq-portal's
-- onboarding writes those from the browser today, so locking them needs the
-- portal + n8n intake change tracked in ClickUp first.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only browser-originated requests are restricted.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.sc_admin      := false;
    new.plan          := 'free';
    new.analyses_used := 0;
    new.whop_order_id := null;
    return new;
  end if;

  if new.id            is distinct from old.id
  or new.sc_admin      is distinct from old.sc_admin
  or new.plan          is distinct from old.plan
  or new.analyses_used is distinct from old.analyses_used
  or new.whop_order_id is distinct from old.whop_order_id then
    raise exception 'Changing privileged profile fields is not allowed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;

create trigger protect_profile_privileged_columns
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();
