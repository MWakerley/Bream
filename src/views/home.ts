import { html, raw } from 'hono/html';
import { layout, icon, type IconName, type ViewCtx } from './layout.js';
import { RECENT_DAYS, howLongAgo, type ActivityItem } from '../activity.js';

interface Area {
  href: string;
  /** The right that opens it; a card for a door that would refuse is a trap. */
  area: string;
  title: string;
  blurb: string;
  go: string;
  icon: IconName;
  tone: 'navy' | 'gold' | 'green' | 'teal' | 'grey';
}

/**
 * The main screen: the five areas of the system, and nothing else to wade
 * through. Setting things up lives in the Admin Centre, for those who have it;
 * gaps in the rota live under Rota → Unfilled roles. This is the screen
 * everybody lands on, often on a phone, and its job is to get them into the
 * right place in one tap.
 */
const AREAS: Area[] = [
  {
    href: '/app/rota', area: 'rota', title: 'Rota', icon: 'clipboard', tone: 'navy',
    blurb: 'Who is serving, and when — every Sunday at a glance.',
    go: 'Open the rota',
  },
  {
    href: '/app/rooms', area: 'rooms', title: 'Room bookings', icon: 'house', tone: 'gold',
    blurb: 'What is booked in each room, and what is free.',
    go: 'Open room bookings',
  },
  {
    href: '/app/events', area: 'events', title: 'Events', icon: 'ticket', tone: 'green',
    blurb: 'What is on, who has booked, and how many places are left.',
    go: 'Open events',
  },
  {
    href: '/app/me', area: 'me', title: 'My dates', icon: 'myDates', tone: 'teal',
    blurb: 'When you are on, when you are away, and asking to swap.',
    go: 'Open my dates',
  },
  {
    href: '/app/settings', area: 'settings', title: 'Admin Centre', icon: 'cog', tone: 'grey',
    blurb: 'People, the rota’s rules, rooms and the newsletter — everything behind the scenes.',
    go: 'Open the Admin Centre',
  },
];

export function homePage(opts: {
  ctx: ViewCtx;
  /** What has changed lately. Empty on a quiet week, which is fine. */
  activity?: ActivityItem[];
  /** Injected so the page renders identically every time it is tested. */
  now?: Date;
}) {
  const firstName = opts.ctx.signedInAs.split(' ')[0] ?? opts.ctx.signedInAs;
  const now = opts.now ?? new Date();
  const activity = opts.activity ?? [];
  const allowed = opts.ctx.areas;
  // The same rule as the menu: the Admin Centre for administrators, and each
  // area for a profile that opens it.
  const areas = AREAS.filter((a) => (a.area !== 'settings' || opts.ctx.isAdmin)
    && (!allowed || allowed.has(a.area)));
  return layout(
    {
      title: 'Home',
      eyebrow: 'Bream Church',
      heading: `Welcome, ${firstName}`,
      intro: 'Choose where you want to go.',
      ...opts.ctx,
    },
    html`
      <ul class="areas areas-${areas.length}">
        ${areas.map(
          (a) => html`<li>
            <a class="area area-${a.tone}" href="${a.href}">
              <span class="area-icon" aria-hidden="true">${raw(icon(a.icon, 26))}</span>
              <span class="area-text">
                <h2>${a.title}</h2>
                <p>${a.blurb}</p>
              </span>
              <span class="area-go"><span class="area-go-words">${a.go} </span>→</span>
            </a>
          </li>`,
        )}
      </ul>

      <!-- What has changed since somebody last looked, already filtered to
           what this person may open. The case this exists for: a volunteer
           says on their own page that they cannot preach on the 20th, and
           until now nobody found out until somebody noticed the gap. -->
      ${activity.length
        ? html`<section class="recent">
            <div class="recent-head">
              <h2>Lately</h2>
              <p>What has changed in the last ${RECENT_DAYS} days, and anything older still waiting for somebody.</p>
            </div>
            <ul class="recent-list">
              ${activity.map((a) => html`<li class="recent-item recent-${a.tone} ${a.actionNeeded ? 'recent-action' : ''}">
                ${a.actionNeeded
                  ? html`<span class="action-mark" aria-hidden="true">!</span>`
                  : html`<span class="recent-icon" aria-hidden="true">${a.icon}</span>`}
                <span class="recent-body">
                  ${a.actionNeeded ? html`<span class="action-needed">Action needed</span>` : ''}
                  <span class="recent-text">
                    <strong>${a.who}</strong> ${a.what}
                  </span>
                  <span class="recent-when">${howLongAgo(a.when, now)}</span>
                </span>
                ${a.href
                  ? html`<a class="recent-go" href="${a.href}">
                      Open<span class="sr-only"> — ${a.who} ${a.what}</span>
                    </a>`
                  : ''}
              </li>`)}
            </ul>
          </section>`
        : ''}
    `,
  );
}
