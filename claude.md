# Deck Analysis App — Source Capital Platform

**Overview**: A Next.js SaaS platform that analyzes venture capital pitch decks using Claude AI, with integrated CRM (fundraiser pipeline) and raise listing features. The app evaluates decks across 8 weighted dimensions and provides rigorous investment viability scores.

---

## Recent Updates (September 2026)

### Completed
- ✅ **Comprehensive Scoring Rubrics & Hard Caps**: Formalized 8-dimension evaluation rules
  - Problem: size × pain × cost formula with hard caps for anecdotal-only severity
  - Market: TAM formula (audience × per-unit spend) with caps for missing inputs or wrong scope
  - Business Model: single primary revenue mechanism with caps for multi-currency or missing unit economics
  - Competition: named-competitor requirement (not categories) with ≤2 score cap if zero specific competitors named
  - Solution: feature-to-problem mapping + working product evidence, capped if only mockups shown
  - Team: direct relevant experience to hardest execution risk, capped if zero team members have that experience
  - Financials: reconciled single-currency model with derivable runway, capped for mixed currencies or unjustified valuation
  - All hard caps are mandatory ceilings — independent of other strengths in that dimension

- ✅ **TOP-LINE SCORE RECONCILIATION**: Mandatory alignment between dimension scores and meetingConversionScore
  - Formalized ±8 point tolerance band: dimensionAverage100 = (sum of 8 scores ÷ 80) × 100
  - Worked-check example: dimension scores [5,6,6,6,2,5,6,6] → 52.5 average; 62 reported score requires correction
  - Prevents score drift above what dimension breakdown actually supports
  - Guides diagnostic reasoning when scores diverge (re-check hard caps, dimension vs. narrative scoring, methodology)

- ✅ **Server-Side Admin Auth Check**: `/api/admin/submit` now requires sc_admin verification
  - Mirrors pattern from `/api/raise-listing/admin/listings/[id]/approve`
  - Reads session from cookies via @supabase/ssr
  - Returns 401 for no session, 403 for logged-in non-admin
  - Prevents unauthorized direct URL access to admin submission endpoint

- ✅ **Admin PDF Compression Fix**: Corrected type errors in admin deck submission
  - Fixed incorrect property access: `compressed.success` → `compressed.data.buffer as ArrayBuffer`
  - Fixed logging: `compressed.buffer.byteLength` → `compressed.compressedBytes`
  - Properly typed CompressResult interface usage in API endpoint

---

## Recent Updates (August 2026)

### Completed
- ✅ **Dual CRM Sync (GHL + Loops)**: Contact data now syncs to both platforms
  - **On deck submission**: Email, name, submission ID → both GHL and Loops
  - **On analysis completion**: Score, verdict, all 8 dimension scores → both platforms
  - **12 GHL custom fields wired up**:
    - `Deck Score` (3bxhCqt09ygRcoBoAZ8B), `Deck Verdict` (iZv15mWFhiIMlqZNH4c6), `Deck Results URL` (fzyfynLQ9mVvpYdcOoU1), `Deck Submission ID` (hQDLWShDeKgJBbTYWc9m)
    - Problem (u1bV8tEnu2zWTsBflXIu), Solution (xsIZlE6GQYGpSjtGjf7w), Market (6ViiQIyHWkGRsFBdGeXt), Business Model (dZ4hNcy8j03li0GSB8IL), Traction (HcKCNrlfmFeHTA9pZwRQ), Team (EUcRv01IQp6Vp2Pw622q), Financials (pgtlybd1fNPvWcyBAsTM), Competition (UZGCpIfva0egbh1CKnYK)
  - GHL API: Fixed endpoint to `https://services.leadconnectorhq.com`, added Version header (2021-07-28)
  - Loops receives dimension scores as custom properties for automation

- ✅ **Free Tier UX Improvements**: Better conversion flow when users hit free limit
  - Error detection: Redirects to `/upsell?reason=free_limit` instead of showing error message
  - Smart decline: "No thanks" button on upsell → `/results/{id}` (shows their free analysis) instead of payment page
  - Clear value prop: Distinct messaging for free-tier upsell ($7 unlimited) vs community upsell ($97/month)

- ✅ **Sentry Re-enabled**: Full error tracking restored
  - Captures all GHL and Loops sync errors with context
  - Tracks API failures, response codes, and request bodies
  - Explicit error reporting for debugging contact sync issues

- ✅ **GoHighLevel Integration (Phase 1)**: Migrated deck submitter sync from Loops to GHL (Source Capital location: `Px7umc3EewzT2DNAvJxr`)
  - See `GHL_SETUP.md` for full setup guide (API endpoint, headers, location ID verification)
  
- ✅ **PostHog Funnel Tracking**: Added 4-event funnel to track deck analysis conversion
  - `deck_submitted` → submission succeeds
  - `analysis_completed` → analysis finishes with score/verdict
  - `upgrade_viewed` → results page shown to unpaid users
  - `upgrade_purchased` → payment confirmed on thank-you page
  - Enables complete user journey visibility in PostHog

- ✅ **Production Deployment**: All changes committed, pushed, and deployed to Vercel
  - Requires: `GHL_API_TOKEN` env var in production
  - Status: Live at https://app.sourcecapital.co.uk

- ✅ **Client Journey Visualization Prompt**: Created comprehensive prompt for designing complete product flow diagram
  - File: `CLIENT_JOURNEY_PROMPT.md`
  - Documents 3 parallel user journeys: Founder (Deck Analysis), Investor (Raise Listings), Fundraiser (CRM Pipeline)
  - Includes 5 strategic upsell moments with triggers and pricing
  - Details all system integrations (Supabase, Claude AI, GHL, Whop, Loops, PostHog, Sentry)
  - Provides visual style guidelines, metrics, and layout templates
  - Use with Figma, Miro, Lucidchart, or Adobe XD to create visual diagrams

### In Progress / Planned
- 🔲 **Payment Tracking in GHL**: Update customer status when deck upgrade is purchased
  - Need: Whop webhook → submission lookup → GHL contact update
  - Fields to create: Customer Status, Purchase Date, Plan Type, Subscription Status
  - Requires: Passing `submission_id` through Whop checkout metadata

---

## Tech Stack

- **Framework**: Next.js 14.2.20 (App Router, Server Components)
- **Language**: TypeScript 5
- **Database**: Supabase (PostgreSQL with RLS policies)
- **Auth**: Supabase Auth (email-based)
- **AI**: Anthropic Claude SDK (`@anthropic-ai/sdk`)
- **Charts**: Recharts
- **Styling**: Inline React styles (no Tailwind or CSS modules—see feedback notes)
- **Monitoring**: Sentry (client & server)
- **Analytics**: PostHog
- **Payments**: Whop (for membership/tier management)
- **CRM**: GoHighLevel (contacts, email via Loops webhook)
- **Email**: Loops.so (transactional emails only)
- **PDF Processing**: pdf-lib, pdfjs-dist

---

## Core Features

### 1. **Pitch Deck Analysis**
- Upload PDF pitch decks via canonical `/investment-score` → `/investment-score/upload` route
- Lead capture via optional modal (name, email stored in sessionStorage)
- Claude AI analyzes across 8 weighted dimensions (problem, solution, market, business model, traction, team, financials, competitive landscape)
- Returns structured JSON score (0–100), verdict, and detailed section-by-section breakdown
- Results stored in `deck_submissions` table
- Analysis cached/viewable in dashboard
- **Legacy routes** (`/upload`, `/investability-score/*`) redirect to canonical flow for backwards compatibility

### 2. **CRM Pipeline (Fundraiser-focused)**
- Track investors in a funnel: researching → interested → meetings → committed → closed
- Bulk CSV import of investors (`/crm/projects/<id>/import-csv`)
- Investor profiles: fund name, contact, role, email, LinkedIn, stage focus, geography, sector, check size, thesis notes
- Projects group investors (e.g., "Series A Campaign")
- Touchpoint tracking (emails, calls, meetings)
- Portfolio view showing closed/invested companies

### 3. **Raise Listings** (Directory/Marketplace)
- Founders publish raise opportunities to a public directory
- Tiered access: free, growth, priority (via Whop)
- Listings include: company name, logo, description, sector, stage, target raise, minimum check size, use of funds, traction summary
- Status workflow: draft → pending review → approved → published
- RLS prevents unauthorized access (owners can manage own, admins can manage all)
- Anonymous view/unique viewer tracking

### 4. **User Profiles & Billing**
- Track analyses used, plan tier (free → paid)
- CRM access tied to plan
- Whop webhook integration for subscription state

### 5. **PostHog Analytics Funnel**
- **deck_submitted** (upload/page.tsx): Fired after successful PDF upload with submission_id, business_name, country
- **analysis_completed** (analysing/[id]/page.tsx): Fired when Claude analysis finishes with score, verdict, verdict_type
- **upgrade_viewed** (results/[id]/page.tsx): Fired when non-paid user sees paywall unlock UI (submission_id, score)
- **upgrade_purchased** (thank-you/page.tsx): Fired once when payment confirmed (submission_id)
- Tracks complete user journey: submission → analysis → paywall → purchase

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth-related routes
│   │   ├── login/               # Login page
│   │   └── auth/callback/       # OAuth callback
│   ├── api/                     # REST endpoints
│   │   ├── submit/route.ts      # Deck submission entry point
│   │   ├── analyse/[id]/        # Async analysis worker
│   │   ├── status/[id]/         # Poll analysis status
│   │   ├── crm/                 # CRM endpoints
│   │   │   ├── pipeline/        # Manage investors
│   │   │   ├── projects/        # Manage projects
│   │   │   ├── prospects/       # Prospect CRUD
│   │   │   ├── investors/       # Bulk operations
│   │   │   └── touchpoints/     # Activity log
│   │   ├── raise-listing/       # Marketplace endpoints
│   │   └── webhooks/            # Whop, Loops integrations
│   ├── dashboard/               # Main hub (redirected from /)
│   ├── upload/                  # Deck upload UI
│   ├── analysing/               # Upload → analysis in progress
│   ├── results/                 # Analysis results display
│   ├── crm/                     # CRM suite
│   │   ├── layout.tsx           # CRM shell + nav
│   │   ├── page.tsx             # CRM home/overview
│   │   └── pipeline/[id]/       # Project pipeline view
│   ├── raise-listing/           # Raise directory UI
│   ├── investment-score/        # (Legacy deck analysis routes)
│   └── opportunities/           # Public raise listings directory
├── components/                   # React components
│   ├── LeadModal.tsx            # CRM lead capture
│   └── raise-listing/           # Raise listing components
│       └── ListingCard.tsx
├── lib/                         # Utilities & shared logic
│   ├── supabaseServer.ts        # Server-side Supabase client
│   ├── supabaseBrowser.ts       # Client-side Supabase client
│   ├── supabaseAdmin.ts         # Admin Supabase client (service role)
│   ├── deckPrompt.ts            # Claude system prompt for deck analysis
│   ├── compressPdf.ts           # PDF compression logic
│   ├── whop.ts                  # Whop API integration
│   ├── loops.ts                 # Loops email integration
│   ├── errorHandler.ts          # Error tracking & formatting
│   ├── crm/                     # CRM domain logic
│   │   ├── types.ts             # Types for prospects, pipeline
│   │   ├── stages.ts            # Pipeline stage definitions
│   │   └── prospect-types.ts
│   └── raiseListing/            # Raise listing logic
│       ├── types.ts
│       ├── validation.ts
│       └── slug.ts              # URL slug generation
├── middleware.ts                # Auth + request routing
├── instrumentation.ts           # Sentry setup
└── providers.tsx                # React context providers

supabase/
├── raise_listing_schema.sql    # Raise listings, team, reviews schema
├── crm_schema.sql              # Pipeline, investors, projects, touchpoints
├── auth_schema.sql             # Profiles, roles, admin setup
└── migrations/                 # Historical migrations

public/
├── favicon.ico
└── sample-investors.csv        # CSV import template
```

---

## Database Schema (High-Level)

### Deck Submissions
```sql
deck_submissions (
  id, user_id, business_name, created_at, status, 
  score, verdict, analysis_json, pdf_path, pdf_size
)
-- status: 'pending' | 'completed' | 'failed'
-- RLS: users see own submissions only
```

### CRM Tables
```sql
raise_projects (
  id, owner_id, name, status, target_raise, created_at
)

pipeline_investors (
  id, project_id, user_id, fund_name, contact_name, role, email, 
  linkedin_url, stage_focus, geography, sector_focus, 
  check_size_min, check_size_max, thesis_notes, 
  stage, archived, created_at, updated_at
)
-- stage: 'researching' | 'interested' | 'meetings' | 'committed' | 'closed'
-- RLS: users see own projects/investors

crm_touchpoints (
  id, project_id, investor_id, type, date, notes, created_at
)
-- type: 'email' | 'call' | 'meeting' | 'note'
```

### Raise Listings
```sql
raise_listings (
  id, user_id, slug, company_name, one_liner, description,
  sector[], stage, target_raise_amount, currency, 
  status, published_at, tier, verified_badge, 
  view_count, unique_viewer_count, created_at, updated_at
)
-- status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
-- tier: 'free' | 'growth' | 'priority'
-- RLS: owners manage own, public views approved only

raise_listing_team_members (
  id, listing_id, name, title, bio, linkedin_url, order_rank
)

raise_listing_investor_reviews (
  id, listing_id, reviewer_id, rating, review_text, created_at
)
```

### Profiles & Auth
```sql
profiles (
  id, email, first_name, plan, analyses_used, crm_access, 
  sc_admin, created_at, updated_at
)
-- plan: 'free' | 'pro' | 'enterprise'
-- crm_access: boolean (gated by plan or Whop tier)
-- sc_admin: boolean (Source Capital admin)
```

**RLS Policies**: Every table enforces row-level security. Users see only their own data; admins can override.

---

## Key User Flows

### Flow 1: Deck Analysis
1. User navigates to `/investment-score` (canonical deck analysis landing page)
2. Optional: Fill LeadModal with name/email (stored in sessionStorage)
3. Click "Continue to Upload" → `/investment-score/upload` page
3. Select PDF → form submits to `POST /api/submit`
4. Backend: validates PDF, compresses, saves to Supabase Storage, creates `deck_submissions` entry
5. Returns `submission_id`, redirects to `/analysing/[id]`
6. Frontend polls `GET /api/status/[id]` for analysis status
7. Backend worker (async): `GET /api/analyse/[id]` calls Claude with PDF text + system prompt from `lib/deckPrompt.ts`
8. Claude returns JSON score, verdict, dimension breakdown
9. Result stored in `deck_submissions.analysis_json`, status → 'completed'
10. User redirected to `/results/[id]` when polling sees completion

### Flow 2: CRM Pipeline Management
1. User navigates to `/crm` (requires `crm_access` = true)
2. Views list of projects at `/crm/projects` (server-side fetch from `raise_projects`)
3. Opens project → `/crm/pipeline/[id]` shows investors in funnel stages
4. Add investor manually: form submits to `POST /api/crm/pipeline` → creates `pipeline_investors` row
5. Bulk import: click "Import CSV" → file upload → `POST /api/crm/investors` parses CSV, validates fields, bulk inserts
6. Edit investor: click row → modal form → `PATCH /api/crm/pipeline/[id]` updates
7. Move to committed: drag/click → updates stage → triggers optional email via Loops
8. Track touchpoints: click "Add Note/Call/Email" → `POST /api/crm/touchpoints` → logs to `crm_touchpoints`

### Flow 3: Raise Listing Publication
1. Founder logs in, goes to `/raise-listing` or `/opportunities` (public directory)
2. Click "Create Listing" → form with company name, description, sector, stage, raise target
3. Upload logo, add team members, set "use of funds"
4. Save as draft → stored in `raise_listings` with status='draft'
5. Submit for review → status='pending_review', admin notified
6. Admin reviews → approves/rejects via `PATCH /api/raise-listing/listings/[id]`
7. Approved → status='approved', auto-published on a schedule
8. Public can view at `/opportunities/[slug]` (RLS filters to approved only)
9. Investors can rate/review → `POST /api/raise-listing/reviews`

---

## API Endpoints

### Deck Analysis
- `POST /api/submit` — Submit PDF for analysis
- `GET /api/status/[id]` — Poll analysis status
- `GET /api/analyse/[id]` — (Internal) Run Claude analysis on a submission

### CRM
- `GET /api/crm/projects` — List user's projects
- `POST /api/crm/projects` — Create new project
- `GET /api/crm/pipeline?project_id=X` — Fetch investors for a project
- `POST /api/crm/pipeline` — Add investor to project
- `PATCH /api/crm/pipeline/[id]` — Update investor details/stage
- `DELETE /api/crm/pipeline/[id]` — Archive investor
- `POST /api/crm/investors` — Bulk CSV import
- `GET /api/crm/touchpoints?investor_id=X` — Fetch touchpoints
- `POST /api/crm/touchpoints` — Log touchpoint (call, email, meeting, note)
- `GET /api/crm/portfolio` — Summary of closed/portfolio investors

### Raise Listings
- `GET /api/raise-listing/listings` — List user's listings (admin can see all)
- `POST /api/raise-listing/listings` — Create new listing
- `PATCH /api/raise-listing/listings/[id]` — Update listing
- `GET /api/raise-listing/listings/[id]/public` — Public view (RLS-filtered)
- `POST /api/raise-listing/reviews` — Add investor review
- `GET /api/raise-listing/reviews/[listing_id]` — Fetch reviews for a listing
- `POST /api/raise-listing/track` — Track view/visitor (anonymous)

### Webhooks
- `POST /api/webhooks/loops` — Email event hooks
- `POST /api/whop/webhook` — Subscription events (tier changes, cancellations)

---

## Important Implementation Patterns

### 1. Authentication & RLS
- Use `createSupabaseServerClient()` in Server Components to get the authenticated user
- Use `supabaseAdmin` for privileged operations (fetching user profiles, bulk updates)
- All tables have RLS policies; frontend filters are for UX only, security is database-enforced
- Example:
  ```ts
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // User context automatically used in subsequent RLS queries
  ```

### 2. PDF Handling
- PDFs are compressed with `compressPdf()` before storage (reduces cost, speeds up Claude)
- Stored in Supabase Storage under `/decks/{user_id}/{submission_id}.pdf`
- Before sending to Claude, extract text and use only first 20-30 pages or ~50KB of text
- See `lib/deckPrompt.ts` for exact prompt & token limits

### 3. Async Analysis Pattern
- `POST /api/submit` returns immediately with `submission_id`
- Frontend polls `GET /api/status/[id]` (status: pending | completed | failed)
- Actual analysis happens in a separate request: `GET /api/analyse/[id]` (can take 5-30 seconds)
- Claude request includes PDF text + system prompt + user prompt
- Result stored in DB before returning to frontend

### 4. CSV Import
- CSV is parsed in-memory (max 10K rows recommended)
- Expected columns: fund_name (required), contact_name, role, email, linkedin_url, stage_focus, geography, sector_focus, check_size_min, check_size_max, thesis_notes
- Multi-select fields (stage_focus, geography, sector_focus) use semicolon (`;`) delimiters
- All rows are inserted with stage='researching' by default
- See `CSV_IMPORT_GUIDE.md` for user-facing docs

### 5. Dual CRM Sync (GHL + Loops)
- **GoHighLevel Contact Sync**:
  - API endpoint: `https://services.leadconnectorhq.com/contacts/upsert`
  - Location ID: `Px7umc3EewzT2DNAvJxr` (Source Capital)
  - Headers: `Authorization: Bearer {GHL_API_TOKEN}`, `Version: 2021-07-28`
  - On submission: Basic contact info + Deck Submission ID
  - On analysis: Score, verdict, resultsUrl, + all 8 dimension scores as custom fields
  - Custom field IDs: See Recent Updates section for full mapping
  - Integration: `lib/ghl.ts` provides `createOrUpdateContact()` with customFieldValues array
  - Called from: `src/app/api/submit/route.ts` and `src/app/api/analyse/[id]/route.ts`
  
- **Loops Contact Sync** (parallel to GHL):
  - Syncs same data to Loops for marketing automation
  - Loops receives custom properties (customProperties) for all dimension scores
  - Allows segmentation and automated workflows based on deck quality
  - Integration: `lib/loops.ts` provides same `createOrUpdateContact()` function

### 6. PDF Storage
- Deck PDFs stored in Supabase Storage (bucket: `decks`)
- Path structure: `{submissionId}/{filename}`
- File path recorded in `deck_submissions.deck_file_path` column
- PDFs permanently retained (not deleted after analysis)

### 7. Styling Constraints
- **No Tailwind, no CSS modules.** All styling is inline React style objects
- Example: `<div style={{ backgroundColor: '#0A0A0A', padding: '16px' }}>`
- Nav header must always be `#0A0A0A` (black background)
- Charts: use custom horizontal bars, not Recharts `<FunnelChart>`
- Metrics: apply green/red color-coding based on thresholds (see `project_raw_data_highlighting.md` in memory)

### 8. Data Unwrapping (Supabase Joins)
- When Supabase returns joined data, check if it's an array before accessing:
  ```ts
  const investor = row.pipeline_investors;
  if (Array.isArray(investor)) investor = investor[0];
  // Now safe to use investor.fund_name
  ```
- This prevents TypeScript build errors on array-wrapped single records

### 9. Airtable Field Names (if used)
- Investors table: use "Current Firm" not "Firm Name"
- This pattern applies when syncing with external Airtable bases

---

## Deployment & Infrastructure

- **Hosting**: Vercel (Next.js optimized)
- **Database**: Supabase (managed PostgreSQL)
- **Storage**: Supabase Storage (PDFs)
- **Long-running requests**: API routes support up to 5 minutes on Vercel Pro (for PDF processing)
- **Environment variables** (`.env.local`):
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  WHOP_API_KEY
  GHL_API_TOKEN
  LOOPS_API_KEY (for transactional emails only; GHL handles contact sync)
  LOOPS_TRANSACTIONAL_ID
  LOOPS_PAYMENT_TRANSACTIONAL_ID
  LOOPS_CRM_INVITE_TRANSACTIONAL_ID
  ```

### Sentry Monitoring
- Configured for both client and server
- Source map upload on build
- Vercel Cron Monitor integration (if using scheduled tasks)
- Slack alerts on errors in production

---

## How to Extend

### Adding a New Dashboard Metric
1. Edit `src/app/dashboard/page.tsx` (server component)
2. Fetch data from Supabase (e.g., from `pipeline_investors`, `deck_submissions`)
3. Pass as prop to `DashboardClient`
4. Render in client component with inline styles

### Adding a CRM Feature (e.g., bulk email)
1. Create route: `src/app/api/crm/bulk-email/route.ts`
2. Validate input, fetch investor list from DB
3. Call Loops API (`lib/loops.ts`) to queue emails
4. Return success/failure to frontend
5. Add UI trigger in `/crm` pages

### Adding a New Deck Analysis Dimension
1. Update `SKILL.md` with new dimension definition and scoring guide
2. Edit `lib/deckPrompt.ts` system prompt to include new dimension
3. Adjust score calculation formula (weights must sum to 100 after normalization)
4. Update results display (`src/app/results/`) to render new section
5. Test with sample decks

### Adding Raise Listing Tiers
1. Update `raise_listings` schema (check `supabase/raise_listing_schema.sql`)
2. Add new tier value to `tier` column constraint
3. Update Whop integration (`lib/whop.ts`) to create/manage new tier products
4. Adjust visibility/ranking logic in `src/app/opportunities/page.tsx`

---

## Testing & Debugging

- **Dev server**: `npm run dev` → http://localhost:3000
- **Build**: `npm run build` (TypeScript validation, Sentry source maps)
- **Deck analysis**: POST a test PDF to `/api/submit`, then poll `/api/status/[id]`
- **CRM CSV import**: Use `public/sample-investors.csv` as template
- **Database**: Direct SQL queries in Supabase dashboard (SQL Editor)
- **Logs**: Sentry dashboard for prod errors, `npm run dev` console for local

---

## Known Constraints & Gotchas

1. **Long PDF analysis times**: Very large PDFs (100+ pages) can timeout. Compress before submission.
2. **CSV imports over 10K rows**: May exceed function timeout. Recommend breaking into batches.
3. **RLS policies block ALL unauthenticated access**: Even reads. Always ensure user is logged in before CRM routes.
4. **Recharts FunnelChart not used**: User feedback prefers custom horizontal bars for funnel visualizations.
5. **No Tailwind allowed**: All styling must be inline. Tailwind classes will not work and will be rejected.
6. **Investors in bulk import default to "researching"**: Cannot change stage during CSV import; update manually after.
7. **Raise listings require admin approval**: Draft listings are not public; submission doesn't auto-publish.

---

## Handoff Checklist for New Agent

- [ ] Review `/SKILL.md` for deck analysis scoring rubric
- [ ] Review `/CSV_IMPORT_GUIDE.md` for CRM import specs
- [ ] Review `/GHL_SETUP.md` for GoHighLevel integration setup
- [ ] Review `/CLIENT_JOURNEY_PROMPT.md` for product architecture & upsell strategy
- [ ] Check `lib/deckPrompt.ts` for current Claude system prompt
- [ ] Check `lib/ghl.ts` for GoHighLevel contact sync logic
- [ ] Understand RLS policies: every table enforces auth
- [ ] Verify all styling is inline (no Tailwind/CSS modules)
- [ ] Test a deck submission end-to-end (upload → analysis → results)
- [ ] Verify contact appears in GoHighLevel within 5 seconds of submission
- [ ] Check PostHog for 4 funnel events: deck_submitted → analysis_completed → upgrade_viewed → upgrade_purchased
- [ ] Test CSV import with `public/sample-investors.csv`
- [ ] Confirm Supabase, Anthropic, GHL API keys are in env

---

## Entry Points by Task Type

- **Bug fix in deck analysis**: Check `lib/deckPrompt.ts`, `src/app/api/analyse/`, results display
- **CRM improvements**: Check `src/app/crm/`, `src/app/api/crm/`, database schema
- **Raise listing changes**: Check `src/app/raise-listing/`, `supabase/raise_listing_schema.sql`
- **GoHighLevel/contact sync**: Check `lib/ghl.ts`, `src/app/api/submit/`, `src/app/api/analyse/`
- **PostHog funnel tracking**: Check component files for `posthog.capture()` calls (upload, analysing, results, thank-you)
- **Auth/user flow**: Check `src/middleware.ts`, `src/app/dashboard/`, profile logic
- **Styling issues**: Check component files for inline styles (no Tailwind)
- **Performance**: Check PDF compression, API response times, RLS query counts
