import { html } from 'hono/html';
import { layout, type ViewCtx } from './layout.js';

interface Area {
  href: string;
  title: string;
  blurb: string;
  go: string;
  icon: string;
}

/**
 * The main screen: the three areas of the system.
 *
 * Three big targets and little else above the fold. This is the screen a
 * churchwarden lands on every time, and its only job is to get them into the
 * right place in one tap without having to read anything first.
 */
const AREAS: Area[] = [
  {
    href: '/app/rota',
    title: 'Rota',
    blurb: 'Who is serving, and when. Build the rota, fill the gaps, and let people say when they cannot make it.',
    go: 'Open the rota',
    icon: '📋',
  },
  {
    href: '/app/rooms',
    title: 'Room booking',
    blurb: 'Book the Church Centre, Prayer room, Sofa room or the main church — and check what is free before you promise it.',
    go: 'Open room booking',
    icon: '🗝️',
  },
  {
    href: '/app/events',
    title: 'Events',
    blurb: 'Put on an event, take bookings for it, and see how many are coming and how many places are left.',
    go: 'Open events',
    icon: '🎉',
  },
];

const ADMIN_LINKS: { href: string; label: string; note: string }[] = [
  { href: '/app/settings/people', label: 'People', note: 'Who can do what, and how often' },
  { href: '/app/settings/people/by-role', label: 'Edit by role', note: 'Who can preach, who can lead' },
  { href: '/app/settings/people/merge', label: 'Merge duplicates', note: 'Andy, Andy E, Andy Ewens' },
  { href: '/app/settings/profiles', label: 'What people can see', note: 'Profiles and permissions' },
  { href: '/app/settings/people/new', label: 'Add a person', note: 'And give them a sign-in' },
  { href: '/app/settings/roles', label: 'Roles', note: 'How many each service needs' },
  { href: '/app/settings/combinations', label: 'Combination rules', note: 'Two roles, one person' },
  { href: '/app/settings/pairs', label: 'Who works with whom', note: 'People who serve together' },
  { href: '/app/settings/services', label: 'Services', note: 'The Sunday pattern and one-offs' },
  { href: '/app/rota/readings', label: 'Readings', note: 'Readings and sermon titles' },
  { href: '/app/rota/generate', label: 'Generate a rota', note: 'A first draft, ready to check' },
];

export function homePage(opts: {
  ctx: ViewCtx;
  /** Services in the next few weeks that are missing a required role. */
  gapCount: number;
  isAdmin: boolean;
}) {
  const firstName = opts.ctx.signedInAs.split(' ')[0] ?? opts.ctx.signedInAs;
  return layout(
    {
      title: 'Home',
      eyebrow: 'Bream Church',
      heading: `Welcome, ${firstName}`,
      intro: 'Rota and diary management. Choose an area to get started.',
      ...opts.ctx,
    },
    html`
      ${opts.gapCount > 0
        ? html`<div class="notice notice-warn" role="status">
            <p style="margin:0">
              <strong>${opts.gapCount}</strong>
              ${opts.gapCount === 1 ? 'upcoming service has' : 'upcoming services have'}
              a role with nobody at all on it.
              <a href="/app/rota/gaps">See which ones</a>.
            </p>
          </div>`
        : ''}

      <ul class="areas">
        ${AREAS.map(
          (a) => html`<li>
            <a class="area" href="${a.href}">
              <span class="area-icon" aria-hidden="true">${a.icon}</span>
              <h2>${a.title}</h2>
              <p>${a.blurb}</p>
              <span class="area-go">${a.go} →</span>
            </a>
          </li>`,
        )}
      </ul>

      ${opts.isAdmin
        ? html`<h2 class="section-h2">Setting things up</h2>
            <ul class="tiles">
              ${ADMIN_LINKS.map(
                (l) => html`<li>
                  <a class="tile" href="${l.href}">
                    <span class="tile-label">${l.label}</span>
                    <span class="tile-note">${l.note}</span>
                  </a>
                </li>`,
              )}
            </ul>`
        : ''}
    `,
  );
}
