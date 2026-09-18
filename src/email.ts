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

  const filledSubject = fillPlaceholders(subject, ctx).slice(0, 200);
  const filledBody = fillPlaceholders(body, ctx);

  // Both parts, always. Some clients show only the plain text, and having only
  // HTML also counts against a message with spam filters.
  const text = filledBody;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#242a34">
${escapeHtml(filledBody).split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('\n')}
</div>`;

  try {
    await binding.send({
      to,
      from: { email: from, name: 'Bream Church' },
      subject: filledSubject,
      text,
      html,
    });
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

export const DEFAULT_ACK_SUBJECT = 'Your booking for {event}';
export const DEFAULT_ACK_BODY = `Dear {name},

Thank you for booking {places} place(s) at {event}.

It is on {date} at {time}, at {where}.

We look forward to seeing you.

Bream Church`;
