/* ImpactEng site behaviour: theme toggle, mobile menu sheet, the blog page's view switch, copy buttons, toggletip, contact and offer forms. */
(function () {
  var root = document.documentElement;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* theme */
  var saved = load('ie-theme');
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  function effectiveTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store('ie-theme', next);
    });
  });

  /* menu sheet */
  var sheet = document.getElementById('menu-sheet');
  var openers = document.querySelectorAll('[data-menu-open]');
  var lastFocus = null;
  function openMenu() { if (!sheet) return; lastFocus = document.activeElement; sheet.hidden = false; document.body.style.overflow = 'hidden'; var c = sheet.querySelector('[data-menu-close]'); if (c) c.focus(); }
  function closeMenu() { if (!sheet) return; sheet.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  openers.forEach(function (b) { b.addEventListener('click', openMenu); });
  if (sheet) {
    sheet.querySelectorAll('[data-menu-close]').forEach(function (b) { b.addEventListener('click', closeMenu); });
    sheet.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeMenu(); });
  }

  /* The blog page's two views: a pair of links (#dated, #ideas) over two panels. Without scripts
     the hash picks the view through CSS :target (brand.css, .views); here the switch swaps the
     panels in place, marks the pressed link, keeps the hash in the URL without scrolling, and
     follows the hash on back and forward. A thread deep link (#thread-<key>) opens the thread
     view. measure.js counts the switch from the same click (view_switch). */
  var views = document.querySelector('[data-views]');
  if (views) {
    var viewLinks = views.querySelectorAll('[data-view]'), panels = views.querySelectorAll('[data-view-panel]');
    var showView = function (name) {
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-view-panel') !== name; });
      viewLinks.forEach(function (a) { a.setAttribute('aria-pressed', a.getAttribute('data-view') === name ? 'true' : 'false'); });
      views.setAttribute('data-view-on', name);
    };
    var viewFromHash = function () {
      var h = window.location.hash;
      return h === '#ideas' || h.indexOf('#thread-') === 0 ? 'ideas' : 'dated';
    };
    showView(viewFromHash());
    viewLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var name = a.getAttribute('data-view');
        showView(name);
        if (window.location.hash !== '#' + name) {
          try { history.pushState(null, '', '#' + name); } catch (err) { window.location.hash = name; }
        }
      });
      a.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); a.click(); } });
    });
    window.addEventListener('hashchange', function () { showView(viewFromHash()); });
  }

  /* Post tables: each cell gets its column heading as data-label, which brand.css shows above the
     cell when a narrow screen stacks the rows as cards. */
  document.querySelectorAll('.essay-sec table').forEach(function (t) {
    var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    t.querySelectorAll('tbody tr').forEach(function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); });
    });
  });

  /* copy buttons */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { selectFallback(btn, text); });
      } else { selectFallback(btn, text); }
    });
  });
  function selectFallback(btn, text) {
    var target = document.getElementById(btn.getAttribute('aria-controls') || '');
    if (target && window.getSelection) {
      var r = document.createRange(); r.selectNodeContents(target);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }

  /* toggletips (principle 1's hover line on the home page, each product's What's covered on the
     services page, and the hover proofs), WCAG 2.1 SC 1.4.13: each opens on
     pointer hover, on keyboard focus and on tap; it stays while the pointer is over the line or
     the tip (a short delay lets the pointer cross the gap between them); a tap or click pins it
     open; Escape or its Close button dismisses it. */
  document.querySelectorAll('[data-tt]').forEach(function (w) {
    var btn = w.querySelector('.tt-btn'), tip = w.querySelector('.tt-tip'), close = w.querySelector('.tt-x');
    var pinned = false, quiet = false, timer = null;
    function show() { clearTimeout(timer); tip.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    function hide() { clearTimeout(timer); tip.hidden = true; btn.setAttribute('aria-expanded', 'false'); pinned = false; }
    w.addEventListener('mouseenter', show);
    w.addEventListener('mouseleave', function () {
      if (pinned || w.contains(document.activeElement)) return;
      timer = setTimeout(hide, 300);
    });
    btn.addEventListener('focus', function () { if (!quiet) show(); });
    w.addEventListener('focusout', function (e) { if (!pinned && !w.contains(e.relatedTarget)) hide(); });
    btn.addEventListener('click', function () { if (pinned) { hide(); } else { pinned = true; show(); } });
    close.addEventListener('click', function () { hide(); quiet = true; btn.focus(); quiet = false; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !tip.hidden) hide(); });
  });

  /* Formspree forms (the contact form, and the short form beside each offer): progressive
     enhancement over the form's action; without scripts the form posts as normal. A sent form
     records generate_lead and a failed one form_error, through window.ieTrack where the page
     defines it (the Jekyll site's lead-events.html, wrapped by measure.js; absent here, so
     nothing is sent): form "short_form" with the product from the form's data-product for an
     offer's short form, "contact" for any other. */
  function track(name, params) { try { if (typeof window.ieTrack === 'function') window.ieTrack(name, params); } catch (e) {} }
  document.querySelectorAll('form[data-formspree]').forEach(function (form) {
    var product = form.getAttribute('data-product');
    var lead = product ? { form: 'short_form', product: product } : { form: 'contact' };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('.form-status');
      var btn = form.querySelector('button[type="submit"]');
      if (form.querySelector('[name="_gotcha"]').value) return;
      btn.disabled = true; status.hidden = false; status.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('bad status'); form.reset(); status.textContent = 'Sent. I reply within one business day.'; track('generate_lead', lead); })
        .catch(function () { status.textContent = 'The form could not send from here. Email nitin@impacteng.com.au instead.'; track('form_error', { form: lead.form }); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
