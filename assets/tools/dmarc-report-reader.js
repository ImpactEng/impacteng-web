

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.dmarcReport;
  if (!T || !L) return;
  var el = T.el;
  var input = document.getElementById('report-file');
  var drop = document.getElementById('report-drop');
  var status = document.getElementById('report-status');
  var results = document.getElementById('report-results');
  var sampleBtn = document.getElementById('report-sample');
  if (!input || !results) return;
  var TOOL = 'dmarc_report';
  var busy = false, lastDomain = '', lastSummary = '', extraFiles = 0;
  var CHIP = { pass: ['pass', 'Passes'], warn: ['warn', 'Mixed'], fail: ['fail', 'Fails'] };

  var SAMPLE = '<?xml version="1.0" encoding="UTF-8"?>\n<feedback>\n' +
    '<report_metadata><org_name>reporter.example</org_name><email>noreply@reporter.example</email><report_id>made-up-0001</report_id><date_range><begin>1790812800</begin><end>1790899199</end></date_range></report_metadata>\n' +
    '<policy_published><domain>example.com</domain><adkim>r</adkim><aspf>r</aspf><p>none</p><sp>none</sp><pct>100</pct></policy_published>\n' +
    rec('198.51.100.10', 120, 'none', 'pass', 'pass', 'example.com', 'example.com') +
    rec('198.51.100.25', 40, 'none', 'fail', 'pass', 'example.com', 'example.com') +
    rec('203.0.113.7', 9, 'none', 'fail', 'fail', 'example.com', 'newsletter.example') +
    rec('192.0.2.99', 6, 'none', 'fail', 'fail', 'example.com', 'unknown.example') +
    '</feedback>';
  function rec(ip, n, disp, dkim, spf, from, authDomain) {
    return '<record><row><source_ip>' + ip + '</source_ip><count>' + n + '</count><policy_evaluated><disposition>' + disp +
      '</disposition><dkim>' + dkim + '</dkim><spf>' + spf + '</spf></policy_evaluated></row><identifiers><header_from>' + from +
      '</header_from></identifiers><auth_results><dkim><domain>' + authDomain + '</domain><result>' + dkim +
      '</result></dkim><spf><domain>' + authDomain + '</domain><result>' + spf + '</result></spf></auth_results></record>\n';
  }

  var HEAD = {
    clean: ['Everything in this report passed DMARC.', 'Every message in this report passed. That is one report from one provider, so it is a start, not proof that every sender is covered.'],
    'senders-failing': ['Some mail sent as your domain failed DMARC.', 'Not all mail passed. The sources below show which. A failing source is often a real service that is not yet set up, not an attacker.'],
    'mostly-spoofed': ['Most mail in this report failed DMARC.', 'More than half the messages failed, and they came from sources where nothing matched your domain. That can be forged mail, or your own services not set up. One report cannot tell which, and I have not looked any source up.'],
    empty: ['This report has no mail in it.', 'It read as a report, but it counts no messages. Open a report from another day.']
  };

  function say(text) { status.textContent = text; }
  function fmtDate(sec) {
    if (!sec || sec > 4102444800) return '';
    return new Date(sec * 1000).toLocaleDateString('en-AU', { dateStyle: 'medium', timeZone: 'UTC' });
  }
  function num(n) { return Number(n).toLocaleString('en-AU'); }
  function safeDomain(d) { return /^[a-z0-9.\-]{1,253}$/.test(d) && d.indexOf('.') > 0 ? d : ''; }

  function senderRow(s) {
    var kind = s.fail === 0 ? 'pass' : s.pass === 0 ? 'fail' : 'warn';
    var share = s.count ? Math.round((s.pass / s.count) * 100) : 0;
    return el('li', { class: 't-check' },
      el('span', { class: 't-chip ' + CHIP[kind][0], text: CHIP[kind][1] }),
      el('h3', {}, s.ip, el('small', { text: num(s.count) + (s.count === 1 ? ' message' : ' messages') + ', ' + share + '% passed' })),
      el('p', { text: s.note }),
      s.domains.length ? el('p', { class: 'muted', text: 'Domains this source named: ' + s.domains.join(', ') }) : null);
  }

  function render(report, sum) {
    var h = HEAD[sum.verdict];
    lastDomain = safeDomain(report.domain);
    lastSummary = ['verdict ' + sum.verdict, 'messages ' + sum.total, 'failing ' + sum.failing, 'sources ' + sum.senders.length,
      'policy p=' + (report.policy.p || 'unknown'), 'ready ' + sum.readyFor].join('; ');
    var readyText = {
      'stay-at-none': report.policy.p && report.policy.p !== 'none' ? 'Do not make your policy stricter yet.' : 'From this report alone, keep your policy at none for now.',
      quarantine: 'From this report alone, a move to quarantine could be reasonable later.',
      reject: report.policy.p === 'quarantine' ? 'From this report alone, little fails. Reject could be the next step after a few more weeks.' : 'From this report alone, little fails. Even so, go to quarantine before reject.',
      hold: 'Keep your policy where it is until every real sender passes.',
      'at-reject': 'Your policy is already at reject. Leave it there.'
    }[sum.readyFor];
    var when = fmtDate(report.begin) ? fmtDate(report.begin) + (fmtDate(report.end) && fmtDate(report.end) !== fmtDate(report.begin) ? ' to ' + fmtDate(report.end) : '') : '';
    var shown = sum.senders.slice(0, 50);
    var strict = report.policy.p === 'quarantine' || report.policy.p === 'reject';
    var pctSet = report.policy.pct && report.policy.pct !== '100';
    var nodes = [];
    nodes.push(el('section', { class: 't-verdict' + (sum.verdict === 'mostly-spoofed' ? ' is-spoofable' : ''), 'aria-labelledby': 'report-head' },
      el('span', { class: 't-domain', text: lastDomain || (report.domain ? 'A domain I cannot show safely' : 'No domain named in the report') }),
      el('h2', { id: 'report-head', tabindex: '-1', text: h[0] }),
      el('p', { text: h[1] }),
      sum.total ? el('p', { class: 't-todo', text: num(sum.passing) + ' of ' + num(sum.total) + ' messages passed (' + Math.round(sum.passing / sum.total * 100) + '%).' }) : null,
      sum.total ? el('p', { text: readyText + (sum.total < 10 ? ' This report has too few messages to judge.' : '') + ' This is judged from one report only. Read a few weeks of reports before you change anything.' }) : null,
      strict && sum.failing ? el('p', { text: 'Receivers acted on ' + num(sum.acted) + ' of the ' + num(sum.failing) + ' failing messages.' + (sum.sampled ? ' Your ' + (pctSet ? 'pct' : 'test mode') + ' setting let ' + num(sum.sampled) + ' of them through without your full policy.' : '') }) : null,
      sum.subdomains.length ? el('p', { text: 'This report also shows mail from: ' + sum.subdomains.join(', ') + '. Check that each is yours before you tighten a policy that covers subdomains.' }) : null,
      sum.total ? el('p', { class: 'muted', text: L.COVERAGE }) : null,
      extraFiles ? el('p', { class: 'muted', text: 'This zip holds ' + extraFiles + ' more report ' + (extraFiles === 1 ? 'file' : 'files') + '. I read only the first, so this result covers that file alone.' }) : null,
      el('p', { class: 't-meta' },
        el('span', { text: 'The report says it is from: ' + (L.orgLabel(report.orgName) || 'a name I cannot show') }),
        when ? el('span', { text: 'Covers: ' + when }) : null,
        el('span', { text: 'Your policy: ' + (report.policy.p || 'not stated') + (pctSet ? ', pct set to ' + report.policy.pct + '%' : '') })),
      pctSet ? el('p', { class: 'muted', text: 'Receivers differ on this percentage: some apply your policy to that share of failing mail, others to all of it.' }) : null));
    if (sum.senders.length) {
      nodes.push(el('details', { class: 't-details', open: true },
        el('summary', { text: 'Who sent mail as your domain (' + sum.senders.length + ')' }),
        el('div', { class: 't-details-body' },
          el('ul', { class: 't-checks' }, shown.map(senderRow)),
          sum.senders.length > shown.length ? el('p', { class: 'muted', text: 'And ' + (sum.senders.length - shown.length) + ' smaller sources not shown.' }) : null,
          el('p', { class: 'muted', text: 'Addresses are shown as the report gives them, if they are valid addresses. I have not looked any up, so I do not say who owns one.' }))));
    }
    if (sum.actions.length) {
      nodes.push(el('details', { class: 't-details' },
        el('summary', { text: 'What to do next' }),
        el('div', { class: 't-details-body' }, el('ul', { class: 'measure' }, sum.actions.map(function (a) { return el('li', { text: a }); })))));
    }
    results.replaceChildren.apply(results, nodes);
    var head = document.getElementById('report-head');
    if (head) head.focus({ preventScroll: false });
    var ids = sum.verdict === 'empty' ? [] : ['explain-to-team'].concat(sum.failing > 0 || report.policy.p === 'none' ? ['dmarc-walkthrough'] : []);
    T.mountRequests({ tool: TOOL, getDomain: function () { return lastDomain; }, getResults: function () { return lastSummary; }, ids: ids });
    return sum.verdict;
  }

  function fail(err) {
    results.replaceChildren();
    lastDomain = ''; lastSummary = '';
    var code = err && err.code;
    say(code && L.MESSAGES[code] ? (err.message || L.MESSAGES[code]) : 'Something went wrong reading that file. Try another report.');
    T.mountRequests({ tool: TOOL, getDomain: function () { return ''; }, getResults: function () { return ''; }, ids: [] });
  }

  function parse(text) {
    L.checkXml(text);
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    var report = L.extract(doc);
    return render(report, L.summarise(report));
  }

  async function run(job) {
    if (busy) return;
    busy = true;
    results.setAttribute('aria-busy', 'true');
    results.replaceChildren();
    say('Reading the file here in your browser...');
    T.track('tool_start', { tool: TOOL });
    try {
      var verdict = await job();
      say('');
      T.track('tool_result', { tool: TOOL, verdict: verdict });
    } catch (err) {
      fail(err);
      T.track('tool_result', { tool: TOOL, verdict: 'unreadable' });
    }
    busy = false;
    results.setAttribute('aria-busy', 'false');
  }

  function openFile(file) {
    if (!file) return;
    run(async function () {
      if (file.size > L.LIMITS.fileBytes) throw new L.ReportError('too-big');
      var bytes = new Uint8Array(await file.arrayBuffer());
      extraFiles = L.zipExtraFiles(bytes, file.name);
      return parse(await L.readToText(bytes, file.name));
    });
  }

  input.addEventListener('change', function () {
    if (input.files && input.files.length > 1) { say('One file at a time, please.'); input.value = ''; return; }
    openFile(input.files && input.files[0]);
    input.value = '';
  });
  if (drop) {
    ['dragenter', 'dragover'].forEach(function (n) {
      drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (n) {
      drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      if (files.length > 1) { say('One file at a time, please.'); return; }
      openFile(files[0]);
    });
  }
  if (sampleBtn) sampleBtn.addEventListener('click', function () { run(async function () { extraFiles = 0; return parse(SAMPLE); }); });
})();
