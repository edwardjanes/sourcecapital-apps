CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz DEFAULT now(),
  company_id     uuid NOT NULL REFERENCES valuation_companies(id) ON DELETE CASCADE,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  label          text NOT NULL DEFAULT 'Report',
  inputs         jsonb NOT NULL,
  outputs        jsonb NOT NULL,
  is_current     boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS valuation_snapshots_company_idx ON valuation_snapshots(company_id, created_at DESC);
ALTER TABLE valuation_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_snapshots;
CREATE POLICY "Owner via company" ON valuation_snapshots FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);
