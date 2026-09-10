import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeValuation } from '@/lib/valuation/compute';
import { buildDefaultParameters } from '@/lib/valuation/defaults';
import { validateWizardData, hasBlockingIssues } from '@/lib/valuation/validation';
import { renderAndUploadReportPdf } from '@/lib/valuation/pdf';
import { getCurrencyForCountry } from '@/lib/valuation/referenceData';
import type { CompanyStage } from '@/lib/valuation/types';

// Headless, service-key-protected compute + report route for n8n.
//
// This is deliberately NOT under /companies/ (middleware.ts's matcher only
// covers /dashboard, /companies, /login) and does not touch Supabase cookie
// auth at all -- an n8n HTTP Request node has no browser session to send.
// Auth here is a single shared-secret header instead, checked against
// VALUATION_SERVICE_KEY. This mirrors the "new pattern, not reuse of an
// existing one" note in claude/track-11-headless-route-scope.md -- there
// was no locationId-keyed or service-key-protected route anywhere in this
// monorepo before this file.
//
// PDF rendering: headless Chromium renders the print-only report page
// (see /print/valuation/[snapshotId]) and uploads the result to Supabase
// Storage -- see lib/valuation/pdf.ts and scope doc section 4 for why.

export const maxDuration = 90;

interface ComputeRequestBody {
  locationId?: string;
  company?: {
    name?: string;
    country?: string;
    industry?: string;
    stage?: CompanyStage;
    description?: string;
    founders_count?: number;
    employees_count?: number;
    business_model?: string;
    business_activity?: string;
    started_year?: number;
    incorporated_year?: number;
    founders_committed_capital?: number;
  };
  financials?: Array<Record<string, unknown> & { yearOffset: number }>;
  questionnaire?: Record<string, unknown> | null;
  balanceSheet?: {
    non_operating_cash?: number;
    cash_and_equivalents?: number;
  } | null;
  comparables?: Array<{
    companyName?: string;
    multiple?: number;
    metricType?: 'revenue' | 'ebitda';
  }> | null;
  weights?: Record<string, number>;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.VALUATION_SERVICE_KEY;
  if (!serviceKey) {
    // Fail closed: an unset env var must never silently disable auth.
    console.error('VALUATION_SERVICE_KEY is not set -- refusing all requests to /api/valuation/compute');
    return unauthorized();
  }
  const providedKey = request.headers.get('x-service-key');
  if (!providedKey || providedKey !== serviceKey) {
    return unauthorized();
  }

  let body: ComputeRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { locationId, company, financials, questionnaire, balanceSheet, comparables, weights } = body;

  if (!locationId || !locationId.trim()) {
    return NextResponse.json(
      { error: 'locationId is required' },
      { status: 400 }
    );
  }
  if (!company) {
    return NextResponse.json(
      { error: 'company is required' },
      { status: 400 }
    );
  }

  // Same defense-in-depth validation the authenticated wizard route runs --
  // a malformed n8n payload should come back as a 400 with field detail,
  // not a 500 from somewhere deep inside computeValuation().
  const preValidationIssues = validateWizardData({
    profile: company,
    financials: financials || [],
    balanceSheet: balanceSheet || {},
    questionnaireAnswers: (questionnaire as Record<string, unknown>) || {},
  });
  if (hasBlockingIssues(preValidationIssues)) {
    return NextResponse.json(
      {
        error: 'Invalid valuation inputs',
        issues: preValidationIssues.filter((i) => i.severity === 'error'),
      },
      { status: 400 }
    );
  }

  // Currency is resolved server-side from company.country and never accepted
  // from the request body -- there is no client-supplied currency field to
  // trust or validate. See claude/track-11-currency-localization-scope.md.
  const currency = getCurrencyForCountry(company.country);

  try {
    // Upsert the canonical company row for this location -- create on the
    // first run for a locationId, update on every subsequent one. Mirrors
    // the D9 "one canonical profile per client" pattern, keyed by
    // locationId instead of a GHL custom field.
    const { data: existingCompany, error: findError } = await supabaseAdmin
      .from('valuation_companies')
      .select('id')
      .eq('location_id', locationId)
      .maybeSingle();

    if (findError) {
      console.error('Company lookup error:', findError);
      return NextResponse.json({ error: 'Failed to resolve company' }, { status: 500 });
    }

    const companyRow = {
      location_id: locationId,
      name: company.name,
      country: company.country,
      industry: company.industry,
      stage: company.stage,
      description: company.description,
      founders_count: company.founders_count,
      employees_count: company.employees_count,
      business_model: company.business_model,
      business_activity: company.business_activity,
      started_year: company.started_year,
      incorporated_year: company.incorporated_year,
      founders_committed_capital: company.founders_committed_capital,
      report_status: 'generated',
      currency,
    };

    let companyId: string;
    if (existingCompany) {
      companyId = existingCompany.id;
      const { error: updateError } = await supabaseAdmin
        .from('valuation_companies')
        .update(companyRow)
        .eq('id', companyId);
      if (updateError) {
        console.error('Company update error:', updateError);
        return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
      }
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('valuation_companies')
        .insert([companyRow])
        .select('id')
        .single();
      if (insertError || !inserted) {
        console.error('Company insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
      }
      companyId = inserted.id;
    }

    // Normalize comparables to the shape buildDefaultParameters/computeValuation expect
    // (same normalization the wizard's snapshot route does for wizard-shaped input).
    const comparablesNormalized = (comparables || []).map((c) => ({
      name: c.companyName || '',
      metric: c.multiple || 0,
      multiple: c.multiple || 0,
      metricType: c.metricType || 'revenue',
    }));

    const defaultParams = buildDefaultParameters(
      {
        name: company.name!,
        country: company.country!,
        industry: company.industry!,
        stage: company.stage!,
      },
      (financials || []) as never,
      balanceSheet || undefined
    );

    const paramsWithWeights = {
      ...defaultParams,
      method_weights: (weights as typeof defaultParams.method_weights) || defaultParams.method_weights,
      comparables: comparablesNormalized,
    };

    const lastActualYear = (financials || []).find((f) => f.yearOffset === -1) as
      | { revenue?: number }
      | undefined;
    const enrichedQuestionnaire = questionnaire
      ? {
          ...questionnaire,
          capital_needed: (questionnaire as Record<string, unknown>).capital_needed,
          last_year_revenue:
            (questionnaire as Record<string, unknown>).last_year_revenue ?? lastActualYear?.revenue,
        }
      : null;

    const reportRaw = await computeValuation(
      {
        name: company.name!,
        country: company.country!,
        industry: company.industry!,
        stage: company.stage!,
      },
      (financials || []) as never,
      enrichedQuestionnaire as never,
      paramsWithWeights
    );

    // computeValuation() itself stays currency-agnostic (see referenceData.ts's
    // CURRENCY_BY_COUNTRY comment) -- the label is attached here, once, to the
    // report object that gets persisted and returned.
    const report = { ...reportRaw, currency };

    // created_by is nullable as of 006_valuation_snapshots_created_by_nullable.sql --
    // there's no auth.users row for an n8n-triggered run, so it's left unset (null)
    // rather than pointed at a placeholder service account.
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('valuation_snapshots')
      .insert([
        {
          company_id: companyId,
          label: 'n8n headless run',
          inputs: {
            company,
            financials,
            questionnaire: enrichedQuestionnaire,
            parameters: paramsWithWeights,
            comparables: comparablesNormalized,
            balanceSheet,
          },
          outputs: report,
          is_current: true,
        },
      ])
      .select()
      .single();

    if (snapshotError) {
      console.error('Snapshot insert error:', snapshotError);
      return NextResponse.json({ error: snapshotError.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('valuation_snapshots')
      .update({ is_current: false })
      .eq('company_id', companyId)
      .neq('id', snapshot.id);

    // Best-effort: a render failure here does not fail the request -- the
    // valuation numbers below are correct and complete regardless.
    const reportUrl = await renderAndUploadReportPdf(snapshot.id, request.nextUrl.origin);

    return NextResponse.json({
      companyId,
      snapshotId: snapshot.id,
      weightedValuation: report.weightedValuation,
      lowBound: report.lowBound,
      highBound: report.highBound,
      currency,
      reportUrl,
    });
  } catch (error) {
    console.error('Headless valuation compute error:', error);
    return NextResponse.json({ error: 'Failed to compute valuation' }, { status: 500 });
  }
}
