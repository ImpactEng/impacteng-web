

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.lookalikeDomain;
  if (!T || !L) return;
  var el = T.el;
  var form = document.getElementById('check-form');
  if (!form) return;
  var input = document.getElementById('domain');
  var status = document.getElementById('check-status');
  var results = document.getElementById('check-results');
  var lastDomain = '', lastSummary = '';
  var KIND = { tld: 'other ending', typo: 'typo', swap: 'swapped letters', homoglyph: 'lookalike characters' };

  function reset() {
    lastDomain = ''; lastSummary = '';
    T.mountRequests({ tool: 'lookalike_domain', getDomain: function () { return ''; }, getResults: function () { return ''; }, ids: [] });
  }

  function say(text) {
    status.replaceChildren(el('span', { class: 't-spin', 'aria-hidden': 'true' }), text);
  }

  function listText(items) {
    return items.map(function (x) { return x.domain; }).join('\n');
  }

  function group(title, note, items) {
    if (!items.length) return null;
    var pre = el('pre', { class: 't-rec', tabindex: '0', text: items.map(function (x) { return x.domain + '   (' + KIND[x.kind] + ')'; }).join('\n') });
    return el('div', { class: 't-fix' },
      el('div', { class: 't-fix-head' }, el('span', { text: title + ' (' + items.length + ')' })),
      el('p', { class: 'muted', text: note }),
      pre);
  }

  function head(s) {
    if (s.verdict === 'mail-ready') {
      return {
        h: s.mailReady === 1 ? 'One lookalike has mail servers set up' : s.mailReady + ' lookalikes have mail servers set up',
        p: (s.mailReady === 1 ? 'This name is registered and can receive email.' : 'These names are registered and can receive email.') + ' That is the set-up used in invoice fraud, where someone emails your customers or suppliers from a name that looks like yours.',
        todo: 'Tell whoever pays your invoices to confirm any changed bank details by phone, using a number you already hold.'
      };
    }
    if (s.verdict === 'registered') {
      return {
        h: (s.webOnly === 1 ? 'One lookalike is registered' : s.webOnly + ' lookalikes are registered') + (s.mailUnread ? '' : ', with no mail set up'),
        p: s.mailUnread ? 'Each has a website address.' : 'Each has a website address but no mail servers in its public records today. That can change.',
        todo: ''
      };
    }
    return {
      h: s.unknownCount ? 'I found no active lookalikes among the names I could check' : 'I found no active lookalikes among the names I tried',
      p: 'None of the ' + (s.checkedCount - s.unknownCount) + ' names I could check has a website address or mail servers in public records today. A name can be registered with neither, and I only try a fixed set of likely slips, so this is not a full search.',
      todo: ''
    };
  }

  function requestIds(s) {
    var ids = [];
    if (s.listed.length) ids.push('explain-to-team');
    ids.push('website-review');
    return ids;
  }

  function render(ctx, s, base) {
    lastDomain = base;
    lastSummary = 'verdict ' + s.verdict + '; registered ' + s.listed.length + '; mail-ready ' + s.mailReady + '; tried ' + s.checkedCount + '; not checked ' + s.unknownCount +
      (s.listed.length ? '; ' + s.listed.map(function (x) { return x.domain + (x.mx ? ' mx' : ''); }).join(', ') : '');
    var h = head(s), nodes = [];
    nodes.push(el('section', { class: 't-verdict' + (s.verdict === 'mail-ready' ? ' is-spoofable' : ''), 'aria-labelledby': 'verdict-head' },
      el('span', { class: 't-domain', text: 'Lookalikes of ' + base }),
      el('h2', { id: 'verdict-head', tabindex: '-1', text: h.h }),
      el('p', { text: h.p }),
      h.todo ? el('p', { class: 't-todo', text: h.todo }) : null,
      el('p', { class: 'muted', text: 'A registered lookalike is not always a threat. It may be someone else\'s real business, or one you registered yourself.' }),
      s.unknownCount ? el('p', { class: 'muted', text: s.unknownCount + ' of ' + s.checkedCount + ' names could not be checked, so they are not counted either way.' }) : null,
      s.mailUnread ? el('p', { class: 'muted', text: s.mailUnread + (s.mailUnread === 1 ? ' registered name' : ' registered names') + ' could not be checked for mail servers, so may have them.' }) : null,
      el('p', { class: 't-meta' }, el('span', { text: 'Checked ' + new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) }),
        el('span', { text: s.checkedCount + ' names, ' + (s.checkedCount * 2) + ' lookups at most' }))));
    if (s.listed.length) {
      var mail = s.listed.filter(function (x) { return x.mx; }), web = s.listed.filter(function (x) { return !x.mx && !x.mxUnread; }), unread = s.listed.filter(function (x) { return x.mxUnread; });
      nodes.push(el('details', { class: 't-details', open: true },
        el('summary', { text: 'Registered lookalikes (' + s.listed.length + ')' }),
        el('div', { class: 't-details-body' },
          group('Mail servers set up', 'Registered, with mail servers.', mail),
          group('Mail servers not read', 'Registered. The mail lookup failed, so these may have mail servers.', unread),
          group('Website address only', 'Registered, no mail servers found.', web),
          el('p', { class: 'muted', text: 'These are plain text on purpose. Do not open them to look: some may be set up to catch visitors.' }),
          el('div', { class: 't-mail-actions' }, T.copyButton(function () { return listText(s.listed); }, { label: 'Copy the list' })))));
    }
    results.replaceChildren.apply(results, nodes);
    var hd = document.getElementById('verdict-head');
    if (hd) hd.focus({ preventScroll: false });
    T.mountRequests({ tool: 'lookalike_domain', getDomain: function () { return lastDomain; }, getResults: function () { return lastSummary; }, ids: requestIds(s) });
    return s.verdict;
  }

  T.mountTool({
    form: form, input: input, status: status, results: results, cancel: document.getElementById('check-cancel'),
    tool: 'lookalike_domain', reset: reset,
    run: async function (ctx) {
      var p = L.splitDomain(ctx.domain), base = p.name + '.' + p.suffix;
      if (p.suffix === 'github.io') {
        var hosted = new Error('free hosting');
        hosted.userMessage = 'That is a free hosting address, where every name answers, so I cannot tell which lookalikes are real. Type your own domain, such as yourbusiness.com.au.';
        throw hosted;
      }
      var variants = L.generateVariants(ctx.domain);
      if (!variants.length) {
        var err = new Error('shared ending');
        err.userMessage = 'That is an ending many businesses share, not a business name. Type your own domain, such as yourbusiness.com.au.';
        throw err;
      }
       
      var dns = T.createDns({ maxQueries: 300, signal: ctx.signal });
      say('Trying ' + variants.length + ' names...');
      var checked = await L.checkVariants(variants, dns, {
        signal: ctx.signal, pool: T.pool,
        onProgress: function (done, total) { say('Checked ' + done + ' of ' + total + ' names...'); }
      });
      return render(ctx, L.summarise(checked), base);
    }
  });
})();
