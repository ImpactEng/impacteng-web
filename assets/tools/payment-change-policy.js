

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.paymentPolicy;
  if (!T || !L) return;
  var form = document.getElementById('policy-form');
  if (!form) return;
  var out = document.getElementById('policy-output');
  var status = document.getElementById('policy-status');
  var started = false;
  var FIELDS = ['businessName', 'approver', 'callback', 'threshold', 'watchDays'];

  function val(name) {
    var f = form.elements[name];
    if (!f) return '';
    if (f.length !== undefined && !f.tagName) { for (var i = 0; i < f.length; i++) if (f[i].checked) return f[i].value; return ''; }
    return f.value;
  }
  function showErrors(errors) {
    FIELDS.forEach(function (k) {
      var m = document.getElementById('err-' + k);
      if (m) m.textContent = errors[k] || '';
      var f = form.elements[k];
      if (f && f.setAttribute && errors[k]) f.setAttribute('aria-invalid', 'true');
      else if (f && f.removeAttribute) f.removeAttribute('aria-invalid');
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = {};
    FIELDS.forEach(function (k) { input[k] = val(k); });
    var r = L.validate(input);
    showErrors(r.errors);
    if (!r.ok) {
      status.textContent = 'Fix the fields marked below, then press Build my policy.';
      out.replaceChildren();
      var first = FIELDS.filter(function (k) { return r.errors[k]; })[0];
      var f = form.elements[first];
      if (f && f.focus) f.focus(); else if (f && f[0]) f[0].focus();
      return;
    }
    if (!started) { started = true; T.track('tool_start', { tool: 'payment_policy' }); }
    var p = L.buildPolicy(r.value, { today: new Date() });
    var pre = T.el('pre', { class: 't-rec t-policy', tabindex: '0', text: p.text });
    var copy = T.copyButton(function () { return p.text; }, { label: 'Copy the policy', target: pre });
    out.replaceChildren(
      T.el('h2', { id: 'policy-head', tabindex: '-1', text: 'Your policy is ready' }),
      T.el('p', { class: 'muted', text: 'Read it through, change anything that does not fit how you work, then share it with your team.' }),
      pre,
      T.el('div', { class: 'actions' }, copy),
      T.el('p', { class: 't-print-line muted', text: 'To print: copy the text into a document, or use your browser\'s print command on this page.' }));
    status.textContent = 'Policy built.';
    var h = document.getElementById('policy-head');
    if (h) h.focus();
    T.track('tool_result', { tool: 'payment_policy', verdict: 'generated' });
  });
   
  var go = form.querySelector('button[type="submit"]');
  if (go) go.disabled = false;
})();
