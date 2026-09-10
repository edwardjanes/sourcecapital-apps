# Testing Guide — Valuation Engine

## Quick Start: Run Tests

```bash
cd /Users/edwardjanes/Documents/Valuation\ Engine

# Install dependencies (if not already done)
npm install

# Run all tests
npm run test

# Run tests in watch mode (auto-rerun on file changes)
npm run test -- --watch

# Run a specific test file
npm run test -- checklist.test.ts
```

## Test Environment Setup

The test environment uses Vitest (already in `devDependencies`).

**Environment file**: `.env.local` (already created)
- `NEXT_PUBLIC_SUPABASE_URL`: Shared project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key (safe to commit)
- `SUPABASE_SERVICE_ROLE_KEY`: Placeholder — only needed for server-side Supabase calls in later milestones

Tests for the valuation engine (`src/lib/valuation/__tests__/*.ts`) do NOT require Supabase — they are pure unit tests.

## Sample Data: NovaCloud Systems

The test fixtures use data from Equidam's reference report. All test data is in the test files themselves:

### Checklist Test Data
**File**: `src/lib/valuation/__tests__/checklist.test.ts`

**Company**: NovaCloud Systems
**Stage**: Development
**Country**: Germany
**Industry**: Application Software
**Max Valuation**: $12,367,664

**Input Criteria Scores** (as % of max valuation achieved):
```
Quality of Core Team:         30% weight × 55% score = $2,040,665 achieved
Quality of Idea:              20% weight × 55% score = $1,360,443 achieved
Product Roll-out & IP:        15% weight × 5.56% score = $103,064 achieved
Strategic Relationships:      15% weight × 50% score = $927,575 achieved
Operating Stage:              20% weight × 5% score = $123,677 achieved
─────────────────────────────────────────────────────────
Expected Valuation: $4,555,423
```

### Scorecard Test Data
**File**: `src/lib/valuation/__tests__/scorecard.test.ts`

**Company**: NovaCloud Systems (same as above)
**Average Pre-Money Valuation**: $4,164,857

**Input Criteria Scores** (0 = at-market average; positive/negative = over/under):
```
Strength of Team:             30% weight × 0.0 score = -$0 deviation
Size of Opportunity:          25% weight × 0.5 score = +$519,357 contribution
Competitive Environment:      10% weight × 0.25 score = +$104,121 contribution
Product/Service Strength:     15% weight × 0.25 score = +$156,182 contribution
Strategic Partnerships:       10% weight × 0.375 score = +$156,182 contribution
Funding Required:             10% weight × 0.5 score = +$208,243 contribution
─────────────────────────────────────────────────────────
Σ(weight × score) = 1.275
Valuation = $4,164,857 × (1 + 1.275) = $5,310,193
```

### Weights Test Data
**File**: `src/lib/valuation/__tests__/weights.test.ts`

Verifies that each company stage's method weights sum to exactly 1.0:

```
Stage          Scorecard  Checklist    VC   DCF-LTG  DCF-Multiple  Multiples   Sum
─────────────────────────────────────────────────────────────────────────────────
Idea                38%        38%     16%       4%           4%           0%   100%
Development         30%        30%     16%      12%          12%           0%   100%
Startup             15%        15%     16%      27%          27%           0%   100%
Expansion            6%         6%     16%      36%          36%           0%   100%
Growth               0%         0%     20%      40%          40%           0%   100%
Maturity             0%         0%      0%      50%          50%           0%   100%
```

## Running Tests Locally

### 1. Install dependencies
```bash
cd /Users/edwardjanes/Documents/Valuation\ Engine
npm install
```

### 2. Run tests
```bash
# All tests with summary
npm run test

# Watch mode (recommended during development)
npm run test -- --watch

# Show coverage
npm run test -- --coverage

# Run one test file
npm run test -- checklist.test.ts

# Run tests matching a pattern
npm run test -- --grep "Scorecard"
```

### 3. Expected output
```
✓ src/lib/valuation/__tests__/checklist.test.ts (1)
  ✓ reproduces NovaCloud Checklist valuation: $4,555,423
✓ src/lib/valuation/__tests__/scorecard.test.ts (1)
  ✓ reproduces NovaCloud Scorecard valuation: $5,310,193
✓ src/lib/valuation/__tests__/weights.test.ts (1)
  ✓ all stage weight rows sum to 1.0

Test Files  3 passed (3)
Tests  3 passed (3)
Start at  14:30:15
Duration  245ms
```

## Adding More Tests

To add tests for other methods (VC, DCF-LTG, DCF-Multiple, Simple Multiples):

1. Create a new file: `src/lib/valuation/__tests__/[method].test.ts`
2. Import the calculation function from `../[method].ts`
3. Use the NovaCloud data from the reference report's PDF
4. Write a test that verifies the output matches the reference figure (within $100 rounding tolerance)

Example:
```typescript
import { expect, it } from "vitest";
import { computeVcMethod } from "../vc";

it("reproduces NovaCloud VC Method valuation: $1,582,250", () => {
  const result = computeVcMethod(
    1685670,        // Last year EBITDA
    12.12,          // Industry EBITDA multiple
    1.1147,         // Required ROI (111.47%)
    3,              // Projection years
    0               // Capital raised
  );
  
  expect(result.valuation).toBeCloseTo(1582250, -2);
});
```

## Continuous Integration

Once the repo is set up with git, you can add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test
```

## Troubleshooting

**Error: "Cannot find module 'vitest'"**
→ Run `npm install` first

**Error: "Supabase environment variables missing"**
→ Only needed for later milestones; unit tests don't require Supabase

**Tests hanging or timing out**
→ Check no Supabase API calls are being made in the test; unit tests should complete in <100ms

**Module resolution errors (e.g., "@/lib/...")**
→ Verify `tsconfig.json` has the `@/*` path alias (it does)
