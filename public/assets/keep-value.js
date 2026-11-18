/*
 * Keeps a box's value away from the browser's password manager.
 *
 * Some boxes describe somebody ELSE — the username being given to a volunteer,
 * their email, their name. Chrome's password manager fills such a box with the
 * signed-in administrator's own saved login, and ignores autocomplete="off"
 * while doing it, so the volunteer was being given the administrator's email.
 *
 * Any input marked data-keep-value goes back to the value the page was sent
 * with whenever it changes without anybody typing, pasting or dropping into
 * it. A person can still change it freely; only the browser cannot.
 *
 * Plain ES5, as search.js is, for the oldest iPad in the building.
 */
(function () {
  var boxes = document.querySelectorAll('input[data-keep-value]');
  if (!boxes.length) return;

  function guard(box) {
    var touched = false;
    function mark() { touched = true; }
    function restore() {
      if (!touched && box.value !== box.defaultValue) box.value = box.defaultValue;
    }
    box.addEventListener('keydown', mark);
    box.addEventListener('paste', mark);
    box.addEventListener('drop', mark);
    box.addEventListener('cut', mark);
    // Autofill arrives as input/change with no key pressed. Restored a moment
    // later, after the browser has finished writing.
    box.addEventListener('input', function () { setTimeout(restore, 0); });
    box.addEventListener('change', function () { setTimeout(restore, 0); });
    // Autofill on page load can come without any event at all.
    setTimeout(restore, 100);
    setTimeout(restore, 600);
    setTimeout(restore, 1500);
  }

  for (var i = 0; i < boxes.length; i++) guard(boxes[i]);
})();
