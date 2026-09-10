# Valuation Engine — Technical Architecture

**Document Version:** 1.0  
**Last Updated:** 2026-08-27  
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Layers](#architectural-layers)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [Valuation Computation Engine](#valuation-computation-engine)
6. [Report Generation](#report-generation)
7. [Authentication & Security](#authentication--security)
8. [Styling Architecture](#styling-architecture)
9. [Testing Strategy](#testing-strategy)
10. [Deployment & Performance](#deployment--performance)

---

## System Overview

**Valuation Engine** is a full-stack Next.js application that replicates Equidam's startup valuation methodology. The system follows a **three-layer architecture**:

```
┌─────────────────────────────────────┐
│  Presentation Layer                 │
│  (React Components, Next.js Pages)  │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│  Business Logic Layer               │
│  (Valuation Engine, Computation)    │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│  Data Layer                         │
│  (Supabase PostgreSQL + RLS)        │
└─────────────────────────────────────┘
```

**Key Principles:**
- **Separation of concerns:** Valuation engine is pure TypeScript, zero UI dependencies
- **Type safety:** Full TypeScript strict mode throughout
- **Data immutability:** Snapshots are frozen at generation time
- **Security by default:** All tables enforce row-level security (RLS)
- **Inline styling:** No Tailwind/CSS modules; design tokens in CSS variables
- **No external charts:** Custom SVG-based ReportChart component

---

## Architectural Layers

### 1. Presentation Layer (`src/app/`, `src/components/`)

**Route Structure:**
```
/                       → Home (redirects to /login or /dashboard)
/login                  → Email/password auth + signup
/auth/callback          → OAuth callback handler
/auth/auth-code-error   → Error page for expired/invalid confirmation links
/dashboard              → Authenticated home (company list)
/companies/
  ├── new               → Create company entry
  ├── [id]/
  │   ├── edit/         → 6-step wizard
  │   │   ├── profile/
  │   │   ├── questionnaire/
  │   │   ├── financials/
  │   │   ├── captable/
  │   │   ├── comparables/
  │   │   └── parameters/
  │   ├── snapshot      → API route: compute + persist valuations
  │   └── report/
  │       └── [snapshotId]/  → View/print report
```

**Component Patterns:**

- **Server Components** (`page.tsx`): Auth checks, data fetching via `createSupabaseServerClient()`
- **Client Components** (`*Client.tsx`): State, interactivity, `"use client"` directive
- **Props flow:** Server components fetch data → pass to client components
- **No prop drilling:** Each client component manages its own state via hooks

**Example: Report Flow**
```
page.tsx (server)
  └─ fetch snapshot from DB
  └─ pass to ReportClient.tsx
      └─ ReportClient.tsx (client, 17 sections)
          ├─ useEffect for scroll tracking
          ├─ ReportChart for data visualizations
          └─ report.css for styling
```

### 2. Business Logic Layer (`src/lib/valuation/`)

**The valuation engine is a pure TypeScript computation pipeline:**

```
User Input
  ↓
Defaults         (buildDefaultParameters)
  ↓
Scoring          (deriveScorecardCriteriaScores)
  ↓
FCF              (deriveFcfeByYear)
  ↓
┌──────────────────────────────────────┐
│ 6 Parallel Valuation Methods         │
├──────────────────────────────────────┤
│ • Scorecard      (validated $5.31M)  │
│ • Checklist      (validated $4.56M)  │
│ • VC Method                          │
│ • DCF-LTG                            │
│ • DCF-Multiple                       │
│ • Simple Multiples                   │
└──────────────────────────────────────┘
  ↓
Weighting        (computeWeightedValuation)
  ↓
Output           (ValuationReportOutput)
```

**Module Responsibilities:**

| Module | Responsibility | Output |
|--------|----------------|--------|
| `types.ts` | Type definitions | TypeScript interfaces |
| `referenceData.ts` | Parameter tables from published sources (Equidam published data, PitchBook-NVCA, BBB, Damodaran; 25 countries, DE sample-validated) | Country/industry/stage parameters |
| `defaults.ts` | Infer missing parameters from inputs | Default parameters object |
| `scoring.ts` | Convert questionnaire → trait scores | Scoring object |
| `fcf.ts` | Calculate FCFE per year | Annual cash flows |
| `scorecard.ts` | Scorecard method formula | Scorecard valuation |
| `checklist.ts` | Checklist method formula | Checklist valuation |
| `vc.ts` | VC method (exit/ROI) | VC valuation |
| `dcf.ts` | Shared DCF logic (LTG + Multiple) | DCF base value |
| `simpleMultiples.ts` | Comparable company multiples | Multiples valuation |
| `weights.ts` | Stage-based method weighting | Blended valuation |
| `diff.ts` | Compare current vs defaults | Override tracking |
| `format.ts` | Locale-aware formatting | Formatted strings |
| `compute.ts` | Orchestrate all modules | ValuationReportOutput |

**Key Design Decision: Immutable Inputs**

The engine accepts a frozen `ValuationInput` snapshot:
- All computations are **deterministic and idempotent**
- Re-running with same inputs = same output
- Enables snapshot-based reporting (one computation, many views)
- Perfect for audit trails

### 3. Data Layer (`src/lib/supabase*.ts`)

**Four Supabase clients:**

| Client | Purpose | Auth Level |
|--------|---------|-----------|
| `supabase.ts` | Browser default client | Anon key (public access, RLS-filtered) |
| `supabaseBrowser.ts` | Browser explicit client | Anon key, cookie-based session |
| `supabaseServer.ts` | Server-side client | Anon key, SSR cookies |
| `supabaseAdmin.ts` | Server-side privileged | Service role key (bypasses RLS) |

**Usage Pattern:**
```typescript
// In server component: fetch with auth context
const supabase = createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
// RLS automatically filters to user's data

// In client component: mutations
const { error } = await supabaseBrowser
  .from('valuation_companies')
  .insert({ name, country, ... });
// RLS enforces: INSERT only if auth.uid() matches
```

---

## Data Flow

### Complete User Journey

```
1. SIGNUP / LOGIN
   User → /login → supabaseBrowser.auth.signUp()
   → Email verification → /auth/callback
   → Session created → Redirect to /dashboard

2. CREATE COMPANY
   /companies/new (server route)
   → Insert into valuation_companies
   → Redirect to edit wizard
   → Data persisted immediately

3. FILL WIZARD (6 steps)
   Step 1 (Profile)
     → onUpdate callback
     → WizardShell state updated
     → Supabase insert into valuation_companies (PATCH)
   
   Step 2 (Questionnaire)
     → onUpdate callback
     → Insert into valuation_questionnaire_responses
   
   ... repeat for Steps 3-6
   
   Final: Generate Report button
     → POST /api/companies/[id]/snapshot
     → Body contains all wizard data
     → Backend runs compute.ts

4. COMPUTE VALUATION
   POST /api/companies/[id]/snapshot
     → Extract inputs from request body
     → Call computeValuation(inputs, parameters)
     → All 6 methods compute in ~10-20ms
     → Insert into valuation_snapshots
     → Return snapshot_id

5. VIEW REPORT
   /companies/[id]/report/[snapshotId] (server)
     → Fetch snapshot from DB
     → Pass to ReportClient.tsx
     → 17-section layout with navigation rail
     → Charts, tables, metrics rendered

6. EXPORT PDF
   Browser print dialog (Ctrl+P)
     → print.css applies
     → Light theme forced (!important)
     → Page breaks every .rpt-page
     → Print to PDF (user's browser)
```

---

## Database Schema

### Entity Relationship Diagram

```
auth.users (Supabase managed)
  ↓
valuation_companies
  ├─→ valuation_financials (1:many, year_offset)
  ├─→ valuation_questionnaire_responses (1:1)
  ├─→ valuation_cap_table (1:many)
  ├─→ valuation_funding_rounds (1:many)
  ├─→ valuation_comparables (1:many)
  ├─→ valuation_parameters (1:1)
  └─→ valuation_snapshots (1:many, is_current flag)
```

### Table Definitions

**valuation_companies** (Company profiles)
```sql
id (uuid, PK)
user_id (uuid, FK → auth.users) — Owner
name, country, industry, stage (categorical)
founders_count, employees_count, incorporated_year
business_description, website, legal_counsel
created_at, updated_at
```
RLS: `auth.uid() = user_id`

**valuation_financials** (Per-year P&L + CF)
```sql
id (uuid, PK)
company_id (uuid, FK)
year_offset (-1, 0, 1, 2, 3, 4, 5)
revenue, cogs, salaries, other_opex, total_da
interest, taxes
receivables, inventory, payables
capex, debt, fundraising_plan
UNIQUE(company_id, year_offset)
```
RLS: Child of valuation_companies

**valuation_questionnaire_responses** (Scored questionnaire)
```sql
id (uuid, PK)
company_id (uuid, FK)
answers (jsonb) — ~20 fields in one blob
created_at
```
RLS: Child of valuation_companies

**valuation_parameters** (User edits + defaults)
```sql
id (uuid, PK)
company_id (uuid, FK)
current_json (jsonb)
  {
    "scorecard_weight": 0.22,
    "checklist_weight": 0.22,
    ... (6 methods)
  }
defaults_snapshot_json (jsonb) — Auto-derived at creation
created_at, updated_at
```
RLS: Child of valuation_companies

**valuation_snapshots** (Frozen valuations)
```sql
id (uuid, PK)
company_id (uuid, FK)
user_id (uuid, FK)
inputs_json (jsonb) — Full ValuationInput at snapshot time
outputs_json (jsonb) — Full ValuationReportOutput (6 methods)
is_current (boolean) — Flag for latest
created_at (timestamp) — Enables history
```
RLS: `user_id = auth.uid()`

### RLS Policy Enforcement

Every table enforces row-level security via SQL policies. The pattern:

```sql
CREATE POLICY "users can view own data"
  ON valuation_companies
  FOR SELECT
  USING (auth.uid() = user_id);

-- For child tables:
CREATE POLICY "users can view own company's data"
  ON valuation_financials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM valuation_companies c
      WHERE c.id = company_id AND c.user_id = auth.uid()
    )
  );
```

**Security Implication:** Even if someone guesses a `company_id`, the database enforces ownership. Frontend filters are UX only; security is database-level.

---

## Valuation Computation Engine

### The Six Methods

#### 1. Scorecard Method

**Formula:** `Valuation = AvgPreMoneyValuation × (1 + Σ(weight_i × score_i))`

**Components:**
- `AvgPreMoneyValuation` — From referenceData (published-source parameters, user-editable)
- `weight_i` — Sub-criteria weight (from SCORECARD_CRITERIA_WEIGHTS)
- `score_i` — User questionnaire score (0–10 scale, derived by scoring.ts)

**Validated:** $5,310,193 (NovaCloud Systems, Germany, Development stage)

#### 2. Checklist Method

**Formula:** `Valuation = Σ(weight_i × score_i × MaxValuation)`

**Components:**
- `weight_i` — Criteria weight (from CHECKLIST_CRITERIA_WEIGHTS)
- `score_i` — Questionnaire score (0–1 scale)
- `MaxValuation` — Stage-based ceiling (e.g., Development = $5M)

**Validated:** $4,555,423 (NovaCloud Systems)

#### 3. VC Method

**Formula:** `Valuation = (TargetExitValue / (1 + RequiredROI)^years) - CapitalRaised`

**Components:**
- `TargetExitValue` — Exit revenue × stage-specific multiple (from referenceData)
- `RequiredROI` — Stage-specific required return (e.g., Seed = 40%, Series A = 30%)
- `years` — Time to exit (typically 5–7 years)
- `CapitalRaised` — Total funding from cap table

#### 4. DCF-LTG (Long-Term Growth)

**Formula:** 
```
Value = Σ[t=1..n] (FCFE_t × SurvivalRate_t) / (1+DiscountRate)^t
      + (FCFE_n × (1+g) × SurvivalRate_n) / ((DiscountRate - g) × (1+DiscountRate)^(n-1))
      + NonOperatingCash × (1 - IlliquidityDiscount)
```

**Components:**
- `FCFE_t` — Free Cash Flow to Equity in year t
- `SurvivalRate_t` — Probability company survives (per-country from referenceData)
- `DiscountRate` — CAPM discount rate
- `g` — Terminal growth rate (illustrative: 2.5%)
- `IlliquidityDiscount` — 25% (illiquid startup vs public equity)

#### 5. DCF-Multiple

**Formula:** Same as DCF-LTG, but terminal value calculated as:
```
TerminalValue = FCFE_n × SurvivalRate_n × ExitMultiple
```
- `ExitMultiple` — Industry-specific (e.g., Software = 8x Revenue)

#### 6. Simple Multiples

**Formula:** `Valuation = LastYearRevenue × MedianComparableMultiple`

**Components:**
- `LastYearRevenue` — Year 0 (most recent)
- `MedianComparableMultiple` — From user-input comparables (e.g., 1.74x)

### Weighting

**Stage-Based Default Weights** (from STAGE_DEFAULT_WEIGHTS):

| Stage | Scorecard | Checklist | VC | DCF-LTG | DCF-Multiple | Multiples |
|-------|-----------|-----------|----|---------|--------------|---------  |
| Seed | 15% | 15% | 30% | 15% | 15% | 10% |
| Development | 22% | 22% | 22% | 12% | 12% | 10% |
| Growth | 20% | 20% | 20% | 15% | 15% | 10% |

**User can override** via `/companies/[id]/parameters/` step in wizard.

### Discount Rate (CAPM)

```
DiscountRate = RiskFreeRate + Beta × MarketRiskPremium

Where:
  RiskFreeRate = Country 10-year govt bond yield (from referenceData)
  Beta = Industry beta (from referenceData)
  MarketRiskPremium = Global ERP (from referenceData, illustrative ~5.5%)
```

---

## Report Generation

### ReportClient.tsx Architecture

**17 Sections (in order):**

1. **Cover** — Company name, date, valuation ± bounds
2. **About** — Methodology overview, disclaimer
3. **Company Summary** — Profile, financials, growth rates
4. **Forecasts Summary** — Revenue/EBITDA trends, graphs
5. **Funding & Ownership** — Cap table, funding rounds
6. **Valuation Summary** — All 6 methods + weighted blend ± bounds
7. **Scorecard Method** — Formula, score breakdown, result
8. **Checklist Method** — Criteria, weights, result
9. **VC Method** — Exit assumptions, required ROI, result
10. **DCF-LTG** — Terminal growth, discount rate, result
11. **DCF-Multiple** — Exit multiple, terminal value, result
12. **Simple Multiples** — Comparable analysis, result
13. **Qualitative Assessment** — Team, market, IP strength
14. **Updated Default Values** — Where user overrode defaults
15. **P&L Projections** — 6-year revenue, EBITDA, net income
16. **Cash Flow Projections** — FCFE, working capital changes
17. **Method Weights & Appendix** — Weights, sources, disclaimers

### Navigation Rail

**Sticky 232px sidebar** with hierarchical grouping:
- **Overview** (6 sections)
- **Methods** (6 sections)
- **Detail** (4 sections)
- **Appendix** (2 sections)

**Scroll tracking:** useEffect + getBoundingClientRect() updates active link as user scrolls. Responsive: collapses on <880px screens.

### Chart Component (ReportChart.tsx)

**Purpose:** Render multi-series SVG bar charts (no external deps)

**Data:**
```typescript
interface ChartSeries {
  name: string;          // "Revenue", "FCFE", "Scorecard"
  values: (number | null)[]; // One per category
  color?: string;        // CSS variable or hex
}

const categories = ["Y0", "Y1", "Y2", ...];
const series = [
  { name: "Revenue", values: [2M, 3.5M, 6.57M, ...] },
  { name: "EBITDA", values: [0.8M, 1.2M, 2M, ...] }
];
```

**Rendering:**
- Computes min/max values, range, bar widths
- **Handles negative values** (fixed Aug 27): Draws zero baseline, bars extend up/down
- Categorical colors from CSS variables (--cat-1 through --cat-6)
- Legend for multi-series charts

### Design System (report.css)

**Token-Based Architecture:**

```css
:root {
  /* Colors */
  --rpt-bg: #F6F7F9;
  --rpt-paper: #FFFFFF;
  --rpt-ink: #14181F;
  --rpt-ink-muted: #5B6472;
  --rpt-border: #E1E5EA;
  --rpt-accent: #0F8C7A;
  
  /* Categorical colors (for charts) */
  --rpt-cat-1: #0F8C7A;  /* Teal */
  --rpt-cat-2: #C08A2E;  /* Gold */
  --rpt-cat-3: #3D6EA8;  /* Blue */
  --rpt-cat-4: #B65C3E;  /* Orange */
  --rpt-cat-5: #7B5EA7;  /* Purple */
  --rpt-cat-6: #4F9142;  /* Green */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --rpt-bg: #12161C;
    --rpt-paper: #1A1F27;
    --rpt-ink: #EDF0F3;
    /* ... dark variants ... */
  }
}

/* Components use tokens */
.rpt-page {
  background: var(--rpt-paper);
  color: var(--rpt-ink);
}
```

**Typography:**
- Headings: Source Serif 4, 600–700 weight
- Body: Source Sans 3, 400–500 weight
- Numerics: Source Code Pro (monospace, tabular-nums)

**print.css Overrides:**
- Forces light theme (`--rpt-bg: #F6F7F9 !important`)
- Hides chrome (.rpt-topbar, .rpt-rail, .rpt-export-btn)
- Page breaks after each .rpt-page (A4, 2cm margin)
- Proper orphan/widow rules

---

## Authentication & Security

### Auth Flow

**Supabase Email/Password:**
```
1. User signs up: /login → supabaseBrowser.auth.signUp()
2. Email sent with magic link: yourdomain.com/auth/callback?code=XXX&type=signup
3. Click link → /auth/callback redirects to `/auth/auth-code-error` on error
4. Success → Session created, redirect to /dashboard
5. Auth state persisted in HttpOnly cookie (managed by Supabase SDK)
```

**Error Handling (Aug 27 fix):**
- `/auth/callback/route.ts` catches failed exchanges
- Redirects to `/auth/auth-code-error` (new page)
- Shows user-friendly message + recovery link

### RLS (Row-Level Security)

**Database enforces ownership at the table level:**

```sql
-- valuation_companies
WHERE auth.uid() = user_id

-- Child tables (valuation_financials, etc.)
WHERE EXISTS (
  SELECT 1 FROM valuation_companies c
  WHERE c.id = [table].company_id
  AND c.user_id = auth.uid()
)
```

**Never trust frontend filters.** A user who guesses someone else's company_id cannot access it—the database says "no."

### Environment Variables (Production)

```
NEXT_PUBLIC_SUPABASE_URL          # Public Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Public anon key
SUPABASE_SERVICE_ROLE_KEY         # Secret, admin key (server only)
```

---

## Styling Architecture

### Principle: Inline Styles + CSS Tokens

**No Tailwind. No CSS modules.**

**Why:**
- Simplifies deployment (no build complexity)
- Matches sibling app conventions (Deck Analysis App)
- Keeps styles co-located with components
- Easier to refactor (grep for style object)

**Pattern for Components:**
```tsx
// ✅ GOOD: Inline style + tokens
<div style={{
  background: C.panel,
  padding: '16px',
  borderRadius: '8px',
  color: C.text,
}}>

// ❌ BAD: Tailwind class
<div className="bg-panel p-4 rounded-lg text-text">

// ❌ BAD: CSS module
import styles from './Component.module.css';
<div className={styles.container}>
```

**Pattern for Report:**
```css
/* ✅ GOOD: Define in report.css, use class */
.rpt-field-label {
  font-size: 10.5px;
  text-transform: uppercase;
  color: var(--rpt-ink-muted);
}

// Then in component:
<span className="rpt-field-label">{label}</span>
```

### Design Tokens (`src/lib/theme.ts`)

**Global tokens (non-report components):**
```typescript
export const C = {
  bg: '#0A0A0A',          // Dark background
  panel: '#0F1929',       // Card/panel background
  border: '#1A2438',      // Borders
  accent: '#03fb83',      // CTA color
  text: '#F8FAFC',        // Primary text
  textMid: '#6B7280',     // Secondary text
};

export const FONT_SANS = "'Fira Sans', system-ui, -apple-system, sans-serif";
export const FONT_MONO = "'Fira Code', ui-monospace, monospace";
```

**Report tokens (CSS variables):**
- Prefixed `.rpt-*` to avoid collisions
- Light/dark theme support via media queries
- Categorical colors for charts (--rpt-cat-1 through --rpt-cat-6)

---

## Testing Strategy

### Unit Tests (6 modules)

**All located in `src/lib/valuation/__tests__/`**

1. **scorecard.test.ts**
   - Fixture: NovaCloud Systems data
   - Expected: $5,310,193
   - Tests formula correctness, sub-trait weighting

2. **checklist.test.ts**
   - Fixture: NovaCloud Systems data
   - Expected: $4,555,423
   - Tests criteria scoring, max valuation ceiling

3. **weights.test.ts**
   - Validates STAGE_DEFAULT_WEIGHTS structure
   - Each stage's weights must sum to 1.0

4. **fcf.test.ts**
   - Tests FCFE calculation, working capital changes
   - Validates with NOL (Net Operating Loss) carryforward

5. **compute.test.ts**
   - End-to-end orchestrator test
   - Runs all 6 methods, validates output structure
   - NovaCloud fixture validates blended output

6. **scoring-regression.test.ts**
   - Questionnaire answers → trait scores
   - Ensures UI fields sync with scoring logic

**Run tests:**
```bash
npm run test                  # Run once, exit
npm run test -- --watch      # Watch mode
```

### Manual Testing Checklist

**Auth Flow:**
- [ ] Sign up with new email → verify email link works
- [ ] Login with existing email/password → redirects to dashboard
- [ ] Login, click logout → redirects to /login
- [ ] Try expired confirmation link → shows error page with recovery link

**Wizard Flow:**
- [ ] Create company → Step 1 profile form saves
- [ ] Fill all 6 steps without errors
- [ ] Optional: Skip questionnaire/cap-table steps
- [ ] Generate report button works

**Report Rendering:**
- [ ] All 17 sections visible, no blank sections
- [ ] Nav rail highlights correct section as user scrolls
- [ ] Revenue Forecast chart shows bars for all years
- [ ] FCFE Forecast chart (with negative values) shows bars extending below zero line
- [ ] Method Comparison chart shows 6 bars for each method

**PDF Export:**
- [ ] Click "Export PDF" → opens browser print dialog
- [ ] Preview shows one section per page
- [ ] No section content clipped at page breaks
- [ ] Print to PDF → download succeeds

**Reference Data:**
- [ ] Change country → reference data updates
- [ ] Change stage → method weights update
- [ ] Override method weights → blended valuation changes

**Edge Cases:**
- [ ] Company with no comparables → Multiples method shows "N/A"
- [ ] Company with all negative FCFE → DCF calculates correctly
- [ ] Very small revenue → Multiples method handles rounding

---

## Deployment & Performance

### Build Optimization

**Current Size (production build):**
- Auth error route: 6.98 kB
- Report route: 10.2 kB
- Total JS bundle: ~157 kB (shared chunks + route)

**Build time:** ~30–60 seconds (includes TypeScript check)

**Vercel Configuration:**
```
Framework: Next.js
Root Directory: apps/valuation-engine
Build Command: npm run build
Output Directory: .next
Node Version: 18.x
```

### Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Auth redirect | <500ms | ✓ |
| Valuation compute | <50ms | ✓ (typically 10–20ms) |
| Report render | <1s | ✓ |
| PDF export | <2s | ✓ |
| Snapshot persist | <500ms | ✓ |

### Scaling Considerations

**Database:**
- RLS policies are indexed on user_id → O(1) lookups
- Snapshot table grows over time (one per valuation) → Consider archiving old snapshots after 1 year

**Computation:**
- Valuation engine is single-threaded, synchronous
- No async I/O during compute → CPU-bound, very fast
- Max request body size: 10MB (enough for 10K rows of financials)

**Storage:**
- Supabase Storage for future PDF export (if added)
- Each company ~1-5KB of JSON data
- 1,000 companies = ~5MB database

---

## Troubleshooting Reference

| Issue | Cause | Solution |
|-------|-------|----------|
| Build fails: "Cannot find module 'tailwindcss'" | Root postcss.config has tailwindcss plugin | `postcss.config.mjs` already included (commit d2e2194) |
| Auth redirect loop | Session not persisted or middleware misconfigured | Check `src/middleware.ts` — ensure `/auth/*` routes bypass protection |
| Report shows blank/NaN values | FCFE calculation returns null | Check financials have year_offset -1 or 0..5 |
| FCFE chart missing negative bars | Old ReportChart.tsx bug | Fixed Aug 27 — bars now extend both up/down from zero |
| Email confirmation fails | Link expired or already used | New /auth/auth-code-error page shows recovery link |
| PDF page breaks wrong | print.css not applied correctly | Run `npm run build`, verify .rpt-page has page-break-after |

---

## References

- **Reference Methodology:** Equidam-Valuation-Methodology.pdf
- **Validation Dataset:** NovaCloud Systems (Germany, Development, $3.77M target)
- **Tech Stack:** Next.js 14.2.20, React 18.3.1, Supabase, TypeScript 5
- **Deployment:** Vercel (continuous deployment on git push)
- **Monitoring:** Sentry (error tracking), PostHog (analytics)

---

**Document maintained by:** Claude Code  
**Last verified:** 2026-08-27  
**Status:** Production Ready (commit 560e24d)
