/* ImpactEng measurement: campaign tags, product, door, questions and blog view events, and the
   home page experiment, sent to GA4.

   Loaded from the head with defer, after lead-events.html (inline; it defines window.ieTrack)
   and the inline script that draws the home page experiment's arm, so it runs once the page is
   parsed, before DOMContentLoaded and before site.js and the per-page scripts, which are
   deferred after it. Every page's own events are sent on user actions, never while parsing, so
   they all pass through the wrapper below. Every event goes through ieTrack, so nothing is sent
   wherever gtag is absent (every build but production), and nothing here throws. No personal
   data in any event: only keys the site writes into data attributes, and campaign tags that pass
   a strict character check. Names follow the existing events (booking_click, generate_lead,
   form_error, tool_start, tool_complete): snake case, plain nouns for parameters. Event list and
   reasons: docs/maintainers/experiments.md.

   The page markup talks to this file through data attributes only:
     data-product="key"          a product block; product_view when half of it is on screen;
                                 booking_click and generate_lead from inside it carry the key
                                 (a form's hidden input name="product" wins for generate_lead)
     data-covered                wraps a product's "What's covered" toggletip; covered_open when
                                 a control inside it gets aria-expanded="true"
     data-door="key"             a door; door_click on click
     data-questions-link         the home page's questions link; questions_click on click, and
                                 hidden in the experiment's "d" arm
     data-questions              the questions page's container, holding:
       data-q="key" data-a="key"     an answer control; questions_start on the first click,
                                     questions_answer on each
       data-questions-done="door"    present and not hidden once the page has routed the
                                     visitor; questions_complete with that door, and the
                                     route from data-route on the same element
     data-view="dated|ideas"     one of the blog page's view links; view_switch with that view on
                                 a click that changes the view (a click on the pressed one is not
                                 a switch), so once per switch
     input type=hidden name=utm_*    filled with the stored campaign tags
     <html data-exp="home_e1">   set by the layout from the home page's front matter
                                 `experiment: home_e1`; switches the experiment on
     <html data-exp-arm="q|d|none">  set by head.html's inline script on the home page: the arm it
                                 drew, or "none" when storage is blocked */
(function () {
  'use strict';
  /* Automated browsers (navigator.webdriver) get no measurement at all: no campaign tags kept, no
     observers, no events. Their page views are not counted either (google-analytics.html). */
  if (navigator.webdriver) return;
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var SAFE = /^[A-Za-z0-9 _.~+-]{1,100}$/; // no @, slash or colon: an email or URL never passes
  var EXP_ID = 'home_e1', EXP_KEY = 'ie-exp-home';
  var root = document.documentElement;

  function load(area, k) { try { return window[area].getItem(k); } catch (e) { return null; } }
  function save(area, k, v) { try { window[area].setItem(k, v); return true; } catch (e) { return false; } }
  function key(el, attr) { var v = el && el.getAttribute(attr); return v ? String(v).slice(0, 100) : null; }

  /* Campaign tags: taken from the landing URL and kept for the tab's session. A later URL with
     tags of its own replaces them. */
  var utm = {};
  try {
    var query = new URLSearchParams(window.location.search), found = {}, any = false;
    UTM.forEach(function (k) { var v = query.get(k); if (v && SAFE.test(v)) { found[k] = v; any = true; } });
    if (any) { utm = found; save('sessionStorage', 'ie-utm', JSON.stringify(found)); }
    else { utm = JSON.parse(load('sessionStorage', 'ie-utm') || '{}') || {}; }
  } catch (e) { utm = {}; }

  /* The experiment: the questions link on ("q") or off ("d") on the home page, 50/50 per
     browser. The arm is drawn by the inline script in _includes/head.html, before the body
     renders, so the "d" arm never sees the link flash; it is left on <html data-exp-arm>
     ("none" when storage is blocked: the link shows, and the analysis leaves the browser out).
     Other pages only read a stored arm, so their events carry it too. */
  var expOn = root.getAttribute('data-exp') === EXP_ID;
  var arm = root.getAttribute('data-exp-arm');
  if (arm !== 'q' && arm !== 'd' && arm !== 'none') {
    arm = load('localStorage', EXP_KEY);
    if (arm !== 'q' && arm !== 'd') arm = null;
  }

  /* Every event through ieTrack gains the campaign tags and the arm; booking_click and
     generate_lead gain the product they came from. */
  var base = typeof window.ieTrack === 'function' ? window.ieTrack : function (name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  };
  var clickProduct = null, formProduct = null;
  window.ieTrack = function (name, params) {
    try {
      var p = {}, k;
      for (k in utm) if (Object.prototype.hasOwnProperty.call(utm, k)) p[k] = utm[k];
      if (arm) { p.exp_id = EXP_ID; p.exp_arm = arm; }
      if (params) for (k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      if (!p.product && name === 'booking_click' && clickProduct) p.product = clickProduct;
      if (!p.product && name === 'generate_lead' && formProduct) p.product = formProduct;
      base(name, p);
    } catch (e) {}
  };
  function send(name, params) { window.ieTrack(name, params); }

  /* Clicks, in the capture phase so the product is known before lead-events.html sends
     booking_click from the same click. */
  var started = false;
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      clickProduct = key(t.closest('[data-product]'), 'data-product');
      setTimeout(function () { clickProduct = null; }, 0);
      var door = t.closest('[data-door]');
      if (door) send('door_click', { door: key(door, 'data-door') });
      if (t.closest('[data-questions-link]')) send('questions_click');
      var view = t.closest('[data-view]');
      if (view && view.getAttribute('aria-pressed') !== 'true') send('view_switch', { view: key(view, 'data-view') });
      var answer = t.closest('[data-q][data-a]');
      if (answer && answer.closest('[data-questions]')) {
        if (!started) { started = true; send('questions_start'); }
        send('questions_answer', { question: key(answer, 'data-q'), answer: key(answer, 'data-a') });
      }
    } catch (err) {}
  }, true);

  /* The product a form was sent from, for the generate_lead its page script sends on success. */
  document.addEventListener('submit', function (e) {
    try {
      var f = e.target;
      if (!f || !f.closest) return;
      var field = f.querySelector('input[name="product"]');
      formProduct = (field && field.value ? String(field.value).slice(0, 100) : null) ||
        key(f.closest('[data-product]'), 'data-product');
    } catch (err) {}
  }, true);

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    try {
      /* Hidden form fields named after the tags. */
      UTM.forEach(function (k) {
        if (!utm[k]) return;
        document.querySelectorAll('input[type="hidden"][name="' + k + '"]').forEach(function (i) {
          if (!i.value) i.value = utm[k];
        });
      });

      if (expOn && arm) send('experiment_exposure', { exp_id: EXP_ID, exp_arm: arm });

      /* product_view: once per product per page view, when half the block is on screen. Only
         the outermost data-product element counts, so a booking link inside a block that
         repeats its key is not a second block. */
      var viewed = {};
      var blocks = [].filter.call(document.querySelectorAll('[data-product]'), function (el) {
        return !(el.parentElement && el.parentElement.closest('[data-product]'));
      });
      if (blocks.length && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.intersectionRatio < 0.5) return;
            var k = key(en.target, 'data-product');
            io.unobserve(en.target);
            if (k && !viewed[k]) { viewed[k] = true; send('product_view', { product: k }); }
          });
        }, { threshold: [0.5] });
        blocks.forEach(function (el) { io.observe(el); });
      }

      /* covered_open: once per product per page view. The toggletip opens on hover as well as
         on tap, so counting every opening would count pointers passing over it. */
      if (document.querySelector('[data-covered]') && 'MutationObserver' in window) {
        var opened = {};
        new MutationObserver(function (records) {
          records.forEach(function (r) {
            var t = r.target;
            if (t.getAttribute('aria-expanded') !== 'true' || !t.closest('[data-covered]')) return;
            var k = key(t.closest('[data-product]'), 'data-product');
            if (k && !opened[k]) { opened[k] = true; send('covered_open', { product: k }); }
          });
        }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
      }

      /* questions_complete: once, after an answer in this page view, when the routed result is
         shown. A report opened from a saved link is not a completion. */
      var qroot = document.querySelector('[data-questions]');
      if (qroot && 'MutationObserver' in window) {
        var done = false;
        new MutationObserver(function () {
          if (done || !started) return;
          var el = qroot.querySelector('[data-questions-done]');
          if (el && !el.closest('[hidden]')) {
            done = true;
            send('questions_complete', { door: key(el, 'data-questions-done'), route: key(el, 'data-route') });
          }
        }).observe(qroot, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-questions-done'] });
      }
    } catch (err) {}
  });
}());
