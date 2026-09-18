/**
 * How often somebody is willing to do a role, in units people actually use.
 *
 * Nobody says "every 90 days" — they say "once a quarter". The database keeps
 * days because the generator does date arithmetic, but the form asks in weeks,
 * months or quarters and converts on the way in and out.
 *
 * The conversions are deliberately the round numbers a person means rather than
 * calendar-exact ones: a month is 30 days and a quarter 91, because "once a
 * month" means roughly monthly, not "on the 14th precisely". Being exact here
 * would make the generator refuse somebody on the 29th day of a 30-day rule.
 */

export type Unit = 'weeks' | 'months' | 'quarters';

export const UNITS: { value: Unit; label: string; days: number }[] = [
  { value: 'weeks', label: 'week(s)', days: 7 },
  { value: 'months', label: 'month(s)', days: 30 },
  { value: 'quarters', label: 'quarter(s)', days: 91 },
];

const DAYS: Record<Unit, number> = { weeks: 7, months: 30, quarters: 91 };

export function toDays(n: number, unit: Unit): number {
  return Math.max(1, Math.round(n * (DAYS[unit] ?? 30)));
}

/**
 * Days back into the unit somebody would have chosen.
 *
 * Picks the largest unit that divides cleanly, so 91 comes back as "1 quarter"
 * rather than "13 weeks" — otherwise a saved value would reappear in a different
 * shape from the one it was entered in, which reads as the form mangling it.
 */
export function toUnits(days: number | null): { n: number; unit: Unit } | null {
  if (days == null || !Number.isFinite(days) || days <= 0) return null;
  for (const unit of ['quarters', 'months', 'weeks'] as Unit[]) {
    const size = DAYS[unit];
    if (days % size === 0) return { n: days / size, unit };
  }
  // Anything that divides by nothing — an imported oddity — is shown as the
  // nearest number of weeks rather than hidden.
  return { n: Math.max(1, Math.round(days / 7)), unit: 'weeks' };
}

/** Reads a number + unit pair off a form, or null when left blank. */
export function readUnitPair(
  form: { get(k: string): unknown },
  numberKey: string,
  unitKey: string,
): number | null {
  const n = Number(form.get(numberKey));
  if (!Number.isInteger(n) || n < 1 || n > 24) return null;
  const raw = String(form.get(unitKey) ?? 'months');
  const unit = (['weeks', 'months', 'quarters'] as Unit[]).includes(raw as Unit)
    ? (raw as Unit)
    : 'months';
  return toDays(n, unit);
}

/** A readable description, e.g. "at most 2 times every month". */
export function describeFrequency(
  maxPerPeriod: number | null,
  periodDays: number | null,
  minGapDays: number | null,
): string {
  const parts: string[] = [];
  const period = toUnits(periodDays);
  if (maxPerPeriod && period) {
    parts.push(`at most ${maxPerPeriod} time${maxPerPeriod === 1 ? '' : 's'} every ${period.n === 1 ? '' : `${period.n} `}${unitWord(period.unit, period.n)}`);
  }
  const gap = toUnits(minGapDays);
  if (gap) {
    parts.push(`no more often than once every ${gap.n === 1 ? '' : `${gap.n} `}${unitWord(gap.unit, gap.n)}`);
  }
  return parts.length ? parts.join(', and ') : 'no strong view';
}

function unitWord(unit: Unit, n: number): string {
  const singular = unit === 'weeks' ? 'week' : unit === 'months' ? 'month' : 'quarter';
  return n === 1 ? singular : `${singular}s`;
}
