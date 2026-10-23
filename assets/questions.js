/* The questions page (start.html; docs/questions-page.md). Progressive enhancement: without
   scripts every question shows and each answer is a plain link. With this script: one question
   at a time, Back between them, then a result with the action for the chosen next step. Each
   answer is recorded on the container as data-<question key> (data-who, data-mind, data-soon,
   data-next) and the route as data-route, beside the data-q and data-a every answer link
   carries, so analytics can read them; the shown result carries data-questions-done with the
   door, which the port's measure.js reads for questions_complete. No analytics code here. Destinations come from the JSON
   block the build writes (#questions-data). */
(function () {
  var box = document.querySelector('[data-questions]');
  var src = document.getElementById('questions-data');
  if (!box || !src) return;
  var D = JSON.parse(src.textContent);
  var steps = [].slice.call(box.querySelectorAll('[data-step]'));
  var result = box.querySelector('[data-result]');
  var trail = [];
  box.classList.add('q-js');

  function show(el, focus) {
    steps.forEach(function (s) { s.hidden = s !== el; });
    result.hidden = el !== result;
    if (focus) { var h = el.querySelector('[data-focus]'); if (h) h.focus(); }
  }
  function valueOf(role) {
    var s = box.querySelector('[data-role="' + role + '"]');
    return s ? box.getAttribute('data-' + s.getAttribute('data-step')) : null;
  }
  function link(href, text, cls, route) {
    var a = document.createElement('a');
    a.href = href; a.textContent = text; a.className = cls;
    if (route) a.setAttribute('data-product', route);
    return a;
  }
  function finish(route) {
    var d = D.routes[route], next = valueOf('step'), acts = result.querySelector('[data-r-actions]');
    box.setAttribute('data-route', route);
    result.setAttribute('data-route', route);
    result.setAttribute('data-questions-done', valueOf('door') || route);
    result.querySelector('[data-r-name]').textContent = d.name;
    result.querySelector('[data-r-line]').textContent = d.line;
    while (acts.firstChild) acts.removeChild(acts.firstChild);
    if (d.only) {
      acts.appendChild(link(d.href, d.see, 'btn', route));
    } else {
      acts.appendChild(next === 'email'
        ? link('mailto:' + D.email + '?subject=' + encodeURIComponent(d.name), D.emailLabel, 'btn', route)
        : link(D.cal, D.book, 'btn', route));
      if (d.href !== D.cal) acts.appendChild(link(d.href, d.see, 'btn ghost'));
      var r = document.createElement('span'); r.className = 'reply'; r.textContent = D.reply;
      acts.appendChild(r);
    }
    show(result, true);
  }
  function choose(step, a) {
    var role = step.getAttribute('data-role'), key = a.getAttribute('data-a');
    box.setAttribute('data-' + step.getAttribute('data-step'), key);
    step.querySelectorAll('[data-a]').forEach(function (x) {
      if (x === a) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
    });
    trail.push(step);
    if (role === 'door' && D.routes[key] && D.routes[key].only) return finish(key);
    var i = steps.indexOf(step);
    if (i + 1 < steps.length) show(steps[i + 1], true); else finish(valueOf('route'));
  }

  steps.forEach(function (s, i) {
    var next = i + 1 < steps.length ? steps[i + 1].id : result.id;
    s.querySelectorAll('[data-a]').forEach(function (a) {
      a.setAttribute('href', '#' + next);  /* an in-page link to what comes next */
      a.addEventListener('click', function (e) { e.preventDefault(); choose(s, a); });
    });
    var back = s.querySelector('[data-back]');
    if (back) {
      back.hidden = false;
      back.addEventListener('click', function () { var prev = trail.pop(); if (prev) show(prev, true); });
    }
  });
  result.querySelector('[data-restart]').addEventListener('click', function () {
    steps.forEach(function (s) { box.removeAttribute('data-' + s.getAttribute('data-step')); });
    box.removeAttribute('data-route'); result.removeAttribute('data-route'); result.removeAttribute('data-questions-done');
    box.querySelectorAll('[aria-current]').forEach(function (x) { x.removeAttribute('aria-current'); });
    trail = [];
    show(steps[0], true);
  });
  show(steps[0], false);
})();
