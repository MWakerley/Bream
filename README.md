# Bream Church Rota and Diary Management System

A Cloudflare Worker at **https://breamchurch.stack66.com**, backed by D1.

Three areas, reachable from the main screen once signed in:

1. **Rota** — who is serving and when, generated from people's stated roles,
   frequency preferences, pairings and the role-combination rules.
2. **Room booking** — Main church, Church Centre, Prayer room, Sofa room.
3. **Events** — put on an event, take bookings, watch the numbers.

## What is built

| Area | State |
|---|---|
| Admin login, sessions, first-run setup | **working** |
| Main screen with the three areas | **working** |
| Settings: people, what each can do, how often | **working** (editable) |
| Settings: edit a whole role at once | **working** |
| Settings: merging duplicate people | **working** |
| Settings: roles, combination rules, pairings | **working** (read) |
| Services: Sunday pattern and one-off services | **working** |
| Generating a rota creates the Sundays it needs | **working** |
| Rota dashboard, service detail, gap warnings | **working** |
| Readings and sermon titles | **working** |
| Switching a role off for one service | **working** |
| Draft rota generation, with preview before saving | **working** |
| Draft rota follows each person's own "how often" | **working** |
| Changing any service of a draft by hand before applying | **working** |
| My dates, saying you are away, asking to swap | **working** |
| Change requests for whoever builds the rota | **working** |
| Room booking, amending, cancelling, clash checks | **working** |
| Repeating room bookings, cancelled as one | **working** |
| Events, custom booking forms, public booking page | **working** |
| Event posters, optional email/phone questions | **working** |
| Acknowledgement emails after booking | **built, needs a sending domain** |
| Calendar views for the rota and the rooms | **working** |
| Adding and renaming rooms | **working** |
| Adding and editing roles | **working** |
| Profiles: what each person can see | **working** |
| Adding people, with or without a sign-in | **working** |
| Temporary passwords, forced change on first use | **working** |
| Emailing somebody their new sign-in | **working** |

Volunteers can already use `/app/me` to say when they are away and to ask to be
taken off a date — but only if they have a sign-in. Giving ~60 volunteers a way
in without 60 passwords is the one substantial piece left; see the note at the
end.

## First run

There is no default password and none is stored anywhere. The first
administrator is created once, through a form, using a one-time ticket:

```bash
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN
```

Then open `https://breamchurch.stack66.com/admin/setup?token=<that value>` and
choose a password in the form. Afterwards:

```bash
npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN
```

The route stops responding as soon as an administrator exists, whether or not
the secret is still set — so leaving it in place cannot be used to add a second
administrator quietly.

## Working on it

```bash
npm install
npm run check      # type-check
npm run preview    # serves ./public only — the public landing page
npm run deploy     # type-check, then wrangler deploy
npm run tail       # live logs from production
```

`wrangler dev` is not the preview command here. `npm run preview` serves the
static landing page; everything behind sign-in is server-rendered by the Worker
and is verified against the deploy with `curl`.

Database:

```bash
npx wrangler d1 migrations apply bream-church --remote
node seed/build-seed.cjs    # regenerates migrations/0002_seed.sql from seed/roster.json
```

## Things that will bite you

**PBKDF2 above 100,000 iterations fails on Workers, but only in production.**
`workerd` refuses any single `deriveBits` call above 100,000 iterations, and the
local test runtime does not enforce it — so it surfaces as a generic HTTP 500 on
every sign-in, in production only. This has already happened once on this
Cloudflare account. `src/auth.ts` reaches 600,000 iterations by chaining six
calls of 100,000, each taking the previous output as its input; the ceiling is
per call, not per password, so the work factor is preserved. Do not "fix" a
failure here by lowering the number.

**D1 rejects large compound SELECTs.** A `UNION ALL` of 31 terms was already over
the limit, well below stock SQLite's 500. `seed/build-seed.cjs` emits one
statement per row and chunks multi-row `VALUES` lists for the same reason.

**The logo needs a light background.** The supplied file is fully opaque — the
white is baked in, not transparent — so `seed/make-logo-transparent.cjs` keys it
out into `public/assets/logo-transparent.png`. That is what the app uses.

Keyed or not, it goes on **light grounds only**. The "Church" half of the
wordmark is charcoal and falls to about **1.6:1 on the brand navy**, which is
unreadable. That is why the top bar is white with navy around it — which is also
what the church's own website does. Do not move the logo onto the navy.

The keying is a colour-distance key, not a luminance key, on purpose: the brand
gold is bright, so keying on brightness would make the wordmark half-transparent.
It measures distance from white in the darkest channel and then un-premultiplies,
so edges come out clean rather than milky.

**Brand gold is not a text colour** — `#E6D488` is about 1.4:1 on white. Gold
lettering uses `--gold-ink` (`#7A6413`).

## Branding

Taken from breamchurch.org.uk:

| Token | Value | Use |
|---|---|---|
| `--navy` | `#324158` | Headings, nav, primary buttons, table headers |
| `--gold` | `#E6D488` | The rule under the top bar, tile edges, accents |
| `--gold-ink` | `#7A6413` | Gold-coloured *text*, where contrast matters |
| `--ground` | `#F4F5F7` | The page behind the cards |

The church's site sets everything in Lulo Clean, a geometric all-caps face that
cannot be served here; **Montserrat** is the closest available match and is used
the same way — uppercase, letterspaced, for every heading. Body text is
**Nunito Sans**, which sits where the site's Avenir does.

Body text is 17px minimum. Several of the people using this are in their
seventies and on an iPad, and that is the floor, not a preference.

## How a gap is worked out

There are no placeholder rows. An unfilled place is the **absence** of an
assignment, and the requirement is computed from the roles table at query time —
so changing prayer ministry from 2 to 4 immediately re-scores every existing
service, past and future.

Three things decide whether a role counts for a given service:

- the role is active;
- a **communion-only** role (preside, distribution, communion steward) does not
  exist at all on an ordinary Sunday — it is absent, not unfilled;
- a **per-service override** can switch a role off ("no children's work on
  Christmas Eve") or change its numbers. The service page has a "Not needed here"
  button for this, and a "Put it back" beside anything switched off.

That third one is not a nicety. A one-off service otherwise inherits all fourteen
roles, so the Remembrance act at the Cenotaph reported thirteen unfilled roles
including a sound desk and a tea rota at a war memorial. A gap warning nobody
believes is worse than none at all.

## Where the seed data came from

`September-November 2026.xlsx`, the rota the church runs today. `seed/roster.json`
holds what was extracted: 78 people, the roles each has actually performed, 31
recurring pairs, and 31 observed role combinations.

Three things about that import are worth knowing:

- **19 names are ambiguous** and flagged `needs_review` — the spreadsheet uses
  first names, so "Matt" may be Matt R or Matt W, "Chris L" and "Chris B" are
  different people, and "Shelia" looks like a typo for "Sheila". Anyone still
  flagged is skipped by the generator.
- **The green combination rules are evidence, not policy.** They record what the
  church already does and how often. Service leader + worship leader is both
  observed six times *and* marked amber, because doing a thing is not the same as
  it being ideal. Every combination not listed is left unset on purpose rather
  than guessed at.
- **Pairing is not a spouse field.** Pete serves with both Ruth and Heather, Sue
  with both Sheila and Glenn — so a person may hold several pairings, each
  optionally scoped to one role.

## Design notes

`design-notes/` holds an alternative schema produced during design and not used.
It is kept for reference only; the live schema is `migrations/0001_init.sql`.

## The one piece still missing

Volunteers have no way to sign in. Admins have passwords; nobody else does.

That is not an oversight, it is waiting on a decision. The spreadsheet contains
**no email addresses and no phone numbers at all** — 256 distinct strings, none
with an @ in it — so magic links would need a data-collection exercise before
anybody could log in once, and 60 passwords would turn the rota coordinator into
a helpdesk.

The design that fits is a **personal link**: each volunteer gets a URL that signs
them in, delivered however the church already reaches them — the WhatsApp group,
a printed card, read out over the phone. It is a bearer token, so it is exchanged
for a cookie and redirected away immediately, `Referrer-Policy: no-referrer` is
already set site-wide, and each link is revocable. A volunteer session can only
set their own availability and ask for a swap; it can change nobody else's rota.

## Repeating room bookings

A weekly home group is one **series** plus the individual bookings it created.

The occurrences are real rows rather than a rule expanded when somebody looks.
That means the clash check, the diary, the calendar and the 499 bookings already
imported from Google Calendar all carry on working unchanged, one week can be
moved or cancelled without touching the rest, and the overlap test stays a single
indexed range scan. The cost is that a series has a horizon rather than running
forever — for a church diary that is the right way round, since nobody wants a
room silently held in 2034.

Three behaviours worth knowing, all of them deliberate:

- **A clash removes one date, not the whole series.** A year of Tuesdays should
  not be refused because of one carol concert. The dates it could not take are
  named in the confirmation rather than quietly dropped.
- **A monthly booking on the 31st skips the months that have none**, and says so.
  Sliding it to the 1st would book a different day from the one asked for. The
  same applies to "the 5th Tuesday".
- **Cancelling a series cancels only what is still to come.** Bookings that
  already happened stay, because deleting them would rewrite the diary.

`src/recurrence.ts` holds the date arithmetic and `seed/recurrence-test.ts` its
tests, including both awkward cases above. It is much smaller than the iCalendar
expander in `seed/import-ical.cjs`, which has to cope with whatever Google emits;
this one only handles the four patterns a person can pick from a dropdown.

## Turning on acknowledgement emails

An event can send a confirmation when somebody books. The feature is built and
the wording is editable per event, but **nothing is actually sent until a domain
is onboarded onto Cloudflare Email Sending**, which nobody has done yet.

Until then it degrades rather than breaks: the booking is still recorded, the
outcome is written to `event_bookings.ack_status` as `skipped`, and the event
screen says plainly that acknowledgements are not going out.

To switch it on:

```bash
npx wrangler email sending enable stack66.com
npx wrangler email sending dns get stack66.com   # check the records landed
```

That adds SPF and DKIM records to the zone. **Worth knowing before you run it:**
`stack66.com` also serves `boss.stack66.com`, so this touches DNS on a domain
carrying another production system. It was left for a human to run for that
reason, not because it is hard.

Then add the binding and the sender address:

```jsonc
// wrangler.jsonc
"send_email": [{ "name": "EMAIL" }],
"vars": { "ACK_FROM": "bookings@stack66.com" }
```

and deploy. `src/email.ts` already guards every use of the binding, so the only
change is that sending starts working.

A failed send never loses a booking: the booking is committed first and the send
attempted afterwards, with the result recorded against the row. Somebody who
booked a place has booked it whether or not the mail provider was reachable.

## Generating a rota creates the Sundays

Asking for a draft rota over a range now creates any missing 10:30 Sunday
services first, rather than refusing with "there are no services in that range".
They happen every week whatever anybody does, so making somebody set them up as a
separate step first was busywork.

Three things make that safe:

- **Nothing existing is touched.** The insert is `OR IGNORE` against the
  `(service_date, service_time)` unique index, so a Sunday already renamed to
  "Harvest", moved to communion, or given readings keeps exactly what it has.
  Verified against the live database: a re-run adds nothing and does not
  overwrite a communion service with a plain one.
- **It says what it did.** The preview opens with "13 Sunday services were added
  for you", rather than silently growing the diary.
- **It can be turned off.** A tick on the generate form works only with services
  that already exist.

The services are written before the preview rather than on Apply, because the
generator needs real services to assign to. That is a different thing from
writing the ROTA early: a Sunday service existing is simply true, and an unwanted
one can be removed under Services. The rota itself still writes nothing until
Apply.

`src/services.ts` holds the date logic and `seed/sundays-test.ts` its tests,
including a month that starts on a Sunday and both British Summer Time
boundaries.

## Who can see what

Access is a **profile**: a named set of areas. People are given one, and it
decides which pages open. Four ship with the system — Administrator, Rota
coordinator, Room bookings, Volunteer — and more can be added under
Settings → What people can see without a deploy.

The areas are `rota`, `rota.manage`, `rooms`, `rooms.manage`, `events`,
`events.manage`, `me` and `settings`. The `.manage` ones are the difference
between reading and changing.

Three things are deliberate:

- **One check, not a gate per route.** `requireSignIn` asks `mayAccess()` for
  every request, so a route added later is covered by default. `src/access.ts`
  maps path prefixes to areas, longest match first.
- **Reading never implies writing.** A POST to a path needs the area's `.manage`
  right even where the path itself does not say so — otherwise anyone who could
  see the room diary could edit it by posting to `/app/rooms/42`.
- **The system will not let you lock everybody out.** Removing `settings` from
  the last profile that has it, and that somebody is actually using, is refused.

The menu is filtered against the same set, so nobody is offered a page that will
then turn them away. `seed/access-test.ts` asserts the whole table — every
profile against every path, for reading and for writing.

## Giving somebody a sign-in

Settings → Add a person. Most volunteers do not need one; leave the sign-in box
unticked to add them to the roster only.

Where a sign-in is given, a readable temporary password is generated
(`hazel-orchard-4821` — words and digits, because it gets dictated over the phone
and typed on a tablet) and **shown once**. It is hashed immediately and never
stored in readable form. The account cannot do anything else until it is changed:
every page redirects to the change-password form while `must_change` is set.

If an email address is given and sending is configured, their details are emailed
to them. If the email fails, the password is still on screen and the page says so
— an account is never created with no way to hand it over.

Changing a password requires the current one even on a forced change, so a
session left open on a shared tablet is not enough to take the account over. All
of that person's other sessions are dropped, so a password changed because
somebody else knew it actually locks them out.

## Setting up a role for lots of people at once

Settings → Edit by role asks the question the other way round: pick a role, and
tick everybody who could take it. Fourteen visits instead of sixty-nine.

The whole roster is listed, not only those who already do it — the point of the
screen is to *add* people, and "who could preach?" is answered by looking down
the list of everybody. Those who can do it float to the top so the current
picture reads first, and each person's frequency for that role is editable
inline.

**The safeguard worth knowing about.** An unticked checkbox is not submitted by a
browser at all, so a bulk save cannot tell "somebody unticked this" from
"somebody was never on the page". Every row therefore also submits a hidden
`shown` field, and the save only touches those ids. Without it, a filtered view
would silently strip the role from everybody it did not display. The render test
asserts that field is present, so it cannot be removed by accident.
