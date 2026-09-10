import { ValuationParameters } from './types';

export interface ParameterDiff {
  field: string;
  isChanged: boolean;
  current: unknown;
  default: unknown;
}

export function diffParameters(
  current: ValuationParameters,
  defaults: ValuationParameters
): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];

  const keys = Array.from(new Set([
    ...Object.keys(current),
    ...Object.keys(defaults),
  ])) as (keyof ValuationParameters)[];

  for (const key of keys) {
    const currentVal = current[key];
    const defaultVal = defaults[key];

    const isChanged = !deepEqual(currentVal, defaultVal);

    diffs.push({
      field: key as string,
      isChanged,
      current: currentVal,
      default: defaultVal,
    });
  }

  return diffs.filter((d) => d.isChanged);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }

  return a === b;
}
