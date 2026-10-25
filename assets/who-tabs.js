/* Who it's for, on the services page (owner, 2026-10-24, on test): three tabs, one per home page
   door. Without this script every panel shows in turn. The technology leader opens by default; a
   link to /services/#for-business-owners (or another panel id) opens that tab instead. Arrow keys
   move between tabs, as the WAI-ARIA tabs pattern expects. */
(function () {
  var root = document.querySelector('[data-who]');
  if (!root) return;
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
  /* The path walks once per panel, the first time that panel's steps come into view. */
  var walked = {}, watched = {};
  function walk(panel) {
    var ol = panel && panel.querySelector('.who-steps');
    if (!ol || walked[panel.id] || watched[panel.id] || panel.hidden) return;
    watched[panel.id] = true;
    if (!('IntersectionObserver' in window)) { walked[panel.id] = true; ol.classList.add('is-walking'); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !walked[panel.id]) { walked[panel.id] = true; ol.classList.add('is-walking'); io.disconnect(); }
      });
    }, { threshold: 0.6 });
    io.observe(ol);
  }
  function tell(name, detail) { try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {} }
  function select(i, focus, via) {
    tabs.forEach(function (t, j) {
      var on = j === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
    walk(panels[i]);
    if (via) tell('ie:door-tab', { door: tabs[i].getAttribute('data-door-tab'), via: via });
  }
  root.classList.add('is-tabbed');
  /* Examples switch (owner, 2026-10-24, on test): off by default, remembered per visitor. */
  var eg = root.querySelector('.who-eg-toggle');
  if (eg) {
    var on = false;
    try { on = localStorage.getItem('ie-who-examples') === 'on'; } catch (e) {}
    var setEg = function (v) {
      on = v; eg.setAttribute('aria-pressed', v ? 'true' : 'false');
      root.classList.toggle('eg-off', !v);
      try { localStorage.setItem('ie-who-examples', v ? 'on' : 'off'); } catch (e) {}
    };
    eg.hidden = false; setEg(on);
    eg.addEventListener('click', function () { setEg(!on); tell('ie:examples', { state: on ? 'on' : 'off' }); });
  }
  var start = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
  var fromHash = panels.findIndex(function (p) { return '#' + p.id === location.hash; });
  select(fromHash >= 0 ? fromHash : Math.max(start, 0), false, fromHash >= 0 ? 'link' : null);
  /* After the browser's own jump to the panel, bring the tabs into view so the other two show. */
  if (fromHash >= 0) window.addEventListener('load', function () { setTimeout(function () { root.scrollIntoView(); }, 0); });
  window.addEventListener('hashchange', function () {
    var i = panels.findIndex(function (p) { return '#' + p.id === location.hash; });
    if (i >= 0) { select(i, false, 'link'); root.scrollIntoView(); }
  });
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i, false, 'click'); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length;
      if (k === 'ArrowRight') { e.preventDefault(); select((i + 1) % n, true, 'key'); }
      else if (k === 'ArrowLeft') { e.preventDefault(); select((i - 1 + n) % n, true, 'key'); }
      else if (k === 'Home') { e.preventDefault(); select(0, true, 'key'); }
      else if (k === 'End') { e.preventDefault(); select(n - 1, true, 'key'); }
    });
  });
})();
