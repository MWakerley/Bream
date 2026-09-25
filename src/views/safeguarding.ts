import { html } from 'hono/html';
import { layout, chip, type ViewCtx } from './layout.js';
import { formatDate } from './rota.js';
import { coursesFor, type PersonSafeguarding, type SafeguardingGrid } from '../safeguarding.js';

/**
 * Settings → Safeguarding: which courses each role needs.
 *
 * A grid because that is the question — roles down the side, courses across
 * the top, a tick where one needs the other — and because the whole answer is
 * visible at once, so a gap (a Recruiter needing no recruitment course) is
 * something you can see rather than something you have to go looking for.
 */
export function safeguardingPage(
  grid: SafeguardingGrid,
  ctx: ViewCtx,
  notice?: { tone: 'ok' | 'bad'; text: string },
) {
  return layout(
    {
      title: 'Safeguarding',
      heading: 'Safeguarding',
      intro: 'Which courses each role needs. Tick a role on somebody\'s record under People, '
        + 'and the courses ticked here for that role appear there to be marked as done.',
      back: { href: '/app/settings', label: 'Settings' },
      ...ctx,
    },
    html`
      ${notice ? html`<div class="notice notice-${notice.tone}" role="status"><p style="margin:0">${notice.text}</p></div>` : ''}
      <form method="post" action="/app/settings/safeguarding">
        <div class="table-scroll">
          <table class="grid sg-grid">
            <thead>
              <tr>
                <th>Role</th>
                ${grid.courses.map((c) => html`<th class="sg-course">${c.name}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${grid.roles.map((r) => html`<tr>
                <th scope="row">${r.name}</th>
                ${grid.courses.map((c) => html`<td class="sg-cell">
                  <input type="checkbox" name="req_${r.id}_${c.id}" value="1"
                         ${grid.requires.has(`${r.id}:${c.id}`) ? 'checked' : ''}
                         aria-label="${r.name} needs ${c.name}">
                </td>`)}
              </tr>`)}
            </tbody>
          </table>
        </div>
        <p style="margin-bottom:0">
          <button class="btn-primary" type="submit">Save</button>
        </p>
      </form>
    `,
  );
}

/**
 * The Safeguarding box at the bottom of a person's record.
 *
 * Every course any role could need is rendered, each carrying which roles need
 * it, and shown only while one of those roles is ticked — so ticking
 * "Churchwarden" brings its courses up straight away rather than after a save.
 * Without JavaScript they are all shown, which is untidy but never wrong.
 */
export function personSafeguardingCard(grid: SafeguardingGrid, sg: PersonSafeguarding) {
  if (!grid.roles.length) return '';
  const needed = coursesFor(grid, sg.roleIds);
  const done = needed.filter((c) => sg.courses.get(c.id)?.done === 1).length;
  const anyCourse = coursesFor(grid, grid.roles.map((r) => r.id));

  return html`
    <div class="card" id="safeguarding">
      <h2 style="display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center">Safeguarding
        ${needed.length
          ? done === needed.length
            ? chip('green', `All ${needed.length} course${needed.length === 1 ? '' : 's'} done`)
            : chip('amber', `${done} of ${needed.length} courses done`)
          : ''}
      </h2>
      <p style="color:var(--ink-2);margin-top:0">
        Tick any of these they are. The courses each one needs are set under
        <a href="/app/settings/safeguarding">Settings → Safeguarding</a>.
      </p>
      <div class="checks">
        ${grid.roles.map((r) => html`<label class="check">
          <input type="checkbox" name="sg_role_${r.id}" value="1" class="sg-role" data-role="${r.id}"
                 ${sg.roleIds.includes(r.id) ? 'checked' : ''}>
          <span><span class="check-label">${r.name}</span></span>
        </label>`)}
      </div>

      ${anyCourse.length === 0
        ? html`<p class="hint" style="margin-bottom:0">
            No courses have been set against any role yet, so there is nothing to track.</p>`
        : html`
          <h3 style="margin:1.25rem 0 .25rem">Courses they need</h3>
          <p class="hint sg-none" style="margin-top:0" ${needed.length ? 'hidden' : ''}>
            None of the roles ticked above needs a course.</p>
          <div class="sg-courses">
            ${anyCourse.map((c) => {
              const roles = grid.roles.filter((r) => grid.requires.has(`${r.id}:${c.id}`));
              const state = sg.courses.get(c.id);
              const shown = needed.some((n) => n.id === c.id);
              return html`<fieldset class="sg-course-row" data-roles="${roles.map((r) => r.id).join(',')}"
                    ${shown ? '' : 'hidden'}>
                <legend>
                  <strong>${c.name}</strong>
                  <span class="sg-for">for ${roles.map((r) => r.name).join(', ')}</span>
                </legend>
                <label class="sg-yn"><input type="radio" name="sg_course_${c.id}" value="1"
                  ${state?.done === 1 ? 'checked' : ''}> Done</label>
                <label class="sg-yn"><input type="radio" name="sg_course_${c.id}" value="0"
                  ${state?.done === 0 ? 'checked' : ''}> Not yet</label>
                ${state?.done === 1 && state.done_at
                  ? html`<span class="sg-when">marked done ${formatDate(state.done_at.slice(0, 10))}</span>`
                  : !state ? html`<span class="sg-when">not answered</span>` : ''}
              </fieldset>`;
            })}
          </div>
          <script>
            (function () {
              var box = document.getElementById('safeguarding');
              var ticks = box.querySelectorAll('.sg-role');
              var rows = box.querySelectorAll('.sg-course-row');
              var none = box.querySelector('.sg-none');
              function sync() {
                var on = {};
                for (var i = 0; i < ticks.length; i++) {
                  if (ticks[i].checked) on[ticks[i].getAttribute('data-role')] = true;
                }
                var any = false;
                for (var j = 0; j < rows.length; j++) {
                  var need = rows[j].getAttribute('data-roles').split(',');
                  var show = false;
                  for (var k = 0; k < need.length; k++) if (on[need[k]]) show = true;
                  rows[j].hidden = !show;
                  if (show) any = true;
                }
                if (none) none.hidden = any;
              }
              for (var i = 0; i < ticks.length; i++) ticks[i].addEventListener('change', sync);
            }());
          </script>`}
    </div>`;
}
