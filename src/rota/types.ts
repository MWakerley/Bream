/** Shapes the generator works on. Deliberately plain data: the generator is a
 *  pure function so it can be reasoned about and tested without a database. */

export interface GenService {
  id: number;
  date: string; // 'YYYY-MM-DD'
  day: number; // epoch day, for arithmetic
  time: string;
  title: string;
  isCommunion: boolean;
  roles: { roleId: number; min: number; ideal: number }[];
}

export interface GenPerson {
  id: number;
  name: string;
}

export interface GenCapability {
  /** "Ask them as often as needed" — this person is exempt from the gap the
   *  generator would otherwise work out from their share of the role, and from
   *  the gap between any two jobs. Their OWN stated minimum, if they have one,
   *  still applies: the tick removes a rule set on their behalf, not one they
   *  set themselves. */
  askAnyTime?: boolean;
  personId: number;
  roleId: number;
  /** The rhythm this person stated on their own record in People — the slower
   *  of their "not more often than" and their "at most N times every P" (see
   *  capabilityFromRow in load.ts). Null means "no view", and the generator
   *  substitutes their share of whatever the people who did say leave over. */
  desiredEveryDays: number | null;
  /** Hard floor, from their own record. Null means "derive from the target". */
  minGapDays: number | null;
  /** Hard cap over a rolling window: "twice a month" is {count:2, windowDays:30}. */
  maxPerWindow: { count: number; windowDays: number } | null;
}

export type Verdict = 'green' | 'amber' | 'red';

export interface GenPair {
  aId: number;
  bId: number;
  /** null = applies in any role */
  roleId: number | null;
  mode: 'together' | 'avoid';
  strength: 'must' | 'prefer';
  /** How much evidence there is for this pair; scales the bonus. */
  weight: number;
  note: string | null;
}

export interface GenUnavailable {
  personId: number;
  fromDay: number;
  toDay: number;
}

/** Somebody serving in a role on a day — past assignments, used to seed the
 *  ledger, and allocations made during this run. */
export interface ServedRecord {
  personId: number;
  roleId: number;
  day: number;
}

export interface GeneratorInput {
  services: GenService[];
  people: GenPerson[];
  roleNames: Map<number, string>;
  capabilities: GenCapability[];
  /** Keyed 'minRoleId:maxRoleId'. Absent means green — the church's own rota
   *  routinely doubles roles up, so unruled is permissive, not forbidden. */
  combinations: Map<string, { verdict: Verdict; reason: string | null }>;
  pairs: GenPair[];
  unavailable: GenUnavailable[];
  /** Assignments before the horizon, for cadence. */
  history: ServedRecord[];
  /** Assignments already inside the horizon that must be kept exactly. */
  pinned: { serviceId: number; roleId: number; slot: number; personId: number }[];
  /**
   * Existing bookings the draft takes OFF: people now on a break, and guests
   * the rota picked rather than somebody putting them on by hand. Their places
   * are left free for the generator to fill, and apply deletes the old rows.
   * Not read by the generator itself — it only ever sees the free place.
   */
  released?: Released[];
  /** The church's own rules, from Settings. Optional so every existing caller
   *  and every existing test keeps working and keeps meaning what it meant. */
  rules?: GenRules;
  runSeed: string;
}

/**
 * What the church has decided about how a draft is built.
 *
 * Deliberately plain numbers and flags rather than the words the settings page
 * uses: the generator should not know that 'fortnight_prefer' is a thing
 * somebody picked from a dropdown, only that there is a soft gap of 15 days.
 * The translation happens once, in load.ts.
 */
export interface GenRules {
  /** A hard refusal between any two jobs, whatever the role. 0 = none. */
  anyRoleHardDays: number;
  /** A preference, costing points rather than refusing. 0 = none. */
  anyRoleSoftDays: number;
  /** Most jobs one person may hold at a single service. Null = no limit. */
  maxRolesPerService: number | null;
  /** How far the generator may bend when a service would otherwise be short. */
  whenShort: 'leave_empty' | 'bend_gap' | 'bend_both';
  /** The weight on the brake that stops one capable person doing everything. */
  fairWeight: number;
  /** Report a place left empty even where the service still meets its minimum. */
  listEveryEmptyPlace: boolean;
}

/** What the generator does today, for any caller that passes no rules. */
export const DEFAULT_RULES: GenRules = {
  anyRoleHardDays: 0,
  anyRoleSoftDays: 14,
  maxRolesPerService: null,
  whenShort: 'bend_both',
  fairWeight: 40,
  listEveryEmptyPlace: false,
};

export interface Allocation {
  serviceId: number;
  roleId: number;
  slot: number;
  personId: number;
  /** One sentence saying why. A rota nobody can explain is a rota nobody trusts. */
  reason: string;
  /** Amber combinations this allocation incurred, if any. */
  amber: string[];
  pinned: boolean;
}

export interface Gap {
  serviceId: number;
  roleId: number;
  slot: number;
  /** Why nobody could take it, counted by cause. */
  because: Record<string, number>;
  message: string;
}

export interface GeneratorResult {
  allocations: Allocation[];
  gaps: Gap[];
  warnings: string[];
  /** Per-person totals, for the fairness report. */
  load: { personId: number; name: string; total: number; byRole: Record<number, number> }[];
}

export interface Released {
  assignmentId: number;
  serviceId: number;
  roleId: number;
  slot: number;
  personId: number;
  name: string;
  why: 'break' | 'guest';
}
