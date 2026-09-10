import { SimpleMultiplesResult } from './types';

export interface ComparableCompany {
  name: string;
  metric: number;
  multiple: number;
  metricType: 'revenue' | 'ebitda';
  source?: string;
}

export function computeSimpleMultiples(
  lastYearMetric: number,
  comparables: ComparableCompany[]
): SimpleMultiplesResult {
  if (comparables.length === 0) {
    return {
      comparables: [],
      medianMultiple: 0,
      valuation: 0,
    };
  }

  const multiples = comparables.map((c) => c.multiple).sort((a, b) => a - b);

  const medianMultiple =
    multiples.length % 2 === 0
      ? (multiples[multiples.length / 2 - 1] + multiples[multiples.length / 2]) / 2
      : multiples[Math.floor(multiples.length / 2)];

  const valuation = lastYearMetric * medianMultiple;

  return {
    comparables: comparables.map((c) => ({
      name: c.name,
      metric: c.metric,
      multiple: c.multiple,
      metricType: c.metricType,
      source: c.source,
    })),
    medianMultiple,
    valuation,
  };
}
