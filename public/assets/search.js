/* Bream Church — filter a list that is already on the page.

   Client-side on purpose. Sixty-nine people is small enough to send in one go,
   and filtering in the browser is instant; a round trip per keystroke would be
   slower and would lose the caret. The whole list is in the HTML either way, so
   with no JavaScript the page is simply unfiltered rather than broken.

   Rows opt in by carrying data-search="..." with whatever text should match.

   Deliberately plain ES5. These pages get opened on whatever tablet the church
   owns, and a syntax error in a fancier feature would break the filter silently
   on exactly the device that needs it most. */
(function () {
  'use strict';

  function normalise(s) {
    /* Fold case and accents, so "zoe" finds "Zoë" and "OWEN" finds "Owen". */
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function wire(input) {
    if (input.getAttribute('data-search-wired')) return;
    input.setAttribute('data-search-wired', '1');

    var target = document.getElementById(input.getAttribute('data-search-target'));
    if (!target) return;

    var noun = input.getAttribute('data-search-noun') || 'people';
    var count = document.getElementById(input.id + '-count');
    var rows = Array.prototype.slice.call(target.querySelectorAll('[data-search]'));
    var total = rows.length;
    var clear = document.getElementById(input.id + '-clear');

    function apply() {
      var typed = input.value.trim();
      var q = normalise(typed);
      var shown = 0;
      for (var i = 0; i < rows.length; i++) {
        var hit = q === '' || normalise(rows[i].getAttribute('data-search')).indexOf(q) !== -1;
        rows[i].hidden = !hit;
        if (hit) shown++;
      }
      if (clear) clear.hidden = typed === '';
      if (!count) return;
      if (typed === '') {
        count.textContent = total + ' ' + noun;
        count.className = 'search-count';
      } else if (shown === 0) {
        count.textContent = 'Nobody matches “' + typed + '”';
        count.className = 'search-count search-count-none';
      } else {
        count.textContent = 'Showing ' + shown + ' of ' + total + ' ' + noun;
        count.className = 'search-count';
      }
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      /* Escape clears, which is what a search box is expected to do. Enter is
         swallowed because several of these boxes sit inside a form that saves
         the whole list, and a stray Enter must not submit it. */
      if (e.key === 'Escape' || e.keyCode === 27) { input.value = ''; apply(); }
      if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); }
    });
    if (clear) {
      clear.addEventListener('click', function () {
        input.value = '';
        apply();
        input.focus();
      });
    }
    apply();
  }

  function scan() {
    var boxes = document.querySelectorAll('[data-search-target]');
    for (var i = 0; i < boxes.length; i++) wire(boxes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
}());
