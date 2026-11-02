

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.recordBuilders;
  if (!T || !L) return;
  var el = T.el;
  var domainInput = document.getElementById('domain');
  if (!domainInput) return;
  var started = {}, resulted = {};

  var REASONS = {
    empty: 'Type your domain first, such as yourbusiness.com.au.',
    list: 'One domain at a time. I do not take lists.',
    ip: 'That is an IP address. Type a domain name instead, such as yourbusiness.com.au.',
    localhost: 'That is a private name. Type a public domain, such as yourbusiness.com.au.',
    'single-label': 'That needs a dot in it, such as yourbusiness.com.au.',
    'too-long': 'That name is too long to be a domain.',
    invalid: 'That does not look like a domain. Try yourbusiness.com.au.',
    'shared-mail': 'That is a shared email service, not a domain you run. Type your own domain, such as yourbusiness.com.au.'
  };

  function $(id) { return document.getElementById(id); }
  function words(s) { return String(s || '').split(/[\s,]+/).filter(Boolean); }

  function start(id) {
    if (started[id]) return;
    started[id] = true;
    T.track('tool_start', { tool: 'record_builders' });
  }
  function done(id) {
    if (resulted[id]) return;
    resulted[id] = true;
    T.track('tool_result', { tool: 'record_builders', verdict: id });
  }

   
  function currentDomain(statusEl, id) {
    var n = T.normaliseDomain(domainInput.value), near = $('domain-status');
    if (!n.ok) {
      var message = REASONS[n.reason] || REASONS.invalid;
      statusEl.textContent = message;
      if (near) near.textContent = message;
      $(id + '-out').replaceChildren();
      domainInput.focus();
      return null;
    }
    if (near) near.textContent = '';
    return n.domain;
  }

  function record(lines, copyText, copyLabel) {
    var text = lines.join('\n');
    var pre = el('pre', { class: 't-rec', tabindex: '0', text: text });
    return el('div', { class: 't-rec-row' }, pre, T.copyButton(function () { return copyText; }, { label: copyLabel || 'Copy', target: pre }));
  }

   
  function dnsRecord(rec, type) {
    return record(['Type   ' + (type || 'TXT'), 'Name   ' + rec.host, 'Value  ' + rec.value], rec.value, 'Copy value');
  }

  function show(id, nodes) {
    var out = $(id + '-out');
    out.replaceChildren.apply(out, nodes);
  }
  function fail(id, message) {
    $(id + '-status').textContent = message;
    $(id + '-out').replaceChildren();
  }
  function ok(id) { $(id + '-status').textContent = ''; }

  function bind(id, build) {
    var form = $(id + '-form');
    if (!form) return;
    form.addEventListener('input', function () { start(id); });
    form.addEventListener('change', function () { start(id); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      start(id);
      var r = build();
      if (r) done(id);
    });
     
    form.querySelectorAll('button[type="submit"]').forEach(function (b) { b.disabled = false; });
  }

   
  bind('dmarc', function () {
    var st = $('dmarc-status');
    var domain = currentDomain(st, 'dmarc');
    if (!domain) return false;
    var rua = $('dmarc-rua').value.trim();
    var plan = L.dmarcPlan({ domain: domain, rua: /^mailto:/i.test(rua) ? rua : 'mailto:' + rua });
    if (plan.error) { fail('dmarc', plan.error); return false; }
    ok('dmarc');
    show('dmarc', [el('p', { class: 't-todo', text: plan.subdomains })].concat(plan.stages.map(function (s) {
      return el('div', { class: 't-fix' },
        el('div', { class: 't-fix-head' }, el('span', { text: s.label })),
        el('p', { class: 'muted', text: s.wait }),
        dnsRecord(s));
    })));
    return true;
  });

   
  var senderBox = $('spf-senders');
  if (senderBox) {
    L.SPF_SENDERS.forEach(function (s) {
      var input = el('input', { type: 'checkbox', value: s.id });
      senderBox.appendChild(el('label', { class: 't-consent' }, input,
        el('span', {}, s.label, s.confirmed ? '' : ' (get the line from them)')));
    });
  }
  bind('spf', function () {
    var st = $('spf-status');
    var domain = currentDomain(st, 'spf');
    if (!domain) return false;
    var ids = Array.prototype.map.call(document.querySelectorAll('#spf-senders input:checked'), function (i) { return i.value; });
    var r = L.buildSpf({
      domain: domain, senderIds: ids, extraIncludes: words($('spf-extra').value),
      ip4s: words($('spf-ip4').value), ending: $('spf-ending').value
    });
    if (r.error) { fail('spf', r.error); return false; }
    ok('spf');
    var nodes = [
      el('p', { class: 't-meta' }, el('span', { text: 'At least ' + r.lookupsMin + ' of 10 lookups' }),
        el('span', { text: r.overLimit ? 'Over the limit' : r.lookupsMin ? 'A minimum: each include can use more' : 'Within the limit' })),
      dnsRecord({ host: r.host, value: r.record })
    ];
    r.warnings.forEach(function (w) { nodes.push(el('p', { class: 't-todo', text: w })); });
    ids.forEach(function (id) {
      var s = L.SPF_SENDERS.filter(function (x) { return x.id === id; })[0];
      if (s && s.note) nodes.push(el('p', { class: 'muted', text: s.label + ': ' + s.note }));
    });
    nodes.push(el('p', { class: 'muted', text: 'A domain may have only one SPF record. If you already have one, replace it with this, do not add a second.' }));
    show('spf', nodes);
    return true;
  });

   
  bind('mta-sts', function () {
    var st = $('mta-sts-status');
    var domain = currentDomain(st, 'mta-sts');
    if (!domain) return false;
    var age = $('mta-sts-age').value;
    var r = L.mtaStsKit({
      domain: domain, mxHosts: words($('mta-sts-mx').value), mode: $('mta-sts-mode').value,
      maxAge: age === 'auto' ? undefined : Number(age), id: new Date(), rua: $('mta-sts-rua').value.trim()
    });
    if (r.error) { fail('mta-sts', r.error); return false; }
    ok('mta-sts');
    var nodes = [
      el('div', { class: 't-fix' }, el('div', { class: 't-fix-head' }, el('span', { text: '1. Publish this text record' })), dnsRecord(r.stsTxt)),
      el('div', { class: 't-fix' }, el('div', { class: 't-fix-head' }, el('span', { text: '2. Publish this text record' })), dnsRecord(r.tlsRpt)),
      el('div', { class: 't-fix' }, el('div', { class: 't-fix-head' }, el('span', { text: '3. Put this file on your website' })),
        el('p', { class: 'muted', text: 'It must be served over https at this exact address, from a web host named mta-sts on your domain, with a valid certificate:' }),
        record([r.policyUrl], r.policyUrl, 'Copy address'),
        record(r.policyFile.replace(/\n$/, '').split('\n'), r.policyFile, 'Copy file'))
    ];
    if (r.clamped) nodes.push(el('p', { class: 't-todo', text: 'I cut the policy lifetime to one year, the most the standard allows.' }));
    nodes.push(el('p', { class: 'muted', text: 'Each time you change the file, publish a new id in step 1, or senders keep the old one. Run testing mode first, read the reports, then switch to enforce.' }));
    show('mta-sts', nodes);
    return true;
  });

   
  bind('security-txt', function () {
    var st = $('security-txt-status');
    var opts = {
      contact: words($('sec-contact').value), expires: $('sec-expires').value.trim(),
      encryption: words($('sec-enc').value), preferredLanguages: $('sec-lang').value,
      policy: words($('sec-policy').value), canonical: words($('sec-canon').value)
    };
    var text = L.securityTxt(opts);
    if (typeof text !== 'string') { fail('security-txt', text.error); return false; }
    ok('security-txt');
    var nodes = [record(text.replace(/\n$/, '').split('\n'), text, 'Copy file')];
    L.securityTxtWarnings(opts).forEach(function (w) { nodes.push(el('p', { class: 't-todo', text: w })); });
    nodes.push(el('p', { class: 'muted', text: 'Save it as security.txt and put it on your website at /.well-known/security.txt, served over https. The Expires date is a reminder to look at the file again.' }));
    show('security-txt', nodes);
    return true;
  });

   
  var caBox = $('caa-issuers');
  if (caBox) {
    L.CA_ISSUERS.forEach(function (c) {
      caBox.appendChild(el('label', { class: 't-consent' }, el('input', { type: 'checkbox', value: c.id }), el('span', { text: c.label })));
    });
  }
  bind('caa', function () {
    var st = $('caa-status');
    var domain = currentDomain(st, 'caa');
    if (!domain) return false;
    var ids = Array.prototype.map.call(document.querySelectorAll('#caa-issuers input:checked'), function (i) { return i.value; });
    var wild = $('caa-wild').value;
    var r = L.caaRecords({
      domain: domain, issuers: ids,
      issuewild: wild === 'same' ? undefined : (wild === 'none' ? [] : ids),
      iodef: $('caa-iodef').value.trim()
    });
    if (r.error) { fail('caa', r.error); return false; }
    ok('caa');
    var nodes = r.map(function (rec) { return record(['Type   CAA', 'Name   ' + rec.host, 'Value  ' + rec.value], rec.value, 'Copy value'); });
    nodes.push(el('p', { class: 'muted', text: 'Add one record for each line. If your DNS host asks for flags, tag and value separately, the flag is the first number, the tag is the next word, and the value is the part in quotes.' }));
    L.CAA_NOTES.forEach(function (n) { nodes.push(el('p', { class: 't-todo', text: n })); });
    show('caa', nodes);
    return true;
  });
})();
