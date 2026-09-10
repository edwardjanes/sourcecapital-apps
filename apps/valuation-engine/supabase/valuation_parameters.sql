CREATE TABLE IF NOT EXISTS valuation_parameters (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  company_id         uuid NOT NULL UNIQUE REFERENCES valuation_companies(id) ON DELETE CASCADE,
  current            jsonb NOT NULL,
  defaults_snapshot  jsonb NOT NULL
);
ALTER TABLE valuation_parameters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner via company" ON valuation_parameters;
CREATE POLICY "Owner via company" ON valuation_parameters FOR ALL USING (
  EXISTS (SELECT 1 FROM valuation_companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
);
DROP TRIGGER IF EXISTS vp_updated_at ON valuation_parameters;
CREATE TRIGGER vp_updated_at BEFORE UPDATE ON valuation_parameters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
