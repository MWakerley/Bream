-- The church newsletter: who gets it, and the issues themselves.
--
-- SUBSCRIBERS. A separate list from `people` on purpose: the newsletter goes
-- to anybody who asks for it, most of whom will never serve on a rota, and
-- somebody on the rota has not thereby asked for a newsletter.
--
-- Consent is recorded with the row — the words they agreed to and when — so
-- "did this person ask for this?" has an answer. Somebody signing up on the
-- website is 'pending' until they press the button in the email we send them;
-- only 'active' rows are ever sent a newsletter. Unsubscribing DELETES the row:
-- they asked to be taken off, and keeping their address would be keeping it
-- for no purpose they agreed to.
CREATE TABLE newsletter_subscribers (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  name          TEXT,
  status        TEXT    NOT NULL DEFAULT 'pending',
  -- Unguessable. In the confirm link while pending, and in the unsubscribe
  -- link in every newsletter after that.
  token         TEXT    NOT NULL UNIQUE,
  -- 'form': signed up on the website. 'admin': added or imported by the office,
  -- which says it holds their consent.
  source        TEXT    NOT NULL,
  consent_text  TEXT    NOT NULL,
  consent_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  confirmed_at  TEXT,
  added_by      INTEGER REFERENCES people (id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (status IN ('pending', 'active')),
  CHECK (source IN ('form', 'admin'))
);
CREATE INDEX newsletter_subscribers_by_status ON newsletter_subscribers (status, email);

-- An issue. Written as a list of blocks (headline, text, picture, the week
-- ahead), kept as JSON because the order and the mix are the whole point and
-- a table per block type would only make moving one up a page harder.
--
-- The week ahead is read live from the diary while it is a draft, so it keeps
-- up with bookings; on sending, what was shown is frozen into week_snapshot
-- so the archive shows what people actually received.
CREATE TABLE newsletters (
  id             INTEGER PRIMARY KEY,
  title          TEXT    NOT NULL,
  -- First day of the week ahead, 'YYYY-MM-DD'.
  week_from      TEXT    NOT NULL,
  blocks         TEXT    NOT NULL DEFAULT '[]',
  -- Things added by hand to the week ahead, and diary items taken out of it.
  extra_items    TEXT    NOT NULL DEFAULT '[]',
  hidden_items   TEXT    NOT NULL DEFAULT '[]',
  week_snapshot  TEXT,
  status         TEXT    NOT NULL DEFAULT 'draft',
  created_by     INTEGER REFERENCES people (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  test_sent_at   TEXT,
  test_sent_to   TEXT,
  sent_at        TEXT,
  sent_by        INTEGER REFERENCES people (id) ON DELETE SET NULL,
  sent_count     INTEGER NOT NULL DEFAULT 0,
  failed_count   INTEGER NOT NULL DEFAULT 0,
  CHECK (status IN ('draft', 'sending', 'sent'))
);
CREATE INDEX newsletters_by_status ON newsletters (status, updated_at);

-- Who an issue has gone to, so a send that stops part-way can carry on with
-- the people not yet sent to rather than starting again. By subscriber, not
-- address: an unsubscribe deletes the subscriber and these rows with it.
CREATE TABLE newsletter_deliveries (
  newsletter_id INTEGER NOT NULL REFERENCES newsletters (id) ON DELETE CASCADE,
  subscriber_id INTEGER NOT NULL REFERENCES newsletter_subscribers (id) ON DELETE CASCADE,
  status        TEXT    NOT NULL,
  error         TEXT,
  sent_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (newsletter_id, subscriber_id),
  CHECK (status IN ('sent', 'failed'))
);
