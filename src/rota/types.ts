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
  personId: number;
  roleId: number;
  /** The rhythm this person wants in this role. Null means "no view", and the
   *  generator substitutes their fair share of the role. */
  desiredEveryDays: number | null;
  /** Hard floor. Null means "derive from the target". */
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
  runSeed: string;
}

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
