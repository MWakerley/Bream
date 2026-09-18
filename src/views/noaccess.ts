import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';
import { AREAS } from '../access.js';

/**
 * Shown when somebody opens a page their profile does not cover.
 *
 * It says which area is missing and who to ask, rather than a bare "403" or a
 * silent redirect. A volunteer who followed a link from a WhatsApp message needs
 * to know they have not broken anything, and an administrator reading it over
 * their shoulder needs to know exactly which tick box is missing.
 */
export function noAccessPage(ctx: ViewCtx, area: string | null) {
  const label = AREAS.find((a) => a.key === area)?.label ?? 'this part of the system';
  return layout(
    {
      title: 'Not for you, yet',
      eyebrow: 'Bream Church',
      heading: 'You cannot open this page',
      back: { href: '/app', label: 'All areas' },
      ...ctx,
    },
    html`
      <div class="notice notice-warn">
        <p style="margin-top:0">
          Your sign-in does not include <strong>${label}</strong>.
        </p>
        <p style="margin-bottom:0">
          Nothing has gone wrong and you have not done anything wrong — this page simply is not
          part of what you have been given. If you need it, ask whoever looks after the system
          to add it to your profile.
        </p>
      </div>
      <p><a class="btn-primary" href="/app">Back to where you can go</a></p>
    `,
  );
}
