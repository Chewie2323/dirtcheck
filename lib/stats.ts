export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    throw new Error("quantile requires at least one value");
  }
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  const weight = index - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
}

export function iqrFences(
  values: number[],
  multiplier: number,
): { low: number; high: number; q1: number; q3: number } | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) return null;
  return {
    q1,
    q3,
    low: q1 - multiplier * iqr,
    high: q3 + multiplier * iqr,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundDollar(value: number): number {
  return Math.round(value);
}

export function monthsBetween(saleDate: string, asOf: Date): number {
  const sold = new Date(`${saleDate}T00:00:00Z`);
  const ms = asOf.getTime() - sold.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

export function monthsAgo(asOf: Date, months: number): string {
  const date = new Date(asOf.getTime());
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export function normKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normCounty(value: string): string {
  return value.toLowerCase().replace(/county/g, "").replace(/[^a-z]/g, "");
}
