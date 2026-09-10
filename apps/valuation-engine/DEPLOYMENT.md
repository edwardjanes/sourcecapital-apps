# Valuation Engine — Deployment Guide

## Prerequisites

- Supabase project: https://ochyvcxwtpclkpdacpae.supabase.co
- Service role key (from Supabase dashboard)
- Node.js 18+ installed locally

## Environment Setup

1. **Copy `.env.local.example` to `.env.local`**:
   ```bash
   cp .env.local.example .env.local
   ```

2. **Fill in the service role key**:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

## Database Schema: Apply SQL Migrations

The app requires four database tables. Apply them in order via the Supabase SQL editor:

### Option A: Supabase Dashboard SQL Editor
1. Log in to https://app.supabase.com
2. Select the project "Pitch Deck Analyser" (ochyvcxwtpclkpdacpae)
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the contents of `supabase/001_valuation_companies.sql`
6. Run the query
7. Repeat steps 4-6 for:
   - `supabase/002_valuation_inputs.sql`
   - `supabase/003_valuation_parameters_snapshots.sql`

### Option B: Supabase CLI (Local)
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref ochyvcxwtpclkpdacpae

# Apply migrations
supabase db push
```

## Run Locally

```bash
# Start dev server
npm run dev

# Tests
npm run test

# Build for production
npm run build
```

Browse to http://localhost:3000

## User Flow

1. **Sign up/login** at `/login`
2. **Dashboard** (`/dashboard`) — click "New Valuation"
3. **Wizard** (`/companies/[id]/edit`) — 6 steps:
   - Profile: Company name, country, industry, stage
   - Questionnaire: Team, business model, product, IP/legal
   - Financials: P&L and cash flow for years -1 to +5
   - Cap Table: Shareholders, funding rounds, capital needs
   - Comparables: Similar companies + multiples
   - Parameters: Method weights + Generate Report
4. **Report** (`/companies/[id]/report/[snapshotId]`)
   - View valuations from all 6 methods
   - Export to PDF via print dialog

## Architecture

```
src/
├── lib/valuation/           # Pure calculation engine (14 modules)
│   ├── compute.ts           # Orchestrator
│   ├── scorecard.ts         # ✓ Validated formula
│   ├── checklist.ts         # ✓ Validated formula
│   ├── vc.ts, dcf.ts, etc.
│   └── __tests__/           # Unit tests (3 passing)
├── app/
│   ├── dashboard/           # Home page
│   ├── login/               # Auth
│   ├── companies/
│   │   ├── new/route.ts     # Create company
│   │   ├── [id]/edit/       # 6-step wizard
│   │   └── [id]/report/     # Report view + PDF
│   └── layout.tsx           # Dark theme
└── lib/
    ├── theme.ts             # Design tokens
    ├── supabase*.ts         # DB clients
    └── ...
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/valuation/types.ts` | Type definitions for all calculations |
| `src/lib/valuation/referenceData.ts` | Published-source country/industry parameters (user-editable) |
| `src/lib/valuation/compute.ts` | Main orchestrator (takes inputs → outputs report) |
| `src/app/companies/[id]/snapshot/route.ts` | API: generates + saves snapshot |
| `src/app/dashboard/DashboardClient.tsx` | Home page with company list |
| `supabase/*.sql` | Database schema (RLS-protected) |

## Testing

**Unit Tests** (valuation engine):
```bash
npm run test

# Expected output:
# ✓ Scorecard: $5,310,193 (NovaCloud reference)
# ✓ Checklist: $4,555,423 (NovaCloud reference)
# ✓ Weights: all stages sum to 1.0
```

**Manual E2E Test**:
1. Sign up
2. New Valuation → "TestCorp"
3. Fill wizard with sample data
4. Generate Report
5. Verify output shows 6 method valuations
6. Print to PDF

## Deploy to Production

### Option 1: Vercel (Recommended)
```bash
# Push to GitHub
git push origin main

# Link to Vercel
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy
vercel --prod
```

### Option 2: Self-Hosted (Docker)
```bash
docker build -t valuation-engine .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  valuation-engine
```

## Troubleshooting

**"Cannot find module '@/lib/valuation/xxx'"**
→ Verify `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`

**"Permission denied" on snapshot creation**
→ Check Supabase RLS policies are applied (SQL migrations)

**"computeValuation is not a function"**
→ Ensure `src/lib/valuation/compute.ts` is built

**Tests failing**
→ Run `npm install` to ensure all dependencies are installed

## Next Steps

- [ ] Apply SQL migrations to Supabase
- [ ] Test full wizard flow end-to-end
- [ ] Fill in detailed report sections (14 components)
- [ ] Add snapshot history view
- [ ] Deploy to production
- [ ] Gather feedback & iterate

## References

- **Equidam Methodology**: Reference data in `src/lib/valuation/referenceData.ts`
- **NovaCloud Example**: Validation test fixtures in `src/lib/valuation/__tests__/`
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
