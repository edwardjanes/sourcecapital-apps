import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { computeValuation } from '@/lib/valuation/compute';
import { buildDefaultParameters } from '@/lib/valuation/defaults';
import { validateWizardData, hasBlockingIssues } from '@/lib/valuation/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently fail
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { weights, company: bodyCompany, financials: bodyFinancials, questionnaire: bodyQuestionnaire, captable: bodyCaptable, comparables: bodyComparables, balanceSheet: bodyBalanceSheet } = await request.json();

    // Use provided data or fetch from DB
    const company = bodyCompany || (await supabase
      .from('valuation_companies')
      .select('*')
      .eq('id', params.id)
      .eq('owner_id', user.id)
      .single()).data;

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Use provided financials or fetch from DB
    const financials = bodyFinancials || (await supabase
      .from('valuation_financials')
      .select('*')
      .eq('company_id', params.id)
      .order('year_offset')).data;

    // Use provided questionnaire or fetch from DB
    const questionnaire = bodyQuestionnaire || (await supabase
      .from('valuation_questionnaire_responses')
      .select('answers')
      .eq('company_id', params.id)
      .single()).data;

    // Defense-in-depth server-side validation: the wizard UI already blocks Next/Generate Report on
    // these same rules (see validateWizardData in validation.ts, the single shared source of truth),
    // but this route is reachable directly (any authenticated request, not just the wizard), so a
    // crafted request bypassing the UI must not be able to persist a snapshot on nonsensical inputs
    // (missing company name/country/industry, negative financials, an unmistakable growth-rate typo).
    // Only validates fields actually present in this request/fetch -- doesn't invent requirements for
    // a partial regenerate that intentionally omits a section.
    const preValidationIssues = validateWizardData({
      profile: company,
      financials: financials || [],
      balanceSheet: bodyBalanceSheet || {},
      questionnaireAnswers: (bodyQuestionnaire || questionnaire)?.answers || {},
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

    // Normalize cap table: wizard shape { name, sharePercent } → DB shape { shareholder_name, share_percent }
    let capTableNormalized: any[] = [];
    if (bodyCaptable?.shareholders && bodyCaptable.shareholders.length > 0) {
      capTableNormalized = bodyCaptable.shareholders.map((s: any, i: number) => ({
        shareholder_name: s.name,
        share_percent: s.sharePercent / 100,
        order_index: i,
      }));
      // Persist normalized cap table
      await supabase.from('valuation_cap_table').delete().eq('company_id', params.id);
      const capTableRows = capTableNormalized.map((row: any) => ({
        company_id: params.id,
        ...row,
      }));
      await supabase.from('valuation_cap_table').insert(capTableRows);
    } else {
      // Fetch from DB (already in DB column shape)
      capTableNormalized = (await supabase
        .from('valuation_cap_table')
        .select('*')
        .eq('company_id', params.id)
        .order('order_index')).data || [];
    }
    const capTable = capTableNormalized;

    // Fetch funding rounds
    const fundingRounds = (await supabase
      .from('valuation_funding_rounds')
      .select('*')
      .eq('company_id', params.id)
      .order('closed_date')).data;

    // Normalize comparables: wizard shape { companyName, metricType } → DB shape { company_name, metric_type }
    let comparablesNormalized: any[] = [];
    if (bodyComparables?.companies && bodyComparables.companies.length > 0) {
      comparablesNormalized = bodyComparables.companies.map((c: any) => ({
        company_name: c.companyName,
        multiple: c.multiple,
        metric_type: c.metricType || 'revenue',
        source: c.source || 'wizard',
      }));
      // Persist normalized comparables
      await supabase.from('valuation_comparables').delete().eq('company_id', params.id);
      const comparableRows = comparablesNormalized.map((row: any) => ({
        company_id: params.id,
        ...row,
        date_observed: new Date().toISOString().split('T')[0],
        gathered_by: user.id,
      }));
      await supabase.from('valuation_comparables').insert(comparableRows);
    } else {
      // Fetch from DB (already in DB column shape)
      comparablesNormalized = (await supabase
        .from('valuation_comparables')
        .select('*')
        .eq('company_id', params.id)).data || [];
    }
    const comparables = comparablesNormalized;

    // Fetch transaction data
    const transaction = (await supabase
      .from('valuation_transaction')
      .select('*')
      .eq('company_id', params.id)
      .single()).data;

    // Fetch balance sheet
    let balanceSheet = (await supabase
      .from('valuation_balance_sheet')
      .select('*')
      .eq('company_id', params.id)
      .single()).data;

    // Upsert balance sheet if provided in body
    if (bodyBalanceSheet) {
      const { data: upserted, error: balanceSheetUpsertError } = await supabase
        .from('valuation_balance_sheet')
        .upsert({
          company_id: params.id,
          non_operating_cash: bodyBalanceSheet.non_operating_cash ?? 0,
          cash_and_equivalents: bodyBalanceSheet.cash_and_equivalents ?? 0,
        }, { onConflict: 'company_id' })
        .select()
        .single();
      if (balanceSheetUpsertError) {
        console.error('Balance sheet upsert error:', balanceSheetUpsertError);
      }
      balanceSheet = upserted || balanceSheet;
    }

    // Update canonical company record if body provided new profile data
    if (bodyCompany) {
      const { error: companyUpdateError } = await supabase
        .from('valuation_companies')
        .update({
          name: bodyCompany.name,
          country: bodyCompany.country,
          industry: bodyCompany.industry,
          stage: bodyCompany.stage,
          founders_count: bodyCompany.founders_count,
          employees_count: bodyCompany.employees_count,
          business_model: bodyCompany.business_model,
          business_activity: bodyCompany.business_activity,
          description: bodyCompany.description,
          started_year: bodyCompany.started_year,
          incorporated_year: bodyCompany.incorporated_year,
          founders_committed_capital: bodyCompany.founders_committed_capital,
        })
        .eq('id', params.id)
        .eq('owner_id', user.id);
      if (companyUpdateError) {
        console.error('Company profile update error:', companyUpdateError);
      }
    }

    // Build parameters with weights override
    const defaultParams = buildDefaultParameters(
      {
        name: company.name,
        country: company.country,
        industry: company.industry,
        stage: company.stage,
      },
      financials || [],
      balanceSheet
    );

    const params_with_weights = {
      ...defaultParams,
      method_weights: weights || defaultParams.method_weights,
      comparables: comparables.map((c: any) => ({
        name: c.company_name,
        metric: c.multiple,
        multiple: c.multiple,
        metricType: c.metric_type || 'revenue',
      })),
    };

    // Merge missing fields into questionnaire: capital_needed from transaction, last_year_revenue from financials
    const lastActualYear = (financials || []).find((f: any) => f.yearOffset === -1);
    const enrichedQuestionnaire = questionnaire?.answers ? {
      ...questionnaire.answers,
      capital_needed: questionnaire.answers.capital_needed ?? transaction?.capital_needed,
      last_year_revenue: questionnaire.answers.last_year_revenue ?? lastActualYear?.revenue,
    } : null;

    // Compute valuation
    const report = await computeValuation(
      {
        name: company.name,
        country: company.country,
        industry: company.industry,
        stage: company.stage,
      },
      financials || [],
      enrichedQuestionnaire,
      params_with_weights
    );

    // Create snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('valuation_snapshots')
      .insert([
        {
          company_id: params.id,
          created_by: user.id,
          inputs: {
            company,
            financials,
            questionnaire: enrichedQuestionnaire,
            parameters: params_with_weights,
            capTable,
            fundingRounds,
            comparables,
            transaction,
            balanceSheet,
          },
          outputs: report,
          is_current: true,
        },
      ])
      .select()
      .single();

    if (snapshotError) {
      return NextResponse.json({ error: snapshotError.message }, { status: 500 });
    }

    // Mark previous snapshots as not current
    await supabase
      .from('valuation_snapshots')
      .update({ is_current: false })
      .eq('company_id', params.id)
      .neq('id', snapshot.id);

    return NextResponse.json({
      snapshot,
      redirect: `/companies/${params.id}/report/${snapshot.id}`,
    });
  } catch (error) {
    console.error('Snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to generate valuation' },
      { status: 500 }
    );
  }
}
