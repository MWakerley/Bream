/**
 * Getting a newsletter into inboxes.
 *
 * EACH PERSON GETS THEIR OWN COPY, addressed to them alone. Nobody's address
 * is ever in anybody else's email — not in To, not in Cc, not even in a blind
 * copy — and each copy carries that person's own one-click unsubscribe link,
 * which a single blind-copied message to everyone could not.
 *
 * WHICH SERVICE SENDS THEM is deliberately a setting, NEWSLETTER_SENDER, and
 * it is OFF unless set. The church's mail goes through Cloudflare Email
 * Sending, whose terms allow only transactional mail (booking confirmations
 * and the like), not newsletters; a newsletter service is to be chosen. Until
 * then the office can write, preview, print and test-send newsletters, and the
 * final Send button says plainly why it is not there yet.
 *
 * To plug in a service, add a branch to newsletterSender() returning a
 * NewsletterSender, and set NEWSLETTER_SENDER to its name.
 */

export interface OutgoingCopy {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** The reader's own unsubscribe link, for the List-Unsubscribe header that
   *  puts an Unsubscribe button beside the sender in Gmail and Apple Mail. */
  unsubscribeUrl?: string;
  pdf: { bytes: Uint8Array; filename: string };
}

export interface NewsletterSender {
  /** For the screen: "Cloudflare", "Brevo". */
  label: string;
  /** Throws on failure, with a message fit to show the office. */
  send(copy: OutgoingCopy): Promise<void>;
}

type Binding = { send: (m: unknown) => Promise<unknown> };

/** One copy through the Cloudflare binding. Used for test copies always, and
 *  for the real thing only if NEWSLETTER_SENDER is 'cloudflare'. */
export function cloudflareSender(binding: Binding, from: string): NewsletterSender {
  return {
    label: 'Cloudflare',
    async send(c) {
      const pdf = c.pdf.bytes;
      await binding.send({
        // The reader, and only the reader.
        to: c.to,
        from: { email: from, name: 'Bream Church' },
        subject: c.subject.slice(0, 200),
        html: c.html,
        text: c.text,
        attachments: [{
          content: pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength),
          filename: c.pdf.filename,
          type: 'application/pdf',
          disposition: 'attachment',
        }],
        ...(c.unsubscribeUrl
          ? { headers: {
              'List-Unsubscribe': `<${c.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            } }
          : {}),
      });
    },
  };
}

export interface SenderEnv {
  EMAIL?: Binding;
  ACK_FROM?: string;
  NEWSLETTER_SENDER?: string;
  NEWSLETTER_FROM?: string;
}

/** The service that sends newsletters to subscribers, or null while none is
 *  switched on. */
export function newsletterSender(env: SenderEnv): NewsletterSender | null {
  const from = env.NEWSLETTER_FROM || env.ACK_FROM;
  switch ((env.NEWSLETTER_SENDER ?? '').trim().toLowerCase()) {
    case 'cloudflare':
      return env.EMAIL && from ? cloudflareSender(env.EMAIL, from) : null;
    default:
      return null;
  }
}

/** The service for a single test copy to the office: Cloudflare, which is
 *  fine for one message to ourselves. */
export function testSender(env: SenderEnv): NewsletterSender | null {
  const from = env.NEWSLETTER_FROM || env.ACK_FROM;
  return env.EMAIL && from ? cloudflareSender(env.EMAIL, from) : null;
}

/** How many copies one press of the button sends before handing back to the
 *  page to carry on. Keeps each request well inside what a Worker may do in
 *  one go; the page continues on its own until everybody has theirs. */
export const SEND_BATCH = 25;
