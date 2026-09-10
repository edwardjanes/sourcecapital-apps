-- Questionnaire (1:1)
CREATE TABLE IF NOT EXISTS valuation_questionnaire_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  company_id    uuid NOT NULL UNIQUE REFERENCES valuation_companies(id) ON DELETE CASCADE,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE valuation_questionnaire_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_questionnaire_responses;
CREATE POLICY "Owner via company" ON valuation_questionnaire_responses FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);
DROP TRIGGER IF EXISTS vqr_updated_at ON valuation_questionnaire_responses;
CREATE TRIGGER vqr_updated_at BEFORE UPDATE ON valuation_questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Financials (per-year rows)
CREATE TABLE IF NOT EXISTS valuation_financials (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  year_offset         integer NOT NULL CHECK (year_offset BETWEEN -1 AND 5),
  year_number         integer,
  is_actual           boolean NOT NULL DEFAULT false,
  revenue             numeric NOT NULL DEFAULT 0,
  cogs                numeric NOT NULL DEFAULT 0,
  salaries            numeric NOT NULL DEFAULT 0,
  other_opex          numeric NOT NULL DEFAULT 0,
  total_da            numeric NOT NULL DEFAULT 0,
  interest            numeric NOT NULL DEFAULT 0,
  taxes               numeric NOT NULL DEFAULT 0,
  receivables         numeric NOT NULL DEFAULT 0,
  inventory           numeric NOT NULL DEFAULT 0,
  payables            numeric NOT NULL DEFAULT 0,
  capex               numeric NOT NULL DEFAULT 0,
  debt                numeric NOT NULL DEFAULT 0,
  fundraising_plan    numeric NOT NULL DEFAULT 0,
  UNIQUE (company_id, year_offset)
);
CREATE INDEX IF NOT EXISTS valuation_financials_company_idx ON valuation_financials(company_id, year_offset);
ALTER TABLE valuation_financials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_financials;
CREATE POLICY "Owner via company" ON valuation_financials FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

-- Balance sheet snapshot (current + previous year only)
CREATE TABLE IF NOT EXISTS valuation_balance_sheet_snapshots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  year_offset              integer NOT NULL CHECK (year_offset IN (-1, 0)),
  cash                     numeric NOT NULL DEFAULT 0,
  non_operating_cash       numeric NOT NULL DEFAULT 0,
  tangible_assets          numeric NOT NULL DEFAULT 0,
  intangible_assets        numeric NOT NULL DEFAULT 0,
  financial_assets         numeric NOT NULL DEFAULT 0,
  deferred_tax_assets      numeric NOT NULL DEFAULT 0,
  short_term_liabilities   numeric NOT NULL DEFAULT 0,
  long_term_liabilities    numeric NOT NULL DEFAULT 0,
  equity                   numeric NOT NULL DEFAULT 0,
  UNIQUE (company_id, year_offset)
);
ALTER TABLE valuation_balance_sheet_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_balance_sheet_snapshots;
CREATE POLICY "Owner via company" ON valuation_balance_sheet_snapshots FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

-- Cap table (current shareholders)
CREATE TABLE IF NOT EXISTS valuation_cap_table (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  shareholder_name text NOT NULL,
  share_percent   numeric NOT NULL,
  order_index     integer NOT NULL DEFAULT 0
);
ALTER TABLE valuation_cap_table ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_cap_table;
CREATE POLICY "Owner via company" ON valuation_cap_table FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

-- Funding rounds (cap table history)
CREATE TABLE IF NOT EXISTS valuation_funding_rounds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  round_name            text NOT NULL,
  round_type            text,
  closed_date           date,
  post_money_or_cap     numeric,
  investment_amount     numeric,
  equity_percent        numeric,
  order_index           integer NOT NULL DEFAULT 0
);
ALTER TABLE valuation_funding_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_funding_rounds;
CREATE POLICY "Owner via company" ON valuation_funding_rounds FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

-- Competitors
CREATE TABLE IF NOT EXISTS valuation_competitors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  name           text NOT NULL,
  website        text,
  order_index    integer NOT NULL DEFAULT 0
);
ALTER TABLE valuation_competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_competitors;
CREATE POLICY "Owner via company" ON valuation_competitors FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

-- Comparables (feeds Simple/Advanced Multiples)
CREATE TABLE IF NOT EXISTS valuation_comparables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  company_name   text NOT NULL,
  multiple       numeric NOT NULL,
  metric_type    text NOT NULL DEFAULT 'revenue' CHECK (metric_type IN ('revenue','ebitda')),
  date_observed  date,
  source         text,
  gathered_by    text,
  order_index    integer NOT NULL DEFAULT 0
);
ALTER TABLE valuation_comparables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_comparables;
CREATE POLICY "Owner via company" ON valuation_comparables FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);

-- Transaction / use of funds (1:1)
CREATE TABLE IF NOT EXISTS valuation_transaction (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL UNIQUE REFERENCES valuation_companies(id) ON DELETE CASCADE,
  capital_needed    numeric,
  use_of_funds      jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE valuation_transaction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_transaction;
CREATE POLICY "Owner via company" ON valuation_transaction FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);
