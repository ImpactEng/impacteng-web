

(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IETools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

   
  function makeError(name, message) {
    function E(msg) { var e = new Error(msg || message); this.name = name; this.message = e.message; this.stack = e.stack; }
    E.prototype = Object.create(Error.prototype);
    E.prototype.constructor = E;
    E.prototype.name = name;
    return E;
  }
  var DnsBudgetError = makeError('DnsBudgetError', 'The lookup limit for one check was reached.');
  var DnsCancelled = makeError('DnsCancelled', 'The check was cancelled.');
  var DnsUnavailable = makeError('DnsUnavailable', 'Neither public DNS service could be reached.');

   
  

  var HIDDEN = '\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}\\u180e\\u{e0000}-\\u{e007f}';
  var HIDDEN_RUN, HIDDEN_ONE, LONE;
  try {
    HIDDEN_RUN = new RegExp('[' + HIDDEN + ']+', 'gu'); HIDDEN_ONE = new RegExp('[' + HIDDEN + '\\p{Cs}]', 'u'); LONE = /\p{Cs}/gu;
  } catch (e) {  
    HIDDEN_RUN = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb]+/g;
    HIDDEN_ONE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb\ud800-\udfff]/;
    LONE = /[\ud800-\udfff]/g;
  }
  function hasHidden(s) { return HIDDEN_ONE.test(String(s == null ? '' : s)); }
  function cleanText(s, cap) {
    var t = String(s == null ? '' : s).replace(HIDDEN_RUN, ' ').replace(LONE, '?').trim();
    if (cap && t.length > cap) {
      t = t.slice(0, cap);
      if (/[\ud800-\udbff]$/.test(t)) t = t.slice(0, -1);
    }
    return t;
  }

  

  var SHARED_SUFFIXES = ['com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
    'vic.gov.au', 'nsw.gov.au', 'qld.gov.au', 'sa.gov.au', 'wa.gov.au', 'tas.gov.au', 'nt.gov.au', 'act.gov.au',
    'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk',
    'co.za', 'github.io'];

   
  var SHARED_MAIL = ['gmail.com', 'googlemail.com', 'outlook.com', 'outlook.com.au', 'hotmail.com', 'hotmail.com.au', 'live.com', 'live.com.au', 'msn.com',
    'yahoo.com', 'yahoo.com.au', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com',
    'bigpond.com', 'bigpond.com.au', 'bigpond.net.au', 'telstra.com', 'optusnet.com.au', 'tpg.com.au', 'iinet.net.au', 'internode.on.net', 'dodo.com.au'];

   
  var LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.onion', '.test', '.invalid', '.home.arpa', '.lan', '.arpa'];
  var MAX_INPUT = 1000;
  function fail(reason) { return { ok: false, reason: reason }; }
  function privateName(s) {
    return s === 'localhost' || LOCAL_SUFFIXES.some(function (x) { return s.slice(-x.length) === x; });
  }

  function normaliseDomain(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return fail('empty');
    if (s.length > MAX_INPUT) return fail('too-long');
    if (/[\s,;]/.test(s)) return fail('list');
    s = s.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, '');
    s = s.split(/[\/?#]/)[0];
    var at = s.lastIndexOf('@');
    if (at >= 0) s = s.slice(at + 1);
    if (s.charAt(0) === '[' || s.indexOf(':') !== s.lastIndexOf(':')) return fail('ip');
    s = s.replace(/:\d*$/, '');
    s = s.toLowerCase().replace(/\.+$/, '').replace(/^www\./, '');
    if (!s) return fail('empty');
    if (/^\d+(\.\d+){3}$/.test(s)) return fail('ip');
    if (privateName(s)) return fail('localhost');
    if (s.indexOf('.') < 0) return fail('single-label');
    if (typeof URL === 'function') {
      try { s = new URL('http://' + s).hostname; } catch (e) { return fail('invalid'); }
    } else if (/[^a-z0-9.\-]/.test(s)) return fail('invalid');
    if (/^\d+(\.\d+){3}$/.test(s)) return fail('ip');
    if (privateName(s.replace(/\.+$/, ''))) return fail('localhost');
    if (s.length > 253) return fail('too-long');
    var labels = s.split('.');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].length > 63) return fail('too-long');
      if (!/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/.test(labels[i])) return fail('invalid');
    }
    if (labels.length < 2) return fail('single-label');
    if (/^\d+$/.test(labels[labels.length - 1])) return fail('invalid');
    if (SHARED_MAIL.indexOf(s) >= 0) return fail('shared-mail');
    return { ok: true, domain: s };
  }

   
  

  var FIRST_SHARE = 0.6;
  function createDns(opts) {
    opts = opts || {};
    var doFetch = opts.fetch || (typeof fetch === 'function' ? fetch.bind(root) : null);
    var max = opts.maxQueries == null ? 40 : opts.maxQueries;
    var timeoutMs = opts.timeoutMs == null ? 5000 : opts.timeoutMs;
    var clock = opts.now || Date.now;
    var setT = opts.setTimeout || function (f, ms) { return setTimeout(f, ms); };
    var clearT = opts.clearTimeout || function (t) { clearTimeout(t); };
    var ctl = new AbortController();
    var count = 0;
    if (opts.signal) {
      if (opts.signal.aborted) ctl.abort();
      else opts.signal.addEventListener('abort', function () { ctl.abort(); });
    }
    function urls(name, type) {
      var q = 'name=' + encodeURIComponent(name) + '&type=' + encodeURIComponent(type);
      return ['https://dns.google/resolve?' + q, 'https://cloudflare-dns.com/dns-query?' + q];
    }
    function attempt(url, ms) {
      var t = new AbortController(), timer = null, onAbort = null;
      var guard = new Promise(function (_, reject) {
        timer = setT(function () { t.abort(); reject(new Error('timeout')); }, ms);
        onAbort = function () { t.abort(); reject(new DnsCancelled()); };
        ctl.signal.addEventListener('abort', onAbort);
      });
      var run = Promise.resolve().then(function () {
        return doFetch(url, { headers: { accept: 'application/dns-json' }, signal: t.signal });
      }).then(function (r) { if (!r || !r.ok) throw new Error('http'); return r.json(); });
      function done() { clearT(timer); ctl.signal.removeEventListener('abort', onAbort); }
      return Promise.race([run, guard]).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
    }
    function shape(j) {
      return {
        status: j.Status,
        answers: (Array.isArray(j.Answer) ? j.Answer : []).map(function (a) {
          return { type: a.type, data: String(a.data), ttl: a.TTL };
        })
      };
    }
    var client = {
      

      query: function (name, type, qopts) {
        if (ctl.signal.aborted) return Promise.reject(new DnsCancelled());
        if (count >= max) return Promise.reject(new DnsBudgetError());
        if (!doFetch) return Promise.reject(new DnsUnavailable());
        count++;
        var list = urls(name, type), last = null, start = clock();
        return list.reduce(function (p, u, idx) {
          return p.then(function (res) {
            if (res) return res;
            var ms = idx === 0 ? Math.max(1, Math.floor(timeoutMs * FIRST_SHARE)) : Math.max(1, timeoutMs - (clock() - start));
            return attempt(u, ms).then(function (j) {
              if (!j || typeof j.Status !== 'number') return null;
              if (j.Status === 0 || j.Status === 3) return shape(j);
              last = j;
              return null;
            }, function (e) {
              if (e instanceof DnsCancelled || ctl.signal.aborted) throw new DnsCancelled();
              return null;
            });
          });
        }, Promise.resolve(null)).then(function (res) {
          if (res) return res;
          if (last && qopts && qopts.allowFailure) return shape(last);
          throw new DnsUnavailable();
        });
      },
      cancel: function () { ctl.abort(); }
    };
    Object.defineProperty(client, 'count', { get: function () { return count; }, enumerable: true });
    return client;
  }

   
  function txtStrings(data) {
    var s = String(data == null ? '' : data).trim();
    function unescape(x) {
      return x.replace(/\\(\d{3}|.)/g, function (_, c) {
        return c.length === 3 ? String.fromCharCode(parseInt(c, 10)) : c;
      });
    }
    if (s.charAt(0) !== '"') return unescape(s);
    var out = [], re = /"((?:[^"\\]|\\.)*)"/g, m;
    while ((m = re.exec(s))) out.push(unescape(m[1]));
    return out.join('');
  }

  function pool(items, size, fn, signal) {
    var out = new Array(items.length), i = 0;
    var workers = [];
    for (var w = 0; w < Math.max(1, Math.min(size, items.length)); w++) {
      workers.push((async function () {
        while (i < items.length) {
          if (signal && signal.aborted) return;
          var k = i++;
          out[k] = await fn(items[k], k);
        }
      })());
    }
    return Promise.all(workers).then(function () { return out; });
  }

   
  function el(tag, attrs) {
    var n = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (/^(on|html$|innerhtml$|outerhtml$)/i.test(k)) throw new Error('el: attribute not allowed: ' + k);
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    (function add(list) {
      list.forEach(function (c) {
        if (Array.isArray(c)) return add(c);
        if (c == null || c === false) return;
        n.appendChild(c && c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return n;
  }

  function copyButton(getText, opts) {
    opts = opts || {};
    var label = opts.label || 'Copy';
    var b = el('button', { type: 'button', class: 'copy-btn', 'aria-live': 'polite', text: label });
    var timer = null;
    function flash(t) { b.textContent = t; clearTimeout(timer); timer = setTimeout(function () { b.textContent = label; }, 1600); }
    b.addEventListener('click', function () {
      var text = String(getText());
      var nav = root.navigator;
      var fallback = function () {
        var target = opts.target;
        if (target && root.getSelection && document.createRange) {
          var r = document.createRange(); r.selectNodeContents(target);
          var s = root.getSelection(); s.removeAllRanges(); s.addRange(r);
        }
        flash(opts.target ? 'Selected: copy it now' : 'Could not copy');
      };
      if (nav && nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(text).then(function () { flash('Copied'); if (opts.onCopy) opts.onCopy(); }, fallback);
      } else fallback();
    });
    return b;
  }

   
  var EVENTS = { tool_start: 1, tool_result: 1, tool_request: 1 };
  var PARAMS = ['tool', 'verdict', 'request_type'];
  function track(name, params) {
    if (!EVENTS[name]) return;
    var out = {};
    PARAMS.forEach(function (k) {
      var v = params && params[k];
      if (typeof v === 'string' && /^[a-z0-9_\-]{1,40}$/i.test(v)) out[k] = v;
    });
    try { if (typeof root.ieTrack === 'function') root.ieTrack(name, out); } catch (e) {   }
  }

   
  var INPUT_MESSAGES = {
    empty: 'Type a domain first, such as yourbusiness.com.au.',
    list: 'One domain at a time. I do not take lists.',
    ip: 'That is an IP address. Type a domain name instead, such as yourbusiness.com.au.',
    localhost: 'That is a private name. Type a public domain, such as yourbusiness.com.au.',
    'single-label': 'That is missing its ending. Try yourbusiness.com.au.',
    'too-long': 'That domain is too long to be real.',
    invalid: 'That does not look like a domain. Try yourbusiness.com.au.',
    'shared-mail': 'That is a shared email service, not a domain you run. Its records are not about your business. Type your own domain if you have one, such as yourbusiness.com.au.'
  };

  function mountTool(cfg) {
    var running = null;
    function say(t) { cfg.status.textContent = t; }
    function setBusy(b) {
      var submit = cfg.form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = b;
      if (cfg.input) cfg.input.disabled = b;
      if (cfg.cancel) cfg.cancel.hidden = !b;
      cfg.results.setAttribute('aria-busy', b ? 'true' : 'false');
    }
    function reset() { if (typeof cfg.reset === 'function') { try { cfg.reset(); } catch (e) {   } } }
     
    var submit0 = cfg.form.querySelector('button[type="submit"]');
    if (submit0) submit0.disabled = false;
    if (cfg.cancel) {
      cfg.cancel.hidden = true;
      cfg.cancel.addEventListener('click', function () { if (running) running.abort(); });
    }
    cfg.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (running) return;
      var n = normaliseDomain(cfg.input.value);
      if (!n.ok) { say(INPUT_MESSAGES[n.reason] || INPUT_MESSAGES.invalid); cfg.input.focus(); return; }
      cfg.input.value = n.domain;
      var ctl = new AbortController();
      running = ctl;
      cfg.results.replaceChildren();
      reset();
      setBusy(true);
      var refocus = false;
      track('tool_start', { tool: cfg.tool });
      Promise.resolve().then(function () {
        return cfg.run({ domain: n.domain, signal: ctl.signal, step: say, results: cfg.results });
      }).then(function (verdict) {
        say('');
        track('tool_result', { tool: cfg.tool, verdict: verdict });
      }, function (err) {
        cfg.results.replaceChildren();
        reset();
        var name = err && err.name;
        if (err && typeof err.userMessage === 'string') say(err.userMessage);
        else if (name === 'DnsCancelled' || ctl.signal.aborted) say('Check cancelled. Nothing was kept.');
        else if (name === 'DnsUnavailable') say('I could not reach Google or Cloudflare public DNS from this browser, so I have no result. Check your connection, or a blocker that stops lookups, and try again.');
        else if (name === 'DnsBudgetError') say('That check needed more lookups than one check may use, so I stopped. Try again.');
        else say('Something went wrong reading the records. Try again in a minute.');
        refocus = true;
      }).then(function () {
        running = null;
        setBusy(false);
         
        if (refocus) cfg.input.focus();
      });
    });
    return { isRunning: function () { return !!running; } };
  }

   
  var RESULT_CAP = 2048, MARKER = '[cut]';
  function capResults(text) {
    var s = String(text == null ? '' : text);
    var enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    var len = function (x) { return enc ? enc.encode(x).length : x.length; };
    if (len(s) <= RESULT_CAP) return s;
    var lo = 0, hi = s.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (len(s.slice(0, mid) + MARKER) <= RESULT_CAP) lo = mid; else hi = mid - 1;
    }
    var cut = s.slice(0, lo);
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
    return cut + MARKER;
  }

  function emailAtDomain(email, domain) {
    var host = String(email).slice(String(email).lastIndexOf('@') + 1).toLowerCase();
    if (!/^[a-z0-9.\-]+$/.test(host)) return false;
    return host === domain || host.slice(-(domain.length + 1)) === '.' + domain;
  }

  function mountRequests(cfg) {
    var box = typeof document === 'undefined' ? null : document.getElementById('tool-request');
    if (!box) return { shown: [] };
    var now = cfg.now || Date.now;
    var send = cfg.fetch || (typeof fetch === 'function' ? fetch.bind(root) : null);
    var ids = cfg.ids || [];
    var state = box.__ieState || (box.__ieState = { lastSent: null });
    box.querySelectorAll('.t-req-form').forEach(function (f) { f.remove(); });
    var shown = [];
    box.querySelectorAll('[data-request-id]').forEach(function (item) {
      var id = item.getAttribute('data-request-id');
      var on = ids.indexOf(id) >= 0;
      item.hidden = !on;
      if (!on) return;
      shown.push(id);
      var btn = item.querySelector('.t-req-open');
      if (!btn) {
        btn = el('button', { type: 'button', class: 'btn ghost t-req-open', 'aria-expanded': 'false', text: 'Ask for this' });
        item.appendChild(btn);
        btn.addEventListener('click', function () { toggle(item, btn); });
      }
      btn.setAttribute('aria-expanded', 'false');
    });
    box.hidden = shown.length === 0;

    function toggle(item, btn) {
      var open = item.querySelector('.t-req-form');
      if (open) { open.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
      btn.setAttribute('aria-expanded', 'true');
      item.appendChild(buildForm(item));
    }

    function buildForm(item) {
      var id = item.getAttribute('data-request-id');
      var proof = item.getAttribute('data-needs-proof') === 'true';
      var uid = 'req-' + id;
      var status = el('p', { class: 't-req-status muted', role: 'status', 'aria-live': 'polite' });
      var name = el('input', { type: 'text', id: uid + '-name', name: 'name', maxlength: '100', required: true, autocomplete: 'name' });
      var email = el('input', { type: 'email', id: uid + '-email', name: 'email', maxlength: '254', required: true, autocomplete: 'email' });
      var note = el('textarea', { id: uid + '-note', name: 'note', maxlength: '1000', rows: '3' });
      var consent = el('input', { type: 'checkbox', id: uid + '-consent', name: 'consent', value: 'yes' });
      var gotcha = el('input', { type: 'text', id: uid + '-web', name: '_gotcha', tabindex: '-1', autocomplete: 'off' });
      var submit = el('button', { type: 'submit', class: 'btn', text: 'Send request' });
      var form = el('form', { class: 'form t-req-form', 'data-clarity-mask': 'True', novalidate: true },
        proof ? el('p', { class: 'note', text: 'This needs an address at your domain, to show the request comes from the person who runs it.' }) : null,
        el('div', { class: 'field' }, el('label', { for: uid + '-name', text: 'Name' }), name),
        el('div', { class: 'field' }, el('label', { for: uid + '-email', text: 'Email' }), email),
        el('div', { class: 'field' }, el('label', { for: uid + '-note', text: 'Note (optional)' }), note),
        el('div', { class: 'hp', 'aria-hidden': 'true' }, el('label', { for: uid + '-web', text: 'Leave this blank' }), gotcha),
        el('label', { class: 't-consent', for: uid + '-consent' }, consent, el('span', { text: 'You may use these details for this request, and for nothing else.' })),
        el('div', { class: 'actions' }, submit),
        status);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (gotcha.value) return;
        var domain = cfg.getDomain ? cfg.getDomain() : '';
        var nm = name.value.trim(), em = email.value.trim();
        if (!domain) { status.textContent = 'Run a check first, so the request has a domain.'; return; }
        if (!nm || nm.length > 100) { status.textContent = 'Add your name (up to 100 characters).'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 254) { status.textContent = 'Add an email address.'; return; }
        if (note.value.length > 1000) { status.textContent = 'The note can be up to 1000 characters.'; return; }
        if (proof && SHARED_SUFFIXES.indexOf(domain) >= 0) { status.textContent = 'I cannot confirm that name, because many businesses share its ending. Run a check on your own domain.'; return; }
        if (proof && !emailAtDomain(em, domain)) { status.textContent = 'This one needs an address at ' + domain + '.'; return; }
        if (!consent.checked) { status.textContent = 'Tick the box to go on.'; return; }
        var t = now();
        if (state.lastSent != null && t - state.lastSent < 60000) {
          status.textContent = 'Please wait ' + Math.ceil((60000 - (t - state.lastSent)) / 1000) + ' seconds before sending another.';
          return;
        }
        if (!send) { status.textContent = 'This browser cannot send the request.'; return; }
        var fd = new FormData();
        fd.append('form', 'tool_request');
        fd.append('request_type', id);
        fd.append('tool', cfg.tool);
        fd.append('domain', domain);
        fd.append('results', capResults(cfg.getResults ? cfg.getResults() : ''));
        fd.append('name', nm);
        fd.append('email', em);
        fd.append('note', note.value);
        fd.append('consent', 'yes');
        fd.append('_gotcha', '');
        state.lastSent = t;
        submit.disabled = true;
        status.textContent = 'Sending...';
        Promise.resolve(send(box.getAttribute('data-endpoint'), { method: 'POST', body: fd, headers: { Accept: 'application/json' } }))
          .then(function (r) {
            if (!r || !r.ok) throw new Error('status');
            status.textContent = 'Sent.';
            track('tool_request', { request_type: id });
          })
          .catch(function () { state.lastSent = null; status.textContent = 'The request could not send from here. Try again in a minute.'; })
          .then(function () { submit.disabled = false; });
      });
      return form;
    }
    return { shown: shown };
  }

  return {
    normaliseDomain: normaliseDomain,
    cleanText: cleanText,
    hasHidden: hasHidden,
    SHARED_SUFFIXES: SHARED_SUFFIXES,
    createDns: createDns,
    txtStrings: txtStrings,
    pool: pool,
    el: el,
    copyButton: copyButton,
    mountTool: mountTool,
    mountRequests: mountRequests,
    track: track,
    capResults: capResults,
    DnsBudgetError: DnsBudgetError,
    DnsCancelled: DnsCancelled,
    DnsUnavailable: DnsUnavailable
  };
});
