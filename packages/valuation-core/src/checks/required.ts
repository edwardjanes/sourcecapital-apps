// Which required answers are given, counted the way INTAKE_REQUIRED_COUNT and the
// design pack's summarize() count them: each required field once (hidden
// conditional fields not at all), each required grid row once per column.

import { INTAKE_STEPS, type IntakeFieldDef, type IntakeStepDef } from '../intake/fields';
import type { ValuationContext } from '../angel/context';

/** One required answer that is missing. */
export interface MissingAnswer {
  step: string;
  /** Intake field id, or grid row id for a grid cell. */
  fieldId: string;
  /** Grid column for a grid cell (0 = base year), otherwise null. */
  column: number | null;
}

export interface RequiredStatus {
  required: number;
  answered: number;
  missing: MissingAnswer[];
}

/** Blank as the design pack's has() defines it: null, '', or an array holding no non-blank cell. */
export function isBlank(v: unknown): boolean {
  if (Array.isArray(v)) return !v.some((x) => (Array.isArray(x) ? x.some((c) => !isBlank(c)) : !isBlank(x)));
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function visible(f: IntakeFieldDef, answers: Record<string, unknown>): boolean {
  if (!f.when) return true;
  const [fieldId, values] = f.when;
  return values.includes(answers[fieldId] as string);
}

export function requiredStatus(ctx: ValuationContext): RequiredStatus {
  const answers = ctx.answers as Record<string, unknown>;
  const missing: MissingAnswer[] = [];
  let required = 0;

  for (const step of INTAKE_STEPS as readonly IntakeStepDef[]) {
    if (!step.founderVisible) continue;
    for (const f of step.fields) {
      // Grid fields are counted cell by cell from the grid below.
      if (!f.required || f.type === 'grid' || !visible(f, answers)) continue;
      required += 1;
      // Balance-step answers live in ctx.balance, the rest in ctx.answers.
      const value = step.id === 'balance' ? (ctx.balance as Record<string, unknown>)[f.id] : answers[f.id];
      if (isBlank(value)) missing.push({ step: step.id, fieldId: f.id, column: null });
    }
    if (step.grid) {
      for (const row of step.grid.rows) {
        if (!row.required) continue;
        for (let col = 0; col < step.grid.columns; col++) {
          required += 1;
          const value = (ctx.financials[col] as Record<string, unknown> | undefined)?.[row.id];
          if (isBlank(value)) missing.push({ step: step.id, fieldId: row.id, column: col });
        }
      }
    }
  }

  return { required, answered: required - missing.length, missing };
}

/** Optional financials grid rows with at least one cell entered. */
export function optionalFinancialRowsEntered(ctx: ValuationContext): string[] {
  const grid = (INTAKE_STEPS as readonly IntakeStepDef[]).find((s) => s.grid)!.grid!;
  return grid.rows
    .filter((r) => !r.required)
    .filter((r) => ctx.financials.some((row) => !isBlank((row as Record<string, unknown>)[r.id])))
    .map((r) => r.id);
}
