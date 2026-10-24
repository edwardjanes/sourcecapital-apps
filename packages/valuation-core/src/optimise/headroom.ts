// Headroom: the most each Scorecard and Checklist criterion can still add.
//
//   (maximum - current) x criterion weight x method weight x method base
//
// `current`, the criterion weight, the method base and the method's effective
// weight all come from the report the engine produced. `maximum` is the score the
// existing scoring code gives that criterion for the best answer to every
// sub-trait it reads, so no scoring constant is copied here. For the Scorecard
// this ignores the 0.5-1.5 multiplier clamp, so it is an "up to" figure.

import type { QuestionnaireAnswers, ValuationReportOutput } from '../types';
import { deriveChecklistCriteriaScores, deriveScorecardCriteriaScores } from '../scoring';
import type { FactorRef } from './types';

/** The best answer to every sub-trait scoring.ts reads. Inputs, not constants: the scores come from scoring.ts. */
export const BEST_ANSWERS: QuestionnaireAnswers = {
  team_size: 1_000,
  team_has_cto: true,
  team_has_business_lead: true,
  team_prior_exits: true,
  tam_size: Number.MAX_SAFE_INTEGER,
  market_growth_rate: 10,
  recurring_revenue: true,
  has_customers: true,
  product_market_fit: true,
  competitors_count: 0,
  has_competitive_advantage: true,
  product_status: 'revenue_generating',
  ip_protection_stage: 'enforced',
  partnerships_count: 1_000,
  has_strategic_investors: true,
  capital_needed: 0,
  last_year_revenue: 1,
  sustainably_breakeven: true,
};

export interface CriterionHeadroom {
  method: FactorRef['method'];
  criterion: string;
  current: number;
  maximum: number;
  weight: number;
  methodWeight: number;
  methodBase: number;
  headroom: number;
}

export function computeHeadroom(report: ValuationReportOutput): CriterionHeadroom[] {
  const effective = (m: string) => report.perMethod.find((p) => p.method === m)?.effectiveWeight ?? 0;
  const bestScorecard = deriveScorecardCriteriaScores(BEST_ANSWERS);
  const bestChecklist = deriveChecklistCriteriaScores(BEST_ANSWERS);
  const sc = report.methodResults.scorecard;
  const ck = report.methodResults.checklist;

  const rows: CriterionHeadroom[] = [];
  for (const c of sc.criteria) {
    const maximum = bestScorecard[c.key];
    rows.push({
      method: 'scorecard', criterion: c.key, current: c.score, maximum, weight: c.weight,
      methodWeight: effective('scorecard'), methodBase: sc.averagePreMoneyValuation,
      headroom: Math.max(0, maximum - c.score) * c.weight * effective('scorecard') * sc.averagePreMoneyValuation,
    });
  }
  for (const c of ck.criteria) {
    const maximum = bestChecklist[c.key];
    rows.push({
      method: 'checklist', criterion: c.key, current: c.score, maximum, weight: c.weight,
      methodWeight: effective('checklist'), methodBase: ck.maxValuation,
      headroom: Math.max(0, maximum - c.score) * c.weight * effective('checklist') * ck.maxValuation,
    });
  }
  return rows;
}

export function headroomFor(factors: FactorRef[], headroom: CriterionHeadroom[]): number {
  return factors.reduce(
    (sum, f) => sum + (headroom.find((h) => h.method === f.method && h.criterion === f.criterion)?.headroom ?? 0),
    0
  );
}
