-- Whop webhook durability.
--
-- Every delivery to /api/whop/webhook between (at least) 24 Sep and 19 Oct 2026
-- was rejected with a 401 because the route verified the wrong header with the
-- wrong scheme, so Whop eventually disabled the endpoint and ~3 weeks of
-- payments were never recorded. Nothing in the system held a record of those
-- attempts, which is why the loss was only noticed from Whop's own email.
--
-- This table is that record: every verified delivery is written here before any
-- other work, so a payment that cannot be matched to a submission is still
-- recoverable by hand instead of vanishing.

create table if not exists public.whop_webhook_events (
  -- Whop's message id ("msg_..."), so a retried delivery is not counted twice.
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  -- Null while the payment could not be attributed to a submission.
  submission_id uuid references public.deck_submissions (id) on delete set null,
  -- 'metadata' | 'email' | 'unmatched'
  matched_by text not null default 'unmatched',
  payer_email text,
  whop_order_id text,
  payload jsonb not null,
  handled boolean not null default false,
  error_message text
);

create index if not exists whop_webhook_events_received_at_idx
  on public.whop_webhook_events (received_at desc);

create index if not exists whop_webhook_events_unhandled_idx
  on public.whop_webhook_events (received_at desc)
  where not handled;

-- No policies: the webhook writes with the service role, which bypasses RLS.
-- Browser clients must never read payment payloads.
alter table public.whop_webhook_events enable row level security;

-- `public.profiles` has no email column, and supabase-js cannot select from
-- `auth.users`. The webhook needs an id → so expose exactly that one lookup,
-- and only to the service role.
create or replace function public.user_id_for_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(email) = lower(lookup_email)
  order by created_at
  limit 1;
$$;

revoke all on function public.user_id_for_email(text) from public;
revoke all on function public.user_id_for_email(text) from anon;
revoke all on function public.user_id_for_email(text) from authenticated;
grant execute on function public.user_id_for_email(text) to service_role;
