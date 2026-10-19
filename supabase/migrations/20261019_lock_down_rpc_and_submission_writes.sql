-- Close two privilege-escalation holes reachable with the public anon key.
--
-- A1. public.increment_analyses_used(uuid) is SECURITY DEFINER with EXECUTE
--     granted to PUBLIC, anon and authenticated, and takes the user id as an
--     argument with no authorisation check. Anyone holding the anon key — it
--     ships in the browser bundle — can therefore bump any user's
--     analyses_used and burn a paying customer's quota.
--
--     This is also the back door left open by
--     20260922_protect_profile_privileged_columns.sql. That trigger guards
--     analyses_used against direct updates, but deliberately exempts
--     SECURITY DEFINER functions owned by postgres, and this is one of them.
--
--     The only caller is src/app/api/submit/confirm/route.ts, which goes
--     through supabaseAdmin (service_role), so revoking the browser roles
--     breaks nothing. The function is also pinned to search_path = public and
--     schema-qualified, as handle_new_user() was in
--     20260923_handle_new_user_reliable.sql.
--
-- A2. `authenticated` holds INSERT and UPDATE on every column of
--     public.deck_submissions, including paid, score, verdict, status,
--     whop_order_id and is_admin_upload. With the "Users can update own
--     submissions" policy (USING auth.uid() = user_id, no WITH CHECK and no
--     column list) a signed-in user can set paid = true on their own row and
--     unlock the full report for free.
--
--     The INSERT grant is the same hole and is not in the audit: "Users can
--     insert own submissions" lets a user create a row with paid = true and
--     score = 100 outright.
--
--     Nothing in the app writes deck_submissions from a browser. Every write
--     goes through an API route on supabaseAdmin; the two browser-side
--     references (src/app/admin/submissions/page.tsx and
--     src/app/dashboard/page.tsx) only select. So both grants can go.

-- ── A1 ────────────────────────────────────────────────────────────────────

create or replace function public.increment_analyses_used(user_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set analyses_used = analyses_used + 1
  where id = user_id_input;
end;
$$;

-- CREATE OR REPLACE keeps the existing ACL, so revoke afterwards.
revoke all on function public.increment_analyses_used(uuid) from public;
revoke all on function public.increment_analyses_used(uuid) from anon;
revoke all on function public.increment_analyses_used(uuid) from authenticated;
grant execute on function public.increment_analyses_used(uuid) to service_role;

-- ── A2 ────────────────────────────────────────────────────────────────────

revoke insert, update on public.deck_submissions from anon;
revoke insert, update on public.deck_submissions from authenticated;

-- SELECT is left in place: "Users can see own submissions" and "Admin can see
-- all submissions" still gate it, and src/app/admin/submissions/page.tsx reads
-- through the browser client.

-- The "Users can insert own submissions" and "Users can update own
-- submissions" policies are left alone. They grant nothing while the table
-- grants above are revoked, and keeping them means a future, deliberate
-- re-grant behaves as its author expects rather than failing opaquely.
--
-- This trigger is the safety net for exactly that case: if INSERT or UPDATE is
-- ever granted back to a browser role — by a careless
-- `grant all ... to authenticated`, or from the Supabase dashboard — the
-- columns that decide whether someone has paid still cannot be set from the
-- browser. It mirrors protect_profile_privileged_columns() on public.profiles
-- and, like that one, restricts only anon/authenticated requests: service_role
-- writes, SECURITY DEFINER functions, the SQL editor and migrations are
-- unaffected.

create or replace function public.protect_submission_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.paid            := false;
    new.whop_order_id   := null;
    new.is_admin_upload := false;
    new.score           := null;
    new.verdict         := null;
    new.verdict_type    := null;
    new.analysis_json   := null;
    return new;
  end if;

  if new.paid            is distinct from old.paid
  or new.whop_order_id   is distinct from old.whop_order_id
  or new.is_admin_upload is distinct from old.is_admin_upload
  or new.score           is distinct from old.score
  or new.verdict         is distinct from old.verdict
  or new.verdict_type    is distinct from old.verdict_type
  or new.analysis_json   is distinct from old.analysis_json
  or new.status          is distinct from old.status
  or new.user_id         is distinct from old.user_id then
    raise exception 'Changing privileged submission fields is not allowed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_submission_privileged_columns on public.deck_submissions;

create trigger protect_submission_privileged_columns
  before insert or update on public.deck_submissions
  for each row
  execute function public.protect_submission_privileged_columns();
