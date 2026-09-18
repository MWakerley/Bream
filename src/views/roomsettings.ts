import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';

export interface RoomSettingRow {
  id: number;
  name: string;
  capacity: number | null;
  notes: string | null;
  sort_order: number;
  is_active: number;
  /** Bookings still to come, which decides whether it is safe to retire. */
  upcoming: number;
  total: number;
}

export function roomSettingsPage(opts: {
  rooms: RoomSettingRow[];
  ctx: ViewCtx;
  notice?: { tone: 'ok' | 'bad'; text: string };
}) {
  const { rooms, ctx, notice } = opts;
  return layout(
    {
      title: 'Rooms',
      eyebrow: 'Settings',
      heading: 'Rooms',
      intro: 'The spaces that can be booked. Rename them to match what people actually call '
        + 'them, and add any that are missing.',
      back: { href: '/app/rooms', label: 'Room booking' },
      ...ctx,
    },
    html`
      ${notice
        ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>`
        : ''}

      <div class="notice notice-info">
        <p style="margin:0">
          Renaming a room is safe — every booking already in the diary follows the name, because
          bookings point at the room rather than storing its name. Taking a room
          <strong>out of use</strong> keeps its history and stops it being offered for anything
          new; it is the right way to retire a space, rather than deleting it.
        </p>
      </div>

      <form method="post" action="/app/settings/rooms">
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr><th>Name</th><th class="num">Holds</th><th>Note</th>
                  <th class="num">Bookings</th><th>In use</th></tr>
            </thead>
            <tbody>
              ${rooms.map(
                (r) => html`<tr>
                  <td>
                    <input type="text" name="name_${r.id}" value="${r.name}"
                           aria-label="Name of ${r.name}" required>
                  </td>
                  <td>
                    <input type="number" name="capacity_${r.id}" value="${r.capacity ?? ''}"
                           min="1" max="2000" style="width:6rem" placeholder="—"
                           aria-label="Capacity of ${r.name}">
                  </td>
                  <td>
                    <input type="text" name="notes_${r.id}" value="${r.notes ?? ''}"
                           aria-label="Note about ${r.name}">
                  </td>
                  <td class="num">
                    ${r.upcoming} <span style="color:var(--ink-2)">to come, ${r.total} total</span>
                  </td>
                  <td>
                    <label class="check" style="padding:.4rem .6rem">
                      <input type="checkbox" name="active_${r.id}" value="1" ${r.is_active ? 'checked' : ''}
                             aria-label="${r.name} is in use">
                      <span class="check-label" style="font-size:.9375rem">Yes</span>
                    </label>
                    ${!r.is_active && r.upcoming > 0
                      ? html`<div style="margin-top:.3rem">${chip('amber', `${r.upcoming} still booked`)}</div>`
                      : ''}
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>
        <p style="margin-top:1rem">
          <button class="btn-primary" type="submit">Save all rooms</button>
        </p>
      </form>

      <h2 class="section-h2">Add a room</h2>
      <form method="post" action="/app/settings/rooms/new" class="card">
        <div class="grid-fields grid-3">
          <div class="field">
            <label for="new_name">What is it called</label>
            <span class="hint">What people say, e.g. "Vestry" or "Upstairs room".</span>
            <input id="new_name" name="name" type="text" required>
          </div>
          <div class="field">
            <label for="new_capacity">Roughly how many it holds</label>
            <span class="hint">Optional.</span>
            <input id="new_capacity" name="capacity" type="number" min="1" max="2000">
          </div>
          <div class="field">
            <label for="new_notes">Anything worth knowing</label>
            <span class="hint">Optional — where it is, what is in it.</span>
            <input id="new_notes" name="notes" type="text">
          </div>
        </div>
        <button class="btn-primary" type="submit">Add this room</button>
      </form>
    `,
  );
}
