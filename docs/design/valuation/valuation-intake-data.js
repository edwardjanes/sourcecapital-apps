// Valuation intake: founder-visible steps of valuation_intake v1.0.0, with MediSync prefill.
// src = where a prefill comes from (see SOURCES). confirm = founder must confirm before it counts.
// locked = reviewed listing field; change it on Listing, not here. ans = founder's own answer (used by partial/complete fixtures).
(function () {
  const SOURCES = {
    listing: { label: 'From your listing', bg: '#FBF1FA', fg: '#8C2F7F', dot: '#BB41B4' },
    deck: { label: 'From your deck', bg: '#FBF3E2', fg: '#6B4500', dot: '#B07A12' },
    traction: { label: 'Verified traction', bg: '#E9F5EE', fg: '#1E5C3D', dot: '#1E7A4F' },
    update: { label: 'From your October update', bg: '#EFE9F8', fg: '#4B2A7D', dot: '#4B2A7D' },
    dataroom: { label: 'From your financial model', bg: '#FBF3E2', fg: '#6B4500', dot: '#B07A12' },
    system: { label: 'Set by TheAngel', bg: '#F1EFF4', fg: '#3D3846', dot: '#5F5A68' }
  };
  const S5 = 'scale5';
  const steps = [
    { id: 'company', title: 'Company and classification', short: 'Company', mins: 3, usedFor: 'Country sets the risk-free rate, market premium, survival curve and tax rate. Industry sets beta, multiples and default cost ratios. Stage sets the method weights.', fields: [
      { id: 'company_name', label: 'Company name', type: 'text', req: true, src: 'listing', locked: true, pre: 'MediSync' },
      { id: 'valuation_as_of_date', label: 'Valuation as-of date', type: 'date', req: true, src: 'system', pre: '15 November 2026', hint: 'Today. Market data is taken as of this date.' },
      { id: 'reporting_currency', label: 'Reporting currency', type: 'select', req: true, opts: ['USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'CHF', 'SEK', 'Other'], src: 'listing', pre: 'USD', hint: 'The currency of your ask. Every money field below uses it.' },
      { id: 'country', label: 'Country', type: 'select', req: true, opts: ['United States'], src: 'listing', locked: true, pre: 'United States', notice: true },
      { id: 'industry', label: 'Industry', type: 'select', req: true, opts: ['Healthcare Information and Technology'], src: 'listing', confirm: true, pre: 'Healthcare Information and Technology', hint: 'Matched from your listing sector, Digital health. Check it is the closest fit.' },
      { id: 'stage_of_development', label: 'Stage of development', type: 'pills', req: true, opts: ['Idea', 'Development', 'Startup', 'Expansion', 'Growth', 'Maturity'], src: 'listing', confirm: true, pre: 'Startup', hint: 'Your listing says Seed. Seed companies with revenue are usually Startup here.' },
      { id: 'incorporation_year', label: 'Year of incorporation', type: 'integer', req: true, src: 'listing', locked: true, pre: '2023' },
      { id: 'legal_entity_incorporated', label: 'Is a legal entity incorporated?', type: 'bool', req: true, src: 'listing', pre: 'Yes', hint: 'Your listing has a company number.' },
      { id: 'external_legal_counsel', label: 'Do you use external legal counsel?', type: 'bool', req: false, ans: 'Yes' },
      { id: 'business_description', label: 'Business description', type: 'long', req: true, max: 2000, src: 'listing', pre: 'MediSync books, reminds and follows up patients for outpatient clinics. In two pilot clinics it cut no-shows by a third.' },
      { id: 'company_address', label: 'Company address', type: 'text', req: false },
      { id: 'competitors', label: 'Competitors', type: 'repeat', req: false, cols: ['Name', 'Website'], src: 'deck', confirm: true, pre: [['Carely Health', 'carely.com'], ['ClinicOS', 'clinicos.io']], add: 'Add a competitor' }
    ] },
    { id: 'team', title: 'Team', short: 'Team', mins: 3, usedFor: 'Feeds the team criterion in the scorecard and the core team criterion in the checklist. Employee count also adjusts beta.', fields: [
      { id: 'founders_count', label: 'Number of founders', type: 'integer', req: true, src: 'listing', pre: '3', hint: 'From the team section of your listing.' },
      { id: 'founders_capital_invested', label: "Founders' collective capital invested to date", type: 'currency', req: true, ans: '180,000' },
      { id: 'founders_time_commitment', label: "Founders' time commitment", type: S5, req: true, anch: ['Side project', 'Full time'], ans: 5 },
      { id: 'founders_avg_age', label: 'Average age of founders', type: 'pills', req: true, opts: ['Under 25', '25 to 34', '35 to 45', 'Over 45'], ans: '35 to 45' },
      { id: 'founders_prior_experience', label: 'Prior entrepreneurial experience', type: 'pills', req: true, opts: ['None', 'Founded a company before', 'Sold a company'], src: 'deck', confirm: true, pre: 'Founded a company before', hint: 'Your deck says your CEO founded a clinic software company in 2017.' },
      { id: 'employee_count', label: 'Number of employees', type: 'integer', req: true, src: 'update', confirm: true, pre: '9', hint: 'Excluding founders, interns and freelancers. Your October update lists 12 people; we took off the 3 founders.' },
      { id: 'core_team_tenure', label: 'How long has the core team worked together?', type: 'pills', req: true, opts: ['Under 1 year', '1 to 2 years', '3 to 5 years', 'Over 5 years'], ans: '1 to 2 years' },
      { id: 'core_team_industry_experience_years', label: "Core team's combined years of relevant industry experience", type: 'integer', req: true, src: 'deck', confirm: true, pre: '22', hint: 'Added up from the bios in your deck. Your CTO has no bio, so this may be low.' },
      { id: 'core_team_managerial_background', label: 'Managerial background of the core team', type: S5, req: true, anch: ['None', 'Top-tier management'], ans: 3 },
      { id: 'core_technical_skills_in_house', label: 'Are core technical skills in-house?', type: S5, req: true, anch: ['None', 'Fully in-house'], ans: 4 }
    ] },
    { id: 'business', title: 'Business model and stage', short: 'Business model', mins: 2, usedFor: 'Feeds the scorecard and checklist. Breakeven also adjusts beta.', fields: [
      { id: 'is_scalable', label: 'Is the business scalable?', type: 'bool', req: true, ans: 'Yes' },
      { id: 'business_model', label: 'Business model', type: 'pills', req: true, opts: ['B2B', 'B2C'], src: 'listing', pre: 'B2B', hint: 'From your listing: you sell to clinics.' },
      { id: 'sustainably_breakeven', label: 'Is the business sustainably breakeven?', type: 'bool', req: true, src: 'update', confirm: true, pre: 'No', hint: 'Your October update shows $96,000 monthly burn.' },
      { id: 'board_of_advisors', label: 'Board of advisors', type: 'pills', req: true, opts: ['Yes, formal board', 'Informal advisors', 'No'], src: 'deck', confirm: true, pre: 'Informal advisors', hint: 'Your deck names Dr Lena Hart as clinical advisor.' },
      { id: 'advisor_count', label: 'Number of advisors', type: 'integer', req: true, src: 'deck', confirm: true, pre: '1', when: ['board_of_advisors', ['Yes, formal board', 'Informal advisors']] },
      { id: 'shareholder_types', label: 'Current shareholder types', type: 'multi', req: true, opts: ['Friends and Family', 'Crowdfunding', 'Incubator or Accelerator', 'Business Angel', 'Venture Capital'], src: 'deck', confirm: true, pre: ['Business Angel'], hint: 'Your deck mentions a pre-seed round from angels.' },
      { id: 'exit_strategy_readiness', label: 'Exit strategy readiness', type: S5, req: true, anch: ['No thought given', 'Acquirers already committed'], ans: 2 }
    ] },
    { id: 'product', title: 'Product and market', short: 'Product and market', mins: 5, usedFor: 'Feeds the product, opportunity, competition and strategic relationships criteria in the scorecard and checklist.', fields: [
      { id: 'product_rollout_stage', label: 'Product or service roll-out stage', type: 'pills', req: true, opts: ['Planning', 'Prototype', 'MVP', 'Market'], src: 'listing', confirm: true, pre: 'MVP', hint: 'Your listing traction says two paying pilot clinics.' },
      { id: 'demand_tested', label: 'Has demand been tested?', type: 'pills', req: true, opts: ['Not yet', 'Validated by competitors', 'Extensively validated'], ans: 'Validated by competitors' },
      { id: 'tam', label: 'Total addressable market', type: 'currency', req: true, src: 'deck', confirm: true, pre: '12,400,000,000', hint: 'Slide 6 of your deck. Use the same figure investors will see.' },
      { id: 'market_annual_growth_rate', label: 'Annual growth rate of the market', type: 'percent', req: true, src: 'deck', confirm: true, pre: '14' },
      { id: 'barriers_to_entry', label: 'Barriers to entry', type: S5, req: true, anch: ['Very low', 'Very high'], ans: 3 },
      { id: 'competition_level', label: 'Level of competition', type: S5, req: true, anch: ['Dominated by one player', 'Blue ocean'], ans: 3 },
      { id: 'competitor_product_quality', label: 'Quality of existing competitive products', type: 'pills', req: true, opts: ['Excellent', 'Good', 'Weak'], ans: 'Good' },
      { id: 'differentiation_vs_competitors', label: 'Differentiation versus competitors', type: S5, req: true, anch: ['Comparable solution', 'Non-comparable solution'], ans: 4 },
      { id: 'international_competition_status', label: 'International competition', type: 'pills', req: true, opts: ['Established abroad', 'Growing', 'Not yet developed'], ans: 'Growing' },
      { id: 'international_expansion_plans', label: 'International expansion plans', type: S5, req: true, anch: ['Locally focused', 'Global focus already'], ans: 2 },
      { id: 'customer_feedback_received', label: 'Customer feedback from early adopters or industry experts', type: 'pills', req: true, opts: ['None yet', 'Mixed', 'Mainly positive', 'Overwhelmingly positive'], ans: 'Mainly positive' },
      { id: 'customer_loyalty_retention', label: 'Degree of customer loyalty and retention', type: S5, req: true, anch: ['Low retention', 'Excellent retention'], ans: 4 },
      { id: 'ip_protection_types', label: 'Type of IP protection that applies', type: 'multi', req: true, opts: ['Patent', 'Trademark', 'Copyright', 'Domain names', 'Trade secret', 'None applicable'], ans: ['Trademark', 'Domain names'] },
      { id: 'ip_protection_status', label: 'IP protection status', type: 'pills', req: true, opts: ['None', 'In progress', 'Secured regionally', 'Secured internationally'], ans: 'In progress' },
      { id: 'strategic_partner_relationship_strength', label: 'Strength of relationships with key strategic partners', type: S5, req: true, anch: ['None', 'Contracts signed'], ans: 3 }
    ] },
    { id: 'financials', title: 'Financial projections', short: 'Financials', mins: 6, grid: true, usedFor: 'Revenue, costs and cash flows drive both DCF methods and the VC method. Blank optional rows use industry averages for Healthcare Information and Technology.',
      cols: ['2025 actual', '2026', '2027', '2028', '2029', '2030'],
      colSrc: [['traction', false, '3 of 12 months verified'], ['dataroom', true], ['dataroom', true], ['dataroom', true], ['dataroom', true], ['dataroom', true]],
      rows: [
        { id: 'revenue', label: 'Revenue', req: true, pre: ['310,000', '620,000', '1,600,000', '3,900,000', '8,600,000', '18,400,000'] },
        { id: 'debt_outstanding_year_end', label: 'Debt outstanding, year end', req: true, note: 'Enter 0 if none', ans: ['0', '0', '0', '0', '0', '0'] },
        { id: 'fundraising_this_year', label: 'Equity fundraising in the year', req: true, note: 'Enter 0 if none', pre: [null, '3,000,000', null, null, null, null], preSrc: [null, 'listing'], ans: ['0', '3,000,000', '0', '8,000,000', '0', '0'] },
        { id: 'cogs', label: 'Cost of goods sold' }, { id: 'salaries', label: 'Salaries' }, { id: 'other_opex', label: 'Other operating expenses' },
        { id: 'depreciation_amortization', label: 'Depreciation and amortisation' }, { id: 'capex', label: 'Capital expenditure' },
        { id: 'receivables', label: 'Receivables' }, { id: 'inventory', label: 'Inventory' }, { id: 'payables', label: 'Payables' },
        { id: 'interest', label: 'Interest', def: 'From debt' }, { id: 'taxes', label: 'Taxes', def: 'US tax rate' }
      ] },
    { id: 'balance', title: 'Base-year balance sheet', short: 'Balance sheet', mins: 2, usedFor: 'Only non-operating cash changes the valuation. The rest appears in the report appendix.', fields: [
      { id: 'cash_and_equivalents', label: 'Cash and cash equivalents', type: 'currency', req: true, ans: '410,000', hint: 'At 31 December 2025. Your October update says $1,240,000, but that is after the base year.' },
      { id: 'non_operating_cash', label: 'Non-operating cash', type: 'currency', req: true, ans: '0', hint: 'Cash the business does not need to run, such as an investment account. Most seed companies enter 0.' },
      { id: 'tangible_assets', label: 'Tangible assets', type: 'currency', req: false }, { id: 'intangible_assets', label: 'Intangible assets', type: 'currency', req: false },
      { id: 'financial_assets', label: 'Financial assets', type: 'currency', req: false }, { id: 'deferred_tax_assets', label: 'Deferred tax assets', type: 'currency', req: false },
      { id: 'short_term_liabilities', label: 'Short-term liabilities', type: 'currency', req: false }, { id: 'long_term_liabilities', label: 'Long-term liabilities', type: 'currency', req: false },
      { id: 'equity', label: 'Equity', type: 'currency', req: false }
    ] },
    { id: 'funding', title: 'Funding and cap table', short: 'Funding', mins: 3, usedFor: 'Context and benchmarking for your report. None of these enter the six formulas.', fields: [
      { id: 'capital_needed_current_round', label: 'Capital needed in the current round', type: 'currency', req: true, src: 'listing', locked: true, pre: '3,000,000' },
      { id: 'funding_round_history', label: 'Funding round history', type: 'repeat', req: false, cols: ['Round', 'Closed', 'Valuation or cap', 'Invested', 'Equity sold'], src: 'deck', confirm: true, pre: [['Pre-seed', 'March 2024', '$4,000,000 cap', '$750,000', '']], add: 'Add a round' },
      { id: 'current_ownership', label: 'Current ownership', type: 'repeat', req: true, cols: ['Shareholder category', 'Ownership %'], ans: [['Founders', '82'], ['Angels', '12'], ['ESOP', '6']], add: 'Add a shareholder group', hint: 'Must total 100%.' },
      { id: 'use_of_funds', label: 'Use of funds', type: 'group', req: false, cols: ['Product and R&D', 'Sales and marketing', 'Inventory', 'Operations', 'Capex'], src: 'deck', confirm: true, pre: ['1,200,000', '1,100,000', '0', '700,000', '0'] }
    ] }
  ];
  const DONE_PARTIAL = ['company', 'team'];
  function has(v) { return Array.isArray(v) ? v.some(x => Array.isArray(x) ? x.some(Boolean) : x != null && x !== '') : v != null && v !== ''; }
  // mode: 'new' (prefill only, nothing confirmed) | 'partial' (company + team done) | 'complete'
  function fieldState(step, f, mode, over) {
    const o = (over && over[f.id]) || {};
    const answered = mode === 'complete' || (mode === 'partial' && DONE_PARTIAL.includes(step.id));
    const value = o.value !== undefined ? o.value : f.pre !== undefined ? f.pre : answered ? f.ans : undefined;
    const confirmed = o.confirmed || (answered && !!f.confirm);
    const filled = has(value);
    const needsConfirm = filled && !!f.src && !!f.confirm && !confirmed && o.value === undefined;
    return { value, filled, needsConfirm, prefilled: !!f.src && f.pre !== undefined && o.value === undefined, done: filled && !needsConfirm };
  }
  function visible(f, vals) { if (!f.when) return true; const v = vals[f.when[0]]; return f.when[1].includes(v); }
  function summarize(mode, over) {
    const out = steps.map(s => {
      let req = 0, done = 0, pre = 0, conf = 0;
      if (s.grid) {
        s.rows.filter(r => r.req).forEach(r => s.cols.forEach((c, i) => {
          req++;
          const answered = mode === 'complete';
          const p = r.pre && r.pre[i]; const confNeeded = p && s.colSrc[i][1] && !(r.preSrc && r.preSrc[i]);
          const conf_ok = answered || (over && over['col' + i]);
          if (p) { pre++; if (confNeeded && !conf_ok) conf++; else done++; }
          else if (answered && r.ans && r.ans[i] != null) done++;
        }));
      } else {
        const vals = {};
        s.fields.forEach(f => { vals[f.id] = fieldState(s, f, mode, over).value; });
        s.fields.filter(f => visible(f, vals)).forEach(f => {
          const st = fieldState(s, f, mode, over);
          if (st.prefilled) pre++;
          if (st.needsConfirm) conf++;
          if (f.req) { req++; if (st.done) done++; }
        });
      }
      return { id: s.id, title: s.title, short: s.short, mins: s.mins, req, done, pre, conf };
    });
    const t = out.reduce((a, s) => ({ req: a.req + s.req, done: a.done + s.done, pre: a.pre + s.pre, conf: a.conf + s.conf }), { req: 0, done: 0, pre: 0, conf: 0 });
    const minsLeft = out.reduce((a, s) => a + (s.req ? Math.ceil(s.mins * (1 - s.done / s.req)) : 0), 0);
    const bySource = {};
    steps.forEach(s => {
      if (s.grid) { s.rows.forEach(r => (r.pre || []).forEach((p, i) => { if (p) { const k = (r.preSrc && r.preSrc[i]) || s.colSrc[i][0]; bySource[k] = (bySource[k] || 0) + 1; } })); }
      else s.fields.forEach(f => { if (f.src && f.pre !== undefined) bySource[f.src] = (bySource[f.src] || 0) + 1; });
    });
    return { steps: out, total: t, minsLeft, bySource };
  }
  window.VI = { SOURCES, steps, summarize, fieldState, visible, has };
  window.dispatchEvent(new Event('vi-ready'));
})();
