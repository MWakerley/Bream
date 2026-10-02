/**
 * The keys a keyholder can hold.
 *
 * A fixed list, because the buildings are: the church, the Church Centre and
 * the office — and the safe, which is not a building but is a key somebody
 * holds and has to give back all the same. "Not known" is its own answer rather
 * than an empty one, and it cannot sit alongside a real key — somebody either
 * has the Church key or we do not know what they have, not both.
 *
 * Adding a key is one line here and nothing else: what is stored is a JSON list
 * of these names, parseKeys drops any it does not recognise, and every page
 * draws its boxes and labels from this list. "Not known" stays last.
 */
export const KEYS = [
  { key: 'church', label: 'Church' },
  { key: 'centre', label: 'Church Centre' },
  { key: 'office', label: 'Church Office' },
  { key: 'safe', label: 'Safe' },
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
