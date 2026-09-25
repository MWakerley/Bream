/**
 * The acknowledgement email sent after somebody books onto an event.
 *
 * TWO RULES GOVERN THIS FILE.
 *
 * 1. A FAILED EMAIL MUST NEVER LOSE A BOOKING. The booking is written first and
 *    committed; sending is attempted afterwards and its outcome recorded against
 *    the row. Somebody who booked a place has booked it whether or not our mail
 *    provider was reachable.
 *
 * 2. IT DEGRADES RATHER THAN BREAKS. Until a domain is onboarded onto Cloudflare
 *    Email Sending there is no binding, so sending is skipped, the booking still
 *    succeeds, and the admin screen says plainly that acknowledgements are not
 *    going out. Half-working silently is the outcome to avoid.
 */

export interface AckContext {
  name: string;
  eventTitle: string;
  /** Already formatted for reading, e.g. 'Sun 11 Oct 2026'. */
  eventDate: string;
  eventTime: string;
  location: string | null;
  partySize: number;
}

/** Placeholders an admin can use in the subject or body. */
export const PLACEHOLDERS: { token: string; means: string }[] = [
  { token: '{name}', means: 'the name they booked under' },
  { token: '{event}', means: 'the name of the event' },
  { token: '{date}', means: 'the date, e.g. Sun 11 Oct 2026' },
  { token: '{time}', means: 'the start time' },
  { token: '{where}', means: 'where it is' },
  { token: '{places}', means: 'how many places they booked' },
];

export function fillPlaceholders(template: string, c: AckContext): string {
  return template
    .replace(/\{name\}/g, c.name)
    .replace(/\{event\}/g, c.eventTitle)
    .replace(/\{date\}/g, c.eventDate)
    .replace(/\{time\}/g, c.eventTime)
    .replace(/\{where\}/g, c.location ?? 'the church')
    .replace(/\{places\}/g, String(c.partySize));
}

/** Minimal escaping — the body is written by an admin, not a stranger, but it
 *  still goes into HTML and must not be able to break out of it. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SendResult {
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

/**
 * Sends one acknowledgement.
 *
 * `binding` is the Cloudflare Email Sending binding, which is absent until a
 * domain has been onboarded — hence the skip path rather than a crash.
 */
export async function sendAcknowledgement(
  binding: { send: (m: unknown) => Promise<unknown> } | undefined,
  from: string | undefined,
  to: string,
  subject: string,
  body: string,
  ctx: AckContext,
): Promise<SendResult> {
  if (!binding || !from) {
    return {
      status: 'skipped',
      error: 'Email sending is not set up on this account yet.',
    };
  }
  if (!to) return { status: 'skipped', error: 'No email address was given.' };

  return sendEmail(binding, from, to, fillPlaceholders(subject, ctx), fillPlaceholders(body, ctx));
}

/**
 * Sends one message exactly as written — no placeholders filled. For text the
 * system composes itself, where a booker who typed "{name}" into an allergies
 * box must have "{name}" come through, not somebody's name.
 */
export async function sendEmail(
  binding: { send: (m: unknown) => Promise<unknown> } | undefined,
  from: string | undefined,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  if (!binding || !from) {
    return {
      status: 'skipped',
      error: 'Email sending is not set up on this account yet.',
    };
  }
  if (!to) return { status: 'skipped', error: 'No email address was given.' };

  // Both parts, always. Some clients show only the plain text, and having only
  // HTML also counts against a message with spam filters.
  const text = body;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#242a34">
${escapeHtml(body).split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('\n')}
</div>`;

  try {
    await binding.send({
      to,
      from: { email: from, name: 'Bream Church' },
      subject: subject.slice(0, 200),
      text,
      html,
    });
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

export interface OrganiserNotice {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  name: string;
  email: string | null;
  phone: string | null;
  partySize: number;
  /** Question and answer, in the order the form asks them. */
  answers: { label: string; value: string }[];
  /** People now coming, this booking included. */
  booked: number;
  capacity: number | null;
  /** Where the organiser can see the whole list. */
  adminUrl: string;
  /** Taken by the office rather than booked online. */
  byOffice: boolean;
  /** They asked for the waiting list because the event is full. */
  waitlist?: boolean;
}

/**
 * Tells each organiser that somebody has booked.
 *
 * Same rule as the acknowledgement: the booking is committed before this is
 * called, and nothing here can undo it. Every organiser is tried even if an
 * earlier one fails — one bad address must not stop the others hearing.
 */
export async function notifyOrganisers(
  binding: { send: (m: unknown) => Promise<unknown> } | undefined,
  from: string | undefined,
  organisers: { name: string; email: string | null }[],
  n: OrganiserNotice,
): Promise<{ to: string; result: SendResult }[]> {
  const places = `${n.partySize} ${n.partySize === 1 ? 'place' : 'places'}`;
  const subject = n.waitlist
    ? `Waiting list for ${n.eventTitle}: ${n.name} (${places})`
    : `New booking for ${n.eventTitle}: ${n.name} (${places})`;
  const body = [
    n.waitlist
      ? `${n.name} has asked to go on the waiting list for ${places} at ${n.eventTitle}${n.byOffice ? ' (taken by the office)' : ''}. The event is full, so they do not have a place yet.`
      : `${n.name} has booked ${places} at ${n.eventTitle}${n.byOffice ? ' (taken by the office)' : ''}.`,
    '',
    ...(n.email ? [`Email: ${n.email}`] : []),
    ...(n.phone ? [`Phone: ${n.phone}`] : []),
    ...n.answers.map((a) => `${a.label}: ${a.value}`),
    '',
    `That makes ${n.booked} coming${n.capacity != null ? ` out of ${n.capacity}` : ''}.`,
    `It is on ${n.eventDate} at ${n.eventTime}.`,
    '',
    `The full list: ${n.adminUrl}`,
    '',
    'Bream Church',
  ].join('\n');

  const sent: { to: string; result: SendResult }[] = [];
  for (const o of organisers) {
    if (!o.email) continue;
    sent.push({
      to: o.email,
      result: await sendEmail(binding, from, o.email, subject, `Dear ${o.name},\n\n${body}`),
    });
  }
  return sent;
}

export const DEFAULT_ACK_SUBJECT = 'Your booking for {event}';
export const DEFAULT_ACK_BODY = `Dear {name},

Thank you for booking {places} place(s) at {event}.

It is on {date} at {time}, at {where}.

We look forward to seeing you.

Bream Church`;
