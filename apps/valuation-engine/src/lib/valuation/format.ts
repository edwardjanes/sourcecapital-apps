export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatGrowth(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  if (value > 100) return '>100x';
  if (value > 10) return `${value.toFixed(1)}x`;
  if (value > 1) return `${(value * 100).toFixed(0)}%`;
  if (value > 0) return `${(value * 100).toFixed(1)}%`;
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
