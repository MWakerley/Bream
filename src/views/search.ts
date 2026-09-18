import { html } from 'hono/html';

/**
 * A search box that filters a list already on the page.
 *
 * The behaviour lives in /assets/search.js so it is fetched once and cached,
 * rather than inlined into every page that wants a box. See that file for why
 * the filtering happens in the browser rather than in SQL.
 *
 * The caller is responsible for two things: giving the container the `target`
 * id, and putting `data-search="..."` on each row with whatever text should
 * match. Anything not in that attribute is not searchable, which is the point —
 * it keeps "Andy" from matching a review note that merely mentions Andy.
 */
export function searchBox(opts: {
  /** id of the element containing the rows to filter. */
  target: string;
  label: string;
  placeholder: string;
  /** What the things being filtered are called, for the running count. */
  noun: string;
  /** A sentence under the box saying what can be matched. */
  hint?: string;
}) {
  const id = `search-${opts.target}`;
  return html`
    <div class="searchbar">
      <label class="search-label" for="${id}">${opts.label}</label>
      ${opts.hint ? html`<span class="hint">${opts.hint}</span>` : ''}
      <div class="search-field">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input id="${id}" type="search" class="search-input"
               placeholder="${opts.placeholder}"
               autocomplete="off" autocapitalize="off" spellcheck="false"
               data-search-target="${opts.target}" data-search-noun="${opts.noun}">
        <button type="button" class="search-clear" id="${id}-clear" hidden>Clear</button>
      </div>
      <p class="search-count" id="${id}-count" role="status" aria-live="polite"></p>
    </div>
  `;
}

