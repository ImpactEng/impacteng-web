

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.emailSpoofing;
  if (!T || !L) return;
  var el = T.el;
  var form = document.getElementById('check-form');
  if (!form) return;
  var input = document.getElementById('domain');
  var status = document.getElementById('check-status');
  var results = document.getElementById('check-results');
  var lastDomain = '', lastSummary = '';
  var LABEL = { pass: 'Pass', warn: 'Improve', fail: 'Fix', info: 'Optional' };

  function reset() {
    lastDomain = ''; lastSummary = '';
    T.mountRequests({ tool: 'email_spoofing', getDomain: function () { return ''; }, getResults: function () { return ''; }, ids: [] });
  }

  function say(text) {
    status.replaceChildren(el('span', { class: 't-spin', 'aria-hidden': 'true' }), text);
  }

  function record(text) {
    var pre = el('pre', { class: 't-rec', tabindex: '0', text: text });
    return el('div', { class: 't-rec-row' }, pre, T.copyButton(function () { return text; }, { target: pre }));
  }

  

  function current(text) {
    return el('div', {}, el('p', { class: 'muted', text: 'From public DNS, not from me:' }), el('pre', { class: 't-rec', tabindex: '0', text: text }));
  }

  function fixBlock(r) {
    return el('div', { class: 't-fix' },
      el('div', { class: 't-fix-head' }, el('span', { text: r.fix.label })),
      record(r.fix.value),
      r.after ? el('p', { class: 'muted', text: r.after }) : null);
  }

  function checkRow(r) {
    return el('li', { class: 't-check' },
      el('span', { class: 't-chip ' + r.status, text: LABEL[r.status] }),
      el('h3', {}, r.title, el('small', { text: r.tag })),
      el('p', { text: r.text }),
      current(r.record),
      r.fix ? fixBlock(r) : null);
  }

  function summary(m, v, rows) {
    var parts = ['verdict ' + v.code];
    if (m.dmarc) parts.push('DMARC p=' + (m.dmarc.p || 'invalid') + ' pct=' + m.dmarc.pct);
    else parts.push('DMARC none');
    parts.push('SPF ' + (m.spf.records.length ? m.spf.all + ' lookups=' + m.spf.lookups : 'none'));
    parts.push('DKIM ' + m.dkim.length, 'MTA-STS ' + (m.mtaSts ? 'yes' : 'no'));
    parts.push('fix: ' + rows.filter(function (r) { return r.status === 'fail'; }).map(function (r) { return r.id; }).join(','));
    return parts.join('; ');
  }

  function requestIds(m, v, rows) {
    var ids = [];
    if (v.code === 'no-domain' || v.code === 'unreadable') return ids;
    if (rows.some(function (r) { return r.fix && r.status !== 'pass'; })) ids.push('explain-to-team');
    if (m.sends && (!m.dmarc || m.dmarc.p !== 'reject' || m.dmarc.rua)) ids.push('dmarc-walkthrough');
    ids.push('website-review');
    return ids;
  }

  function render(m) {
    var v = L.verdict(m), rows = L.buildChecks(m);
    lastDomain = m.domain;
    lastSummary = summary(m, v, rows);
    var nodes = [];
    var firstFix = L.firstFix(m, v, rows);
    nodes.push(el('section', { class: 't-verdict' + (v.code === 'spoofable' ? ' is-spoofable' : ''), 'aria-labelledby': 'verdict-head' },
      el('span', { class: 't-domain', text: m.domain }),
      el('h2', { id: 'verdict-head', tabindex: '-1', text: v.head }),
      el('p', { text: v.body }),
      v.todo ? el('p', { class: 't-todo', text: 'First: ' + v.todo }) : null,
      firstFix ? fixBlock(firstFix) : null,
      m.exists ? el('p', { class: 't-meta' },
        el('span', { text: 'Checked ' + m.checkedAt.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) }),
        el('span', { text: 'Mail: ' + m.provider })) : null,
      m.exists ? el('p', { class: 'muted', text: 'This is what your public records say today. It cannot see whether every real sender signs its mail.' }) : null));
    if (rows.length) {
      nodes.push(el('details', { class: 't-details' },
        el('summary', { text: 'Each check (' + rows.length + ')' }),
        el('div', { class: 't-details-body' }, el('ul', { class: 't-checks' }, rows.map(checkRow)))));
    }
    if (rows.some(function (r) { return r.fix; })) {
      var it = L.buildItEmail(m);
      var pre = el('pre', { class: 't-rec', tabindex: '0', text: it.body });
      

      var mail = el('button', { type: 'button', class: 'btn ghost', text: 'Open in my email app' });
      var copy = T.copyButton(function () { return it.body; }, { label: 'Copy the note', target: pre });
      mail.addEventListener('click', function () { window.location.assign(it.mailtoHref); });
      nodes.push(el('details', { class: 't-details' },
        el('summary', { text: 'Note for my IT person' }),
        el('div', { class: 't-details-body' },
          el('p', { class: 'muted', text: 'A plain note with the records to change, for whoever manages your DNS. Read each line before it is published. No IT person? Send it to whoever registered your domain or built your website. Long notes are cut in your email app, so use Copy the note for the full text.' }),
          pre,
          el('div', { class: 't-mail-actions' }, copy, mail),
          el('p', { class: 'muted' }, 'For whoever manages your DNS: the ', el('a', { href: '/tools/record-builders/', text: 'DNS Record Builders' }), ' write these records with more options.'))));
    }
    results.replaceChildren.apply(results, nodes);
    var head = document.getElementById('verdict-head');
    if (head) head.focus({ preventScroll: false });
    T.mountRequests({ tool: 'email_spoofing', getDomain: function () { return lastDomain; }, getResults: function () { return lastSummary; }, ids: requestIds(m, v, rows) });
    return v.code;
  }

  T.mountTool({
    form: form, input: input, status: status, results: results, cancel: document.getElementById('check-cancel'),
    tool: 'email_spoofing', reset: reset,
    run: async function (ctx) {
       
      var dns = T.createDns({ maxQueries: 40, signal: ctx.signal });
      var dkimDns = T.createDns({ maxQueries: L.DKIM_SELECTORS.length, signal: ctx.signal });
      var m = await L.inspect(ctx.domain, dns, dkimDns, say);
      return render(m);
    }
  });
})();
