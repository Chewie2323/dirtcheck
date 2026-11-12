export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function ppa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${money(value)}/ac`;
}

export function signedPct(fraction: number): string {
  const points = fraction * 100;
  const rounded = Math.round(points * 10) / 10;
  const body = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  if (rounded > 0) return `+${body}%`;
  return `${body}%`;
}

export function acresLabel(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ac`;
}

export function formatDate(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function dealTitle(address: string, apn: string): string {
  const line = address.trim();
  if (line) return line;
  const parcel = apn.trim();
  return parcel ? `APN ${parcel}` : "Untitled parcel";
}
