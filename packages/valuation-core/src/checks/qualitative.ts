// "Strong answers" for the qualitative_conflict check.
//
// The check exists to catch the failure the audits found twice (IP protection,
// sustainably_breakeven): the founder answers well and the engine does not read
// the answer, so the criterion sits near the bottom regardless.

import type { ScorecardCriterionKey } from '../types';
import type { IntakeAnswers } from '../intake/fields';
import { parseIntakeNumber as num } from '../intake/mapIntakeToEngine';

/** The 1-5 answers that describe each Scorecard criterion, and the step they are on. */
export const QUALITATIVE_CRITERIA: readonly { criterion: ScorecardCriterionKey; step: string; fields: readonly string[] }[] = [
  { criterion: 'team', step: 'team', fields: ['core_technical_skills_in_house', 'core_team_managerial_background', 'founders_time_commitment'] },
  { criterion: 'competitive_env', step: 'product', fields: ['differentiation_vs_competitors', 'barriers_to_entry'] },
  { criterion: 'partnerships', step: 'product', fields: ['strategic_partner_relationship_strength'] },
];

/** A strong answer on the 1-5 scale. */
export const STRONG_ANSWER_MIN = 4;
/** "Near the bottom": a Scorecard delta at or below this (raw sub-trait score 37.5 of 100 or less). */
export const QUALITATIVE_FLOOR_DELTA = -0.25;

/**
 * Strong answers for a criterion: every one of its 1-5 answers that is given
 * is 4 or 5, and at least half of them are given. A criterion with no 1-5
 * answers listed is never strong.
 */
export function hasStrongAnswers(criterion: ScorecardCriterionKey, answers: IntakeAnswers): boolean {
  const def = QUALITATIVE_CRITERIA.find((c) => c.criterion === criterion);
  if (!def) return false;
  const given = def.fields
    .map((f) => num((answers as Record<string, unknown>)[f]))
    .filter((n): n is number => n !== undefined);
  return given.length > 0 && given.length * 2 >= def.fields.length && given.every((n) => n >= STRONG_ANSWER_MIN);
}
