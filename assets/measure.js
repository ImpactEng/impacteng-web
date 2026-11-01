

(function () {
  'use strict';
  

  if (navigator.webdriver) return;
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var SAFE = /^[A-Za-z0-9 _.~+-]{1,100}$/; 
  var EXP_ID = 'home_e1', EXP_KEY = 'ie-exp-home';
  var root = document.documentElement;

  function load(area, k) { try { return window[area].getItem(k); } catch (e) { return null; } }
  function save(area, k, v) { try { window[area].setItem(k, v); return true; } catch (e) { return false; } }
  function key(el, attr) { var v = el && el.getAttribute(attr); return v ? String(v).slice(0, 100) : null; }

  

  var utm = {};
  try {
    var query = new URLSearchParams(window.location.search), found = {}, any = false;
    UTM.forEach(function (k) { var v = query.get(k); if (v && SAFE.test(v)) { found[k] = v; any = true; } });
    if (any) { utm = found; save('sessionStorage', 'ie-utm', JSON.stringify(found)); }
    else { utm = JSON.parse(load('sessionStorage', 'ie-utm') || '{}') || {}; }
  } catch (e) { utm = {}; }

  

  var expOn = root.getAttribute('data-exp') === EXP_ID;
  var arm = root.getAttribute('data-exp-arm');
  if (arm !== 'q' && arm !== 'd' && arm !== 'none') {
    arm = load('localStorage', EXP_KEY);
    if (arm !== 'q' && arm !== 'd') arm = null;
  }

  

  var base = typeof window.ieTrack === 'function' ? window.ieTrack : function (name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  };
  var clickProduct = null, formProduct = null, clickDoor = null;
  function door() { var d = load('sessionStorage', 'ie-door'); return d && /^[a-z]{1,20}$/.test(d) ? d : null; }
  function remember(d) { if (d && /^[a-z]{1,20}$/.test(d)) save('sessionStorage', 'ie-door', d); }
  window.ieTrack = function (name, params) {
    try {
      var p = {}, k;
      for (k in utm) if (Object.prototype.hasOwnProperty.call(utm, k)) p[k] = utm[k];
      if (expOn && arm) { p.exp_id = EXP_ID; p.exp_arm = arm; }  
      if (params) for (k in params) if (Object.prototype.hasOwnProperty.call(params, k)) p[k] = params[k];
      if (!p.product && name === 'booking_click' && clickProduct) p.product = clickProduct;
      if (!p.product && name === 'generate_lead' && formProduct) p.product = formProduct;
      if (!p.door && (name === 'booking_click' || name === 'generate_lead')) { var d = (name === 'booking_click' && clickDoor) || door(); if (d) p.door = d; }
      base(name, p);
    } catch (e) {}
  };
  function send(name, params) { window.ieTrack(name, params); }

  

  var started = false;
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      clickProduct = key(t.closest('[data-product]'), 'data-product');
      clickDoor = key(t.closest('[data-door-panel]'), 'data-door-panel');
      setTimeout(function () { clickProduct = null; clickDoor = null; }, 0);
      var dEl = t.closest('[data-door]');
      if (dEl) { var dk = key(dEl, 'data-door'); remember(dk); send('door_click', { door: dk }); }
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

   
  document.addEventListener('submit', function (e) {
    try {
      var f = e.target;
      if (!f || !f.closest) return;
      var df = f.querySelector('input[name="door"]'), dv = door();
      if (df && !df.value && dv) df.value = dv;
      var field = f.querySelector('input[name="product"]');
      formProduct = (field && field.value ? String(field.value).slice(0, 100) : null) ||
        key(f.closest('[data-product]'), 'data-product');
    } catch (err) {}
  }, true);

   
  document.addEventListener('ie:door-tab', function (e) {
    try { var d = e.detail || {}; if (!d.door) return; remember(d.door); send('door_tab', { door: String(d.door).slice(0, 20), via: String(d.via || '').slice(0, 10) }); } catch (err) {}
  });
  document.addEventListener('ie:examples', function (e) {
    try { var s = e.detail && e.detail.state; if (s === 'on' || s === 'off') send('examples_toggle', { state: s }); } catch (err) {}
  });

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    try {
       
      UTM.forEach(function (k) {
        if (!utm[k]) return;
        document.querySelectorAll('input[type="hidden"][name="' + k + '"]').forEach(function (i) {
          if (!i.value) i.value = utm[k];
        });
      });

      if (expOn && arm) send('experiment_exposure', { exp_id: EXP_ID, exp_arm: arm });

      

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
