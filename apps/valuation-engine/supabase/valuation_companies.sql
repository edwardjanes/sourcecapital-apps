CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS valuation_companies (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  owner_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raise_project_id            uuid REFERENCES raise_projects(id) ON DELETE SET NULL,

  name                        text NOT NULL,
  address                     text,
  country                     text NOT NULL,
  currency                    text NOT NULL DEFAULT 'USD',
  industry                    text NOT NULL,
  business_description        text,
  founders_count              integer,
  employees_count             integer,
  business_activity           text,
  started_year                integer,
  incorporated                boolean NOT NULL DEFAULT false,
  incorporated_year           integer,
  founders_committed_capital  numeric,
  website                     text,
  business_model              text CHECK (business_model IN ('b2b','b2c','both')),
  scalable                    boolean,
  exit_strategy                text,
  exit_strategy_readiness     text,
  stage                       text NOT NULL DEFAULT 'idea'
    CHECK (stage IN ('idea','development','startup','expansion','growth','maturity')),
  profitability_status        text CHECK (profitability_status IN ('pre_revenue','revenue_not_profitable','profitable')),
  breakeven_reached           boolean,
  advisory_board               boolean DEFAULT false,
  advisory_board_count        integer,
  shareholder_types           text[] DEFAULT '{}',
  legal_counsel                boolean,
  ip_type                     text,
  ip_protection_stage         text,

  wizard_step                 text NOT NULL DEFAULT 'profile',
  report_status                text NOT NULL DEFAULT 'draft'
    CHECK (report_status IN ('draft','ready','archived'))
);

CREATE INDEX IF NOT EXISTS valuation_companies_owner_idx ON valuation_companies(owner_id);
CREATE INDEX IF NOT EXISTS valuation_companies_raise_project_idx ON valuation_companies(raise_project_id);

ALTER TABLE valuation_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner full access" ON valuation_companies;
CREATE POLICY "Owner full access" ON valuation_companies FOR ALL USING (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS valuation_companies_updated_at ON valuation_companies;
CREATE TRIGGER valuation_companies_updated_at
  BEFORE UPDATE ON valuation_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
