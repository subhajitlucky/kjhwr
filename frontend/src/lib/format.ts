export function fmtInt(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function fmtMw(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return `${fmtInt(value, digits)} MW`;
}

export function fmtGw(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${fmtInt(value / 1000, digits)} GW`;
}

export function fmtMwh(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${fmtInt(value / 1_000_000, digits)} TWh`;
  }
  return `${fmtInt(value / 1000, digits)} GWh`;
}

export function fmtSignedMw(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtInt(value, digits)} MW`;
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return `${fmtInt(value, digits)}%`;
}

export function fmtNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return fmtInt(value, digits);
}

const dateLongFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateShortFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "UTC",
});

export function dateLong(iso: string): string {
  return dateLongFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function dateShort(iso: string): string {
  return dateShortFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function weekday(iso: string): string {
  return weekdayFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function isoDate(value: string): string {
  return value.slice(0, 10);
}

/** "07:00" for a UTC ISO timestamp. January 2026 is GMT. */
export function hourLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(11, 16)}`;
}

export function hourWithUnit(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(11, 16)} UTC`;
}

export function vintageLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${dateShort(iso)} · ${iso.slice(11, 16)}`;
}

export function vintageFull(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${dateShort(iso)} ${iso.slice(11, 16)} UTC`;
}

export function cutoffLabel(time: string): string {
  return `${time} UTC`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function enumerateDates(startIso: string, endExclusiveIso: string): string[] {
  const out: string[] = [];
  let cursor = startIso;
  while (cursor < endExclusiveIso) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}
