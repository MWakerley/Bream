/**
 * Working out the dates a repeating room booking falls on.
 *
 * Deliberately far smaller than the iCalendar expander in `seed/import-ical.cjs`.
 * That one has to cope with whatever Google Calendar emits; this one only has to
 * cope with the four choices a person can pick from a dropdown, so it can be
 * simple enough to read in one sitting and test exhaustively.
 *
 * Everything is an ISO date string. The church is in one timezone and these are
 * wall-clock days, so converting to a Date only creates chances for a booking to
 * slide onto the day before.
 */

export type Frequency = 'weekly' | 'fortnightly' | 'monthly-date' | 'monthly-weekday';

export const FREQUENCIES: { value: Frequency; label: string; note: string }[] = [
  { value: 'weekly', label: 'Every week', note: 'Same day each week' },
  { value: 'fortnightly', label: 'Every two weeks', note: 'Same day, every other week' },
  { value: 'monthly-date', label: 'Monthly, same date', note: 'e.g. the 15th of each month' },
  { value: 'monthly-weekday', label: 'Monthly, same weekday', note: 'e.g. the 2nd Tuesday' },
];

/** Never create more than this in one go, whatever the dates say. */
export const MAX_OCCURRENCES = 260; // five years of weekly

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => toISO(new Date(toDate(iso).getTime() + n * 86_400_000));

/** Which occurrence of its weekday a date is: the 2nd Tuesday returns 2. */
function weekdayOrdinal(iso: string): number {
  return Math.floor((toDate(iso).getUTCDate() - 1) / 7) + 1;
}

export interface ExpandResult {
  dates: string[];
  /** Set when the run was cut short, so the caller can say so rather than
   *  silently producing fewer bookings than asked for. */
  truncated: boolean;
  /** Dates the pattern skipped, with why — e.g. a 31st in a 30-day month. */
  skipped: { date: string; why: string }[];
}

/**
 * Every date the pattern falls on, from `from` to `until` inclusive.
 *
 * `from` is always the first occurrence: somebody picking "every week from the
 * 3rd" means the 3rd is the first one, not the week after.
 */
export function expandSeries(
  from: string,
  until: string,
  freq: Frequency,
  interval = 1,
): ExpandResult {
  const dates: string[] = [];
  const skipped: { date: string; why: string }[] = [];
  let truncated = false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || until < from) {
    return { dates: [], truncated: false, skipped: [] };
  }

  if (freq === 'weekly' || freq === 'fortnightly') {
    const step = (freq === 'fortnightly' ? 2 : 1) * 7 * Math.max(1, interval);
    for (let d = from; d <= until; d = addDays(d, step)) {
      if (dates.length >= MAX_OCCURRENCES) { truncated = true; break; }
      dates.push(d);
    }
    return { dates, truncated, skipped };
  }

  const start = toDate(from);
  const dayOfMonth = start.getUTCDate();
  const weekday = start.getUTCDay();
  const ordinal = weekdayOrdinal(from);

  for (let m = 0; m < 400; m++) {
    if (dates.length >= MAX_OCCURRENCES) { truncated = true; break; }
    const year = start.getUTCFullYear();
    const monthIndex = start.getUTCMonth() + m * Math.max(1, interval);

    let d: string | null = null;
    if (freq === 'monthly-date') {
      const candidate = new Date(Date.UTC(year, monthIndex, dayOfMonth));
      // A booking on the 31st simply has no February. Skipping it and SAYING SO
      // is better than silently sliding it to the 1st of March, which is a
      // different room on a different day.
      if (candidate.getUTCDate() === dayOfMonth) d = toISO(candidate);
      else {
        const label = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 7);
        skipped.push({ date: `${label}-${String(dayOfMonth).padStart(2, '0')}`, why: `there is no ${dayOfMonth}${ordinalSuffix(dayOfMonth)} that month` });
      }
    } else {
      const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
      const shift = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
      const candidate = new Date(Date.UTC(year, monthIndex, 1 + shift + (ordinal - 1) * 7));
      // The 5th Tuesday does not happen every month.
      if (candidate.getUTCMonth() === ((monthIndex % 12) + 12) % 12) d = toISO(candidate);
      else {
        const label = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 7);
        skipped.push({ date: `${label}`, why: `there is no ${ordinal}${ordinalSuffix(ordinal)} of that weekday` });
      }
    }

    if (!d) continue;
    if (d > until) break;
    if (d >= from) dates.push(d);
  }

  return { dates, truncated, skipped };
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/** A sentence describing the pattern, for the confirmation and the diary. */
export function describeSeries(from: string, freq: Frequency, until: string): string {
  const d = toDate(from);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  const nth = `${weekdayOrdinal(from)}${ordinalSuffix(weekdayOrdinal(from))}`;
  const endsOn = ` until ${until}`;
  switch (freq) {
    case 'weekly': return `Every ${weekday}${endsOn}`;
    case 'fortnightly': return `Every other ${weekday}${endsOn}`;
    case 'monthly-date':
      return `The ${d.getUTCDate()}${ordinalSuffix(d.getUTCDate())} of each month${endsOn}`;
    case 'monthly-weekday': return `The ${nth} ${weekday} of each month${endsOn}`;
    default: return `Repeating${endsOn}`;
  }
}
