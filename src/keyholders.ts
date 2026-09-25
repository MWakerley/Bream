/**
 * The keys a keyholder can hold.
 *
 * A fixed list, because the buildings are: the church, the Church Centre and
 * the office. "Not known" is its own answer rather than an empty one, and it
 * cannot sit alongside a real key — somebody either has the Church key or we
 * do not know what they have, not both.
 */
export const KEYS = [
  { key: 'church', label: 'Church' },
  { key: 'centre', label: 'Church Centre' },
  { key: 'office', label: 'Church Office' },
  { key: 'unknown', label: 'Not known' },
] as const;

export type KeyName = (typeof KEYS)[number]['key'];

const VALID = new Set<string>(KEYS.map((k) => k.key));

/** The stored JSON, read defensively: anything unrecognised is dropped. */
export function parseKeys(stored: string | null | undefined): KeyName[] {
  if (!stored) return [];
  try {
    const v = JSON.parse(stored);
    return Array.isArray(v) ? (v.filter((k) => VALID.has(k)) as KeyName[]) : [];
  } catch {
    return [];
  }
}

/** The ticked keys from a person's form, in list order. A real key wins over
 *  "Not known"; nothing ticked at all means "Not known". */
export function readKeys(form: FormData): KeyName[] {
  const ticked = new Set(form.getAll('keyholder_keys').map(String));
  const real = KEYS.filter((k) => k.key !== 'unknown' && ticked.has(k.key)).map((k) => k.key);
  return real.length ? real : ['unknown'];
}

export const keyLabels = (keys: KeyName[]) =>
  KEYS.filter((k) => keys.includes(k.key)).map((k) => k.label);
