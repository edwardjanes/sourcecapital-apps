-- Submission → booked call, in our own data.
--
-- The report's "Book a call" CTA prefills the submission's email on Cal.com, so
-- a booking carries the same address as `deck_submissions.email`. These two
-- columns let /api/webhooks/cal record the match, which turns
-- "deck review → call booked" into one query instead of a manual join against
-- Cal.com.

alter table public.deck_submissions
  add column if not exists call_booked_at timestamptz,
  add column if not exists call_booking_uid text;

-- Bookings are rare relative to submissions, so index only the rows that have one.
create index if not exists deck_submissions_call_booked_idx
  on public.deck_submissions (call_booked_at desc)
  where call_booked_at is not null;

comment on column public.deck_submissions.call_booked_at is
  'When this submitter booked a call via Cal.com, matched on attendee email or metadata.submission_id.';
comment on column public.deck_submissions.call_booking_uid is
  'Cal.com booking uid, so a reschedule or cancellation can be reconciled.';
