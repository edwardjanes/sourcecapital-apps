# Valuation Engine — Go Live Checklist (Step-by-Step)

## PHASE 1: Database Setup (5 minutes)

### Step 1.1: Open Supabase Dashboard
1. Go to https://app.supabase.com
2. Log in with your account
3. Select project **"Pitch Deck Analyser"** (ochyvcxwtpclkpdacpae)
4. Click **SQL Editor** in the left sidebar

### Step 1.2: Apply Migration #1 (Companies Table)
1. Click **New Query**
2. Copy entire contents of `/Users/edwardjanes/Documents/Valuation Engine/supabase/001_valuation_companies.sql`
3. Paste into SQL editor
4. Click **Run** (▶ button at bottom right)
5. Wait for success message ✅

### Step 1.3: Apply Migration #2 (Input Tables)
1. Click **New Query** (again)
2. Copy entire contents of `supabase/002_valuation_inputs.sql`
3. Paste into SQL editor
4. Click **Run**
5. Wait for success ✅

### Step 1.4: Apply Migration #3 (Parameters & Snapshots)
1. Click **New Query** (again)
2. Copy entire contents of `supabase/003_valuation_parameters_snapshots.sql`
3. Paste into SQL editor
4. Click **Run**
5. Wait for success ✅

### Step 1.5: Verify Tables Created
1. In Supabase dashboard, click **Table Editor** (left sidebar)
2. Verify you see these tables:
   - `valuation_companies`
   - `valuation_questionnaire_responses`
   - `valuation_financials`
   - `valuation_cap_table`
   - `valuation_funding_rounds`
   - `valuation_comparables`
   - `valuation_transaction`
   - `valuation_parameters`
   - `valuation_snapshots`
3. ✅ All 9 tables present

---

## PHASE 2: Local Testing (10 minutes)

### Step 2.1: Verify Environment File
```bash
cd /Users/edwardjanes/Documents/Valuation\ Engine
cat .env.local
```

**You should see:**
```
NEXT_PUBLIC_SUPABASE_URL=https://ochyvcxwtpclkpdacpae.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**If SUPABASE_SERVICE_ROLE_KEY is missing:**
1. Go to Supabase dashboard → Settings → API
2. Copy **Service Role Key** (labeled "service_role")
3. Update `.env.local`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>
   ```

### Step 2.2: Start Dev Server
```bash
npm run dev
```

**Expected output:**
```
> next dev
  ▲ Next.js 14.2.20
  - Local:        http://localhost:3000
  - Environments: .env.local
```

Open http://localhost:3000 in your browser → should redirect to `/login`

### Step 2.3: Test Sign Up Flow
1. At `/login`, click **"Create an account"** (or similar text)
2. Enter email: `test@example.com`
3. Enter password: `TestPassword123!`
4. Click **Sign Up**
5. ✅ Should redirect to `/dashboard`

### Step 2.4: Test Wizard Flow
1. On dashboard, click **"+ New Valuation"**
2. ✅ Should create a company and redirect to `/companies/[id]/edit`
3. Fill out **Profile Step**:
   - Company Name: "TestCorp"
   - Country: "United States"
   - Industry: "SaaS"
   - Stage: "development"
   - Click **Next →**
4. ✅ Advance to Questionnaire step
5. Fill out **Questionnaire** (at least 1 field per tab)
   - Team: Set "Team Size" to 5
   - Click **Next →**
6. Fill out **Financials**:
   - Set Year 0 Revenue to 1,000,000
   - Click **Next →**
7. **Cap Table**: Click **+ Add Shareholder**, add one
   - Name: "Founder 1"
   - Ownership: 100%
   - Click **Next →**
8. **Comparables**: Add one comparable
   - Company Name: "Slack"
   - Multiple: 5.5
   - Click **Next →**
9. **Parameters**: All weight sliders should auto-sum to 100%
   - Click **📊 Generate Report**

### Step 2.5: Verify Report Generation
1. ✅ Should redirect to `/companies/[id]/report/[snapshotId]`
2. You should see:
   - Company name "TestCorp" in header
   - **Executive Summary** box with:
     - Valuation (large number, e.g., $3-5M)
     - Low Bound (−20%)
     - High Bound (+20%)
   - **Valuation Methods** table with 6 rows:
     - scorecard
     - checklist
     - vc
     - dcf_ltg
     - dcf_multiple
     - multiples

### Step 2.6: Test PDF Export
1. Click **📄 Export PDF** button
2. Browser print dialog opens
3. Choose "Save as PDF" (don't actually print)
4. ✅ PDF generates successfully

### Step 2.7: Run Unit Tests
```bash
npm run test
```

**Expected output:**
```
 Test Files  3 passed (3)
 Tests       3 passed, 0 failed
```

✅ All 3 tests passing

---

## PHASE 3: Git & GitHub Setup (5 minutes)

### Step 3.1: Initialize Git (if not already done)
```bash
cd /Users/edwardjanes/Documents/Valuation\ Engine
git status
```

If you see "fatal: not a git repository":
```bash
git init
git config user.email "edward@sourcecapital.co.uk"
git config user.name "Edward Janes"
```

### Step 3.2: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `valuation-engine`
3. Description: `Equidam-style startup valuation platform`
4. Make it **Private** (only you can see it)
5. Click **Create repository**
6. Copy the HTTPS URL (e.g., `https://github.com/yourname/valuation-engine.git`)

### Step 3.3: Add Remote & Push
```bash
cd /Users/edwardjanes/Documents/Valuation\ Engine

# Add remote
git remote add origin https://github.com/yourname/valuation-engine.git

# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: Valuation Engine MVP

- Equidam-style 6-method valuation engine
- 6-step wizard for company data entry
- Report generation with snapshot persistence
- Supabase RLS-protected schema
- Validated against NovaCloud reference figures

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# Push to GitHub
git branch -M main
git push -u origin main
```

✅ Repository pushed to GitHub

---

## PHASE 4: Deploy to Vercel (10 minutes)

### Step 4.1: Create Vercel Account & Link Project
1. Go to https://vercel.com
2. Sign up / log in
3. Click **Add New → Project**
4. Click **Continue with GitHub**
5. Authorize Vercel to access GitHub
6. Select repository: `valuation-engine`
7. Click **Import**

### Step 4.2: Set Environment Variables
On the **Configure Project** page:

Add these 3 environment variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ochyvcxwtpclkpdacpae.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(copy from .env.local)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(copy from .env.local)* |

1. Click **Environment Variables**
2. For each variable:
   - Click **Add**
   - Paste name + value
   - Select scope: **Production** (and optionally Preview/Development)
3. Click **Deploy** button

### Step 4.3: Wait for Build
1. Vercel starts building the project
2. Watch the build logs (should take 2-3 minutes)
3. ✅ When you see "Build Complete", deployment succeeded

### Step 4.4: Get Your Live URL
1. Once complete, Vercel shows: `https://valuation-engine-<random>.vercel.app`
2. (Or a custom domain if you configured one)
3. Click the URL to open your live app
4. ✅ App should load at `/login`

---

## PHASE 5: Production Testing (10 minutes)

### Step 5.1: Test Live Sign Up
1. Go to your Vercel URL (e.g., `https://valuation-engine-abc123.vercel.app`)
2. ✅ Should see login page
3. Click **Create an account**
4. Sign up with a new email
5. ✅ Should redirect to `/dashboard`

### Step 5.2: Test Live Wizard (Abbreviated)
1. Click **+ New Valuation**
2. Fill all 6 steps (same as local test above)
3. Click **Generate Report**
4. ✅ Should show valuations

### Step 5.3: Verify Database Writes
1. Go back to Supabase dashboard
2. Click **Table Editor**
3. Open `valuation_companies` table
4. ✅ You should see the "TestCorp" record you created
5. Click it to view profile fields (name, country, industry, stage)

### Step 5.4: Verify Snapshot Persistence
1. Go back to your live app
2. Go to the report page (should still be open)
3. Refresh the page (`Cmd+R`)
4. ✅ Report data should reload (snapshot persisted to database)

### Step 5.5: Test Multiple Reports
1. Go back to wizard
2. Change wizard step to Parameters
3. Change one weight slider (e.g., Scorecard from 30% to 25%)
4. Click **Generate Report** again
5. ✅ New snapshot created with different weights
6. Verify new valuation differs from first one

---

## PHASE 6: Final Verification Checklist

**Database**:
- [ ] All 9 tables created in Supabase
- [ ] RLS policies enforced (user can only see own data)
- [ ] Test company record visible in `valuation_companies` table
- [ ] Test snapshot visible in `valuation_snapshots` table

**Local Dev**:
- [ ] `npm run test` passes (3/3 tests)
- [ ] `npm run dev` starts without errors
- [ ] Full wizard flow completes
- [ ] Report generates with all 6 methods
- [ ] PDF export works

**Production (Vercel)**:
- [ ] App deploys successfully
- [ ] Sign up/login works
- [ ] Wizard flow works end-to-end
- [ ] Reports generate
- [ ] Data persists in Supabase

**Feature Validation**:
- [ ] Scorecard valuation matches formula ($5.3M for NovaCloud inputs)
- [ ] Checklist valuation matches formula ($4.5M for NovaCloud inputs)
- [ ] Report shows all 6 method valuations
- [ ] Weight sliders enforce 100% constraint
- [ ] Multiple reports create separate snapshots

---

## TROUBLESHOOTING

| Issue | Fix |
|-------|-----|
| "SUPABASE_SERVICE_ROLE_KEY missing" | Copy from Supabase dashboard → Settings → API (service_role key) |
| "RLS policy violation" when saving | Verify migrations applied, check Table Editor for RLS policies |
| "Build fails on Vercel" | Check env vars are set in Vercel dashboard, not just locally |
| "Report shows $0 valuation" | Verify financials were entered (engine needs revenue data) |
| "Snapshot not saved to DB" | Check browser console for network errors, verify auth token is valid |
| "PDF export shows nothing" | Try different browser (some have print CSS issues), or use Print → Save as PDF |

---

## Success Criteria

You've successfully shipped when:

✅ Live app at Vercel URL  
✅ Sign up/login works  
✅ Wizard accepts company data  
✅ Report generates with 6 valuations  
✅ Data persists in Supabase  
✅ Multiple users can create separate companies  
✅ All unit tests pass  

---

## Post-Launch Improvements (Optional)

Once live and tested, consider:
- [ ] Expand report with 14 detailed sections (Scorecard breakdown, DCF assumptions, etc.)
- [ ] Add snapshot history list view
- [ ] Implement "Edit company → new snapshot" flow
- [ ] Add form validation (required fields, number ranges)
- [ ] Add loading states during report generation
- [ ] Implement better error handling
- [ ] Custom domain setup (e.g., valuations.sourcecapital.co.uk)

---

## Support Contacts

- **Supabase Issues**: https://supabase.com/docs
- **Next.js Issues**: https://nextjs.org/docs
- **Vercel Deployment**: https://vercel.com/docs

---

**Total Time: ~30 minutes from zero to production**

Once you complete Phase 1 (database), everything else should work automatically. Good luck! 🚀
