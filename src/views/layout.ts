import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

/**
 * What hono's `html` tag actually returns. It is a Promise whenever the template
 * interpolates an array or another async fragment, which any view with a .map()
 * in it does — so every view signature has to accept both.
 */
export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface NavItem { href: string; label: string; match?: string; area?: string }

/** What every page needs to draw the chrome: who is signed in, whether Settings
 *  belongs in the menu, and which item is current. Threaded through each view
 *  rather than held in a module variable — a Workers isolate is reused between
 *  requests, so module state would leak between users. */
export interface ViewCtx {
  signedInAs: string;
  isAdmin: boolean;
  path: string;
  /** What this person's profile lets them open. A menu that offers a page the
   *  person cannot open is a trap, so items are filtered against this. */
  areas?: Set<string>;
}

/** The main menu. Everyone sees the three areas; Settings is added for admins. */
const NAV: NavItem[] = [
  { href: '/app', label: 'Home', match: '^/app$' },
  { href: '/app/rota', label: 'Rota', match: '^/app/rota', area: 'rota' },
  { href: '/app/rooms', label: 'Rooms', match: '^/app/rooms', area: 'rooms' },
  { href: '/app/events', label: 'Events', match: '^/app/events', area: 'events' },
  { href: '/app/me', label: 'My dates', match: '^/app/me', area: 'me' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/app/settings', label: 'Settings', match: '^/app/settings', area: 'settings' },
];

/**
 * The second row of the menu, shown once you are inside an area.
 *
 * Generating a rota is one of the two or three things this system exists to do,
 * and it was reachable only from a link near the bottom of the home page. A job
 * that important belongs in the menu, next to the thing it acts on.
 *
 * Keyed by the prefix that switches the bar on. Items are filtered against what
 * the person may actually open, so a volunteer sees the two they can use rather
 * than five, three of which would refuse them.
 */
const SUB_NAV: { prefix: string; items: NavItem[] }[] = [
  {
    prefix: '/app/rota',
    items: [
      { href: '/app/rota', label: 'The rota', match: '^/app/rota$', area: 'rota' },
      { href: '/app/rota/calendar', label: 'Calendar', match: '^/app/rota/calendar', area: 'rota' },
      { href: '/app/rota/worship', label: 'Worship', match: '^/app/rota/worship', area: 'rota' },
      { href: '/app/rota/readings', label: 'Readings and sermons', match: '^/app/rota/readings', area: 'rota.manage' },
      { href: '/app/rota/requests', label: 'Change requests', match: '^/app/rota/requests', area: 'rota.manage' },
    ],
  },
  {
    prefix: '/app/rooms',
    items: [
      { href: '/app/rooms', label: 'The diary', match: '^/app/rooms$', area: 'rooms' },
      { href: '/app/rooms/calendar', label: 'Calendar', match: '^/app/rooms/calendar', area: 'rooms' },
      { href: '/app/rooms/booking-form', label: 'Booking form', match: '^/app/rooms/booking-form', area: 'rooms.manage' },
    ],
  },
  {
    prefix: '/app/events',
    items: [
      { href: '/app/events', label: 'All events', match: '^/app/events$', area: 'events' },
      { href: '/app/events/new', label: 'Add an event', match: '^/app/events/new', area: 'events.manage' },
    ],
  },
  {
    prefix: '/app/settings',
    items: [
      { href: '/app/settings', label: 'Overview', match: '^/app/settings$', area: 'settings' },
      { href: '/app/settings/people', label: 'People', match: '^/app/settings/people', area: 'settings' },
      { href: '/app/settings/keyholders', label: 'Keyholders', match: '^/app/settings/keyholders', area: 'settings' },
      { href: '/app/settings/safeguarding', label: 'Safeguarding', match: '^/app/settings/safeguarding', area: 'settings' },
      { href: '/app/settings/roles', label: 'Roles', match: '^/app/settings/roles', area: 'settings' },
      { href: '/app/settings/combinations', label: 'Combination rules', match: '^/app/settings/combinations', area: 'settings' },
      { href: '/app/settings/generate', label: 'Generate a rota', match: '^/app/settings/generate', area: 'rota.manage' },
      { href: '/app/settings/draft-rules', label: 'Draft rota rules', match: '^/app/settings/draft-rules', area: 'settings' },
      { href: '/app/settings/pairs', label: 'Who works with whom', match: '^/app/settings/pairs', area: 'settings' },
      { href: '/app/settings/services', label: 'Services', match: '^/app/settings/services', area: 'settings' },
      { href: '/app/settings/rooms', label: 'Rooms', match: '^/app/settings/rooms', area: 'settings' },
      { href: '/app/settings/profiles', label: 'What people can see', match: '^/app/settings/profiles', area: 'settings' },
    ],
  },
];

/**
 * Polish for a phone, on top of a header that already works without it.
 *
 * Escape, or a tap anywhere else, closes the menu, as people expect of one
 * that lies over the page. And the strip of in-section pages, which scrolls
 * sideways on a phone, starts with the page you are on in view — in Settings
 * that can be the tenth of twelve, well off the right-hand edge. Inline and
 * straight after the header, so the strip is already in place when the page
 * is first drawn rather than jumping a moment later. Phones only, as app.css
 * counts them, so a tablet's strip starts where it always has.
 *
 * Plain ES5, as search.js is, for the oldest iPad in the building.
 */
const HEADER_SCRIPT = html`<script>
(function () {
  var menu = document.querySelector('details.phone-menu');
  if (menu) {
    document.addEventListener('keydown', function (e) {
      if (!menu.open || !(e.key === 'Escape' || e.keyCode === 27)) return;
      var inside = menu.contains(document.activeElement);
      menu.open = false;
      if (inside) menu.querySelector('summary').focus();
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
  }
  var strip = document.querySelector('.subnav');
  var here = strip && strip.querySelector('[aria-current]');
  var phone = window.matchMedia && window.matchMedia('(max-width: 40rem)').matches;
  if (phone && here && strip.scrollWidth > strip.clientWidth) {
    strip.scrollLeft += here.getBoundingClientRect().left - strip.getBoundingClientRect().left
      - (strip.clientWidth - here.offsetWidth) / 2;
  }
})();
</script>`;

export interface LayoutOptions {
  title: string;
  heading?: string;
  /** Sits above the heading, in brand gold. */
  eyebrow?: string;
  /** A sentence under the heading, for the person who has never seen this page. */
  intro?: string;
  /** Sits UNDER the heading, in brand gold. Says what the page is FOR when the
   *  heading itself is a name — an event is called "Harvest Supper", which does
   *  not on its own tell a stranger that this is where they book a place. */
  headingAside?: string;
  back?: { href: string; label: string };
  /** Set false for sign-in and setup, which have no navigation. */
  chrome?: boolean;
  signedInAs?: string;
  isAdmin?: boolean;
  /** Current path, for highlighting the menu. */
  path?: string;
  /** What the person may open; the menu is filtered against it. */
  areas?: Set<string>;
}

/**
 * The shell for every signed-in page.
 *
 * Server-rendered on purpose: the people using this are volunteers on whatever
 * device they own, often an old iPad, and a page that is already HTML when it
 * arrives beats one that has to boot a framework first.
 *
 * The logo now uses the keyed-out transparent version, so it can sit directly on
 * the off-white bar with no white rectangle behind it. It still must NOT go on
 * the navy: the "Church" half of the wordmark is charcoal and falls to about
 * 1.6:1 against it. Light grounds only — which is what the church's own website
 * does too.
 */
export function layout(o: LayoutOptions, body: Html) {
  const chrome = o.chrome !== false;
  const path = o.path ?? '';
  const allowed = o.areas;
  const items = [...NAV, ...(o.isAdmin ? ADMIN_NAV : [])]
    .filter((i) => !allowed || !i.area || allowed.has(i.area));

  // Longest prefix first, so /app/rooms does not claim a page under a longer
  // prefix that happens to start the same way.
  const sub = [...SUB_NAV]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((s) => path === s.prefix || path.startsWith(`${s.prefix}/`));
  const subItems = (sub?.items ?? [])
    .filter((i) => !allowed || !i.area || allowed.has(i.area));

  // The menu is drawn twice: once as the bar a computer has always had, and
  // once folded behind a "Menu" button for a phone. On a phone the bar's logo,
  // six areas and Sign out wrapped to three lines and stood a third of the way
  // down the screen on every page. Folded, the area you are in lists its own
  // pages under it, so the twelve in Settings can be read down a list rather
  // than hunted for along a sideways strip.
  //
  // A <details> rather than a script: it opens and closes with no JavaScript
  // at all, and tells a screen reader whether it is open by itself. It cannot
  // simply BE the computer's bar as well: a closed details hides what is in
  // it, and only the newest browsers can be told to show it anyway — an older
  // iPad would lose its menu. Hence two copies. Only one is ever displayed:
  // app.css hides the other with display:none, which takes it from screen
  // readers as well as from view.
  const isActive = (i: NavItem) => (i.match ? new RegExp(i.match).test(path) : false);
  const navLink = (i: NavItem) => {
    const active = isActive(i);
    return html`<a href="${i.href}" class="${active ? 'is-active' : ''}"
                       ${active ? html`aria-current="page"` : ''}>${i.label}</a>`;
  };

  return html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${o.title} — Bream Church</title>
<link rel="icon" href="/assets/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Nunito+Sans:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/assets/app.css">
<!-- Wires up any search box on the page. Deferred and cached, and it does
     nothing at all on a page that has no box, so it is loaded everywhere
     rather than left to each view to remember. -->
<script src="/assets/search.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

${chrome
      ? html`<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/app" aria-label="Bream Church, home">
      <img src="/assets/logo-transparent.png" width="227" height="93" alt="Bream Church">
    </a>
    <nav class="mainnav" aria-label="Main">
      ${items.map(navLink)}
    </nav>
    <div class="topbar-end">
      ${o.signedInAs ? html`<span class="who">${o.signedInAs}</span>` : ''}
      ${o.signedInAs
          ? html`<form method="post" action="/auth/sign-out" class="inline-form">
              <button class="btn-quiet" type="submit">Sign out</button>
            </form>`
          : ''}
    </div>
    <details class="phone-menu">
      <summary class="phone-menu-button">
        <svg class="phone-menu-icon is-shut" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        <svg class="phone-menu-icon is-open" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        Menu
      </summary>
      <div class="phone-menu-panel">
        <nav aria-label="Main">
          <ul class="phone-menu-list">
            ${items.map((i) => html`<li>${navLink(i)}${isActive(i) && subItems.length > 1
              ? html`<ul class="phone-menu-sub" aria-label="In this section">
                  ${subItems.map((s) => html`<li>${navLink(s)}</li>`)}
                </ul>`
              : ''}</li>`)}
          </ul>
        </nav>
        ${o.signedInAs
          ? html`<div class="phone-menu-end">
              <span class="who">Signed in as ${o.signedInAs}</span>
              <form method="post" action="/auth/sign-out" class="inline-form">
                <button class="btn-quiet" type="submit">Sign out</button>
              </form>
            </div>`
          : ''}
      </div>
    </details>
  </div>
  ${subItems.length > 1
      ? html`<div class="subbar">
    <nav class="subnav" aria-label="In this section">
      ${subItems.map(navLink)}
    </nav>
  </div>`
      : ''}
</header>
${HEADER_SCRIPT}`
      : html`<header class="topbar topbar-bare">
  <div class="topbar-inner">
    <span class="brand"><img src="/assets/logo-transparent.png" width="227" height="93" alt="Bream Church"></span>
  </div>
</header>`}

<main id="main" class="page">
  <div class="wrap">
    ${o.back ? html`<a class="back" href="${o.back.href}">${o.back.label}</a>` : ''}
    ${o.eyebrow
      ? html`<p class="eyebrow ${o.headingAside ? 'eyebrow-centred' : ''}">${o.eyebrow}</p>`
      : ''}
    ${o.headingAside
      ? html`<div class="page-h1-stack">
          <h1 class="page-h1">${o.heading ?? o.title}</h1>
          <span class="page-h1-aside">${o.headingAside}</span>
        </div>`
      : html`<h1 class="page-h1">${o.heading ?? o.title}</h1>`}
    ${o.intro ? html`<p class="page-intro">${o.intro}</p>` : ''}
    ${body}
  </div>
</main>
</body>
</html>`;
}

/** A coloured status chip. The vocabulary matches the combination rules, so the
 *  same words mean the same thing everywhere in the system. */
export function chip(tone: 'green' | 'amber' | 'red' | 'neutral' | 'navy', label: string) {
  return html`<span class="chip chip-${tone}">${label}</span>`;
}

/**
 * A key, for keyholders. Inline SVG rather than an emoji: an emoji key looks
 * different on every device and not at all on some older iPads. Hidden from
 * screen readers, because the word "Keyholder" always sits next to it.
 */
export const KEY_ICON = `<svg class="icon-key" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;color:var(--navy)"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/></svg>`;
