-- Backfill is_admin_upload on admin-submitted decks.
--
-- /api/admin/submit never set the flag, so every deck uploaded through the
-- admin path since the column existed has counted as a real customer
-- submission. The handoff flagged the four from 1 Oct; it is in fact every
-- admin upload from 4 Sep onwards — ten rows.
--
-- The match is exactly what the admin route writes: first_name "Admin",
-- last_name "Upload", email admin@sourcecapital.co.uk. Re-running is a no-op.

update public.deck_submissions
set is_admin_upload = true
where email = 'admin@sourcecapital.co.uk'
  and first_name = 'Admin'
  and last_name = 'Upload'
  and is_admin_upload is distinct from true;
