-- Currency label for a company's valuation, resolved server-side from
-- company.country via getCurrencyForCountry() in referenceData.ts -- never
-- client-supplied. Nullable during rollout: existing rows backfill on their
-- next compute run. Display paths treat null as USD (the prior implicit
-- default before this column existed). See claude/track-11-currency-localization-scope.md.
alter table public.valuation_companies
  add column if not exists currency text;
