/**
 * How often somebody is willing to do a role, in units people actually use —
 * and, at the end of the file, which weeks they want to do it.
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

/**
 * The unit a blank row starts on.
 *
 * Months, not weeks, because that is how people talk about a rota job — "twice
 * a month", "once a quarter" — and weeks being merely the first option in the
 * list meant somebody typing "2" without looking got a fortnight, not two
 * months. Only blank rows use it: a saved value always comes back in its own
 * unit, through toUnits().
 */
export const DEFAULT_UNIT: Unit = 'months';

/** The unit a select should show for a stored number of days, blank or not. */
export function unitFor(days: number | null | undefined): Unit {
  return toUnits(days ?? null)?.unit ?? DEFAULT_UNIT;
}

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
  const raw = String(form.get(unitKey) ?? DEFAULT_UNIT);
  const unit = (['weeks', 'months', 'quarters'] as Unit[]).includes(raw as Unit)
    ? (raw as Unit)
    : DEFAULT_UNIT;
  return toDays(n, unit);
}

/** A readable description, e.g. "2 times every month". There is one figure:
 *  the form used to ask "at most" and "not more often than" separately, and
 *  people answered both differently (see migrations/0029). */
export function describeFrequency(maxPerPeriod: number | null, periodDays: number | null): string {
  const period = toUnits(periodDays);
  if (!maxPerPeriod || !period) return 'no strong view';
  return `${maxPerPeriod === 1 ? 'once' : `${maxPerPeriod} times`} every `
    + `${period.n === 1 ? '' : `${period.n} `}${unitWord(period.unit, period.n)}`;
}

function unitWord(unit: Unit, n: number): string {
  const singular = unit === 'weeks' ? 'week' : unit === 'months' ? 'month' : 'quarter';
  return n === 1 ? singular : `${singular}s`;
}

// ---------------------------------------------------------------------------
// When they want to do it
// ---------------------------------------------------------------------------

/** Which Sunday of the month a date is: 1 for the 1st to the 7th, and so on.
 *  Counted on the date's own weekday, so a one-off Wednesday service is the
 *  "2nd" if it is the month's second Wednesday. */
export const weekOfMonth = (iso: string): number => Math.ceil(Number(iso.slice(8, 10)) / 7);

export const WEEKS_OF_MONTH = [1, 2, 3, 4, 5] as const;
export const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th'];

/** The spacings offered. 2 is "every other week". */
export const SPACINGS: { weeks: number; label: string }[] = [
  { weeks: 2, label: 'Every other week' },
  { weeks: 3, label: 'Every third week' },
  { weeks: 4, label: 'Every fourth week' },
];

/** '1,3' -> [1, 3]. Anything unreadable, or every week ticked, is "any": null. */
export function parseWeeks(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  const weeks = [...new Set(String(raw).split(',').map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
    .sort((a, b) => a - b);
  return weeks.length && weeks.length < 5 ? weeks : null;
}

export function parseSpacing(raw: unknown): number | null {
  const n = Number(raw);
  return SPACINGS.some((s) => s.weeks === n) ? n : null;
}

/**
 * Reads the "When" choice for one role off a form.
 *
 * "Any" clears both, whatever else was left ticked underneath it — the boxes
 * are hidden rather than cleared when somebody switches back to Any, and a
 * hidden tick must not quietly keep a restriction they think they removed.
 */
export function readWhen(
  form: { get(k: string): unknown; getAll(k: string): unknown[] },
  roleId: number,
): { weeks: string | null; spacing: number | null } {
  if (form.get(`when_${roleId}`) !== 'specific') return { weeks: null, spacing: null };
  const weeks = parseWeeks(form.getAll(`weeks_${roleId}`).map(String).join(','));
  return { weeks: weeks ? weeks.join(',') : null, spacing: parseSpacing(form.get(`spacing_${roleId}`)) };
}

/** "the 2nd Sunday of the month", "every other week", or "any week". */
export function describeWhen(weeksRaw: string | null | undefined, spacing: number | null | undefined): string {
  const parts: string[] = [];
  const weeks = parseWeeks(weeksRaw);
  if (weeks) {
    const named = weeks.map((w) => ORDINAL[w]!);
    const list = named.length === 1 ? named[0]
      : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    parts.push(`only the ${list} Sunday${weeks.length === 1 ? '' : 's'} of the month`);
  }
  const s = SPACINGS.find((x) => x.weeks === spacing);
  if (s) parts.push(s.label.toLowerCase());
  return parts.length ? parts.join(', ') : 'any week';
}
