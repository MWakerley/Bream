/**
 * Who can see what.
 *
 * A profile is a named set of AREAS. People get a profile; the profile decides
 * which pages open. Areas are rows in the database rather than values in an
 * enum, so the church can add a profile without a deploy — but the NAMES are
 * fixed here, because the router has to check something, and a typo in a
 * database row that silently grants nothing would be worse than a compile error.
 */

export const AREAS = [
  { key: 'rota', label: 'See the rota', note: 'Who is serving and when, read-only.' },
  { key: 'rota.manage', label: 'Build the rota', note: 'Generate it, edit services, readings, and handle swap requests.' },
  { key: 'rooms', label: 'See room bookings', note: 'The room diary, read-only.' },
  { key: 'rooms.manage', label: 'Book rooms', note: 'Make, change and cancel bookings.' },
  { key: 'events', label: 'See events', note: 'What is on and who has booked.' },
  { key: 'events.manage', label: 'Run events', note: 'Create events, take bookings, send acknowledgements.' },
  { key: 'me', label: 'Their own dates', note: 'Say when they are away and ask to swap.' },
  { key: 'settings', label: 'Settings', note: 'People, roles, profiles — everything behind the scenes.' },
] as const;

export type Area = (typeof AREAS)[number]['key'];

export const AREA_KEYS: Area[] = AREAS.map((a) => a.key);

/**
 * Which area each path needs.
 *
 * Longest match wins, so '/app/rota/generate' needs rota.manage even though
 * '/app/rota' only needs rota. Ordered longest-first for that reason.
 */
const RULES: { prefix: string; area: Area }[] = ([
  { prefix: '/app/settings', area: 'settings' },
  { prefix: '/app/rota/generate', area: 'rota.manage' },
  { prefix: '/app/rota/readings', area: 'rota.manage' },
  { prefix: '/app/rota/requests', area: 'rota.manage' },
  { prefix: '/app/rota', area: 'rota' },
  { prefix: '/app/rooms/series', area: 'rooms.manage' },
  { prefix: '/app/rooms/book', area: 'rooms.manage' },
  { prefix: '/app/rooms', area: 'rooms' },
  { prefix: '/app/events/new', area: 'events.manage' },
  { prefix: '/app/events', area: 'events' },
  { prefix: '/app/me', area: 'me' },
] as { prefix: string; area: Area }[]).sort((a, b) => b.prefix.length - a.prefix.length);

/** The area a path needs, or null when it needs only a sign-in. */
export function areaForPath(path: string): Area | null {
  return RULES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`))?.area ?? null;
}

/**
 * Whether a request is allowed.
 *
 * Writing to an area needs its `.manage` right even where the path itself does
 * not say so — POSTing to /app/rooms/123 changes a booking, and reading the
 * diary should not let somebody do that.
 */
export function mayAccess(areas: Set<string>, path: string, method: string): boolean {
  const needed = areaForPath(path);
  if (!needed) return true;
  if (!areas.has(needed)) return false;

  if (method !== 'GET' && method !== 'HEAD') {
    const managed = `${needed.split('.')[0]}.manage`;
    // 'me' and 'settings' have no separate manage right: being in them is the
    // right. Everything else needs the manage area to change anything.
    if (needed !== 'me' && needed !== 'settings' && !needed.endsWith('.manage')) {
      return areas.has(managed);
    }
  }
  return true;
}

export interface ProfileRow {
  id: number;
  name: string;
  description: string | null;
  is_default: number;
  is_admin: number;
  areas: string[];
  people: number;
}

export async function listProfiles(db: D1Database): Promise<ProfileRow[]> {
  const batched = await db.batch([
    db.prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM people x WHERE x.profile_id = p.id AND x.is_active = 1) AS people
         FROM profiles p ORDER BY p.is_admin DESC, p.name`,
    ),
    db.prepare('SELECT profile_id, area FROM profile_areas'),
  ]);

  const profiles = (batched[0]?.results ?? []) as Omit<ProfileRow, 'areas'>[];
  const areas = (batched[1]?.results ?? []) as { profile_id: number; area: string }[];

  const byProfile = new Map<number, string[]>();
  for (const a of areas) byProfile.set(a.profile_id, [...(byProfile.get(a.profile_id) ?? []), a.area]);
  return profiles.map((p) => ({ ...p, areas: byProfile.get(p.id) ?? [] }));
}

/** The areas a person can open, from their profile. */
export async function areasForPerson(db: D1Database, personId: number): Promise<Set<string>> {
  const { results } = await db
    .prepare(
      `SELECT a.area FROM people p
         JOIN profile_areas a ON a.profile_id = p.profile_id
        WHERE p.id = ?1`,
    )
    .bind(personId)
    .all<{ area: string }>();
  return new Set(results.map((r) => r.area));
}

/**
 * A readable temporary password.
 *
 * Deliberately words and digits rather than random symbols: it gets read out
 * over the phone and typed on a tablet, and an unreadable one just gets written
 * on a sticky note. It is single-use — the account must change it on first
 * sign-in — so its job is to survive being dictated once, not to resist attack
 * for years.
 */
const WORDS = [
  'amber', 'anchor', 'beacon', 'bramble', 'candle', 'cedar', 'chapel', 'clover',
  'copper', 'dapple', 'ember', 'fern', 'garnet', 'harbour', 'hazel', 'heron',
  'lantern', 'meadow', 'mellow', 'orchard', 'pebble', 'quarry', 'ripple', 'saffron',
  'thistle', 'timber', 'valley', 'willow', 'window', 'yonder',
];

export function temporaryPassword(): string {
  const pick = () => {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    return WORDS[n % WORDS.length] ?? 'chapel';
  };
  const digits = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 9000 + 1000;
  // Three words and four digits clears the 12-character minimum comfortably.
  return `${pick()}-${pick()}-${digits}`;
}

/** A username suggestion from a name: 'Andy Ewens' -> 'andy.ewens'. */
export function suggestUsername(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s.]/g, '')
    .replace(/\s+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 40) || 'user';
}
