/**
 * The statements Apply writes a draft with, kept here rather than inline in
 * index.ts so seed/apply-test.ts can run exactly these against a real SQLite
 * database built from the migrations. A rule about never overwriting a
 * confirmed booking is only as good as the SQL that enforces it, and that SQL
 * is otherwise only ever exercised against the live rota.
 */

/**
 * Clears the places the draft is about to fill — but never a confirmed one.
 *
 * Bound to one JSON array of [serviceId, roleId, slot] triples. This is the
 * delete half of what INSERT OR REPLACE used to do, done explicitly so that a
 * confirmed row can be left out of it: somebody may have put a person on by
 * hand, from the service page, in the days the draft sat open being checked,
 * and that booking is the church's decision, not the draft's.
 *
 * A delete rather than an in-place update on purpose. A change request (ON
 * DELETE CASCADE) belongs to the person who asked, not to the slot, and an
 * update would quietly hand somebody's "I cannot make it" to whoever the draft
 * put there instead.
 */
export const CLEAR_DRAFT_PLACES_SQL = `
  DELETE FROM assignments
   WHERE status <> 'confirmed'
     AND EXISTS (SELECT 1 FROM json_each(?1) j
                  WHERE json_extract(j.value, '$[0]') = assignments.service_id
                    AND json_extract(j.value, '$[1]') = assignments.role_id
                    AND json_extract(j.value, '$[2]') = assignments.slot)`;

/**
 * One placement. OR IGNORE, so a place still held after the delete above —
 * which can only be a confirmed booking — keeps it, and the statement reports
 * no change, which is how Apply counts what it left alone.
 *
 * Drafted, generated = 1, whether the generator chose them or somebody changed
 * them by hand while checking: they all belong to this draft, and the next
 * draft applied over the same dates replaces them all alike.
 */
export const PLACE_SQL = `
  INSERT OR IGNORE INTO assignments
    (service_id, role_id, slot, person_id, status, generated, reason)
  VALUES (?1, ?2, ?3, ?4, 'draft', 1, ?5)`;

/** What Apply says once it is done, in the rota's own words. */
export function appliedNotice(placed: number, kept: number, dropped: number): string {
  const parts = [
    `${placed} place${placed === 1 ? '' : 's'} from the draft ${placed === 1 ? 'is' : 'are'} now on the rota, marked as draft.`,
  ];
  if (kept) {
    parts.push(`${kept} ${kept === 1 ? 'was' : 'were'} left as ${kept === 1 ? 'it was' : 'they were'}, `
      + `because somebody booked ${kept === 1 ? 'that place' : 'those places'} by hand while the draft was open.`);
  }
  if (dropped) {
    parts.push(`${dropped} could not go on, because the person or the service is no longer there `
      + '(stopped serving, merged into somebody else, or the service was cancelled).');
  }
  return parts.join(' ');
}
