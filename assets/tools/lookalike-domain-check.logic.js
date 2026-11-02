

(function (root, factory) {
  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.IETools;
  var api = factory(core || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.lookalikeDomain = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  var MAX_VARIANTS = 150, POOL_SIZE = 6;
   
  var SHARED_SUFFIXES = core.SHARED_SUFFIXES || [];
  var TLDS = ['com.au', 'au', 'com', 'net.au', 'net'];
  var T = { A: 1, CNAME: 5, MX: 15 };

  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  var NEIGHBOURS = (function () {
    var map = {};
    ROWS.forEach(function (row, r) {
      for (var i = 0; i < row.length; i++) {
        var n = [];
        if (i > 0) n.push(row[i - 1]);
        if (i < row.length - 1) n.push(row[i + 1]);
        [r - 1, r + 1].forEach(function (rr) {
          if (!ROWS[rr]) return;
          [i - 1, i, i + 1].forEach(function (c) { if (ROWS[rr][c]) n.push(ROWS[rr][c]); });
        });
        map[row[i]] = n.sort();
      }
    });
    return map;
  })();
  var GLYPHS = [['rn', 'm'], ['m', 'rn'], ['vv', 'w'], ['w', 'vv'], ['l', '1'], ['1', 'l'], ['o', '0'], ['0', 'o'], ['i', '1'], ['1', 'i']];

  

  function splitDomain(domain) {
    var d = String(domain == null ? '' : domain).trim().toLowerCase().replace(/\.+$/, '');
    var labels = d.split('.').filter(Boolean);
     
    var tail2 = labels.slice(-2).join('.');
    var shaped = /^(com|co|net|org|edu|gov|ac|ne|or)\.[a-z]{2}$/.test(tail2);
    if (SHARED_SUFFIXES.indexOf(labels.join('.')) >= 0 || (shaped && labels.length === 2)) return { name: '', suffix: labels.join('.') };
    if (shaped) return { name: labels[labels.length - 3], suffix: tail2 };
    if (labels.length < 2) return { name: labels[0] || '', suffix: '' };
    for (var n = 3; n >= 2; n--) {
      var tail = labels.slice(-n).join('.');
      if (labels.length > n && SHARED_SUFFIXES.indexOf(tail) >= 0) return { name: labels[labels.length - n - 1], suffix: tail };
    }
    return { name: labels[labels.length - 2], suffix: labels[labels.length - 1] };
  }

  function validName(n) {
    return n.length > 0 && n.length <= 63 && /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/.test(n);
  }

  function replaceAt(s, i, len, rep) { return s.slice(0, i) + rep + s.slice(i + len); }

  function buckets(name) {
    var omission = [], doubling = [], key = [], swap = [], glyph = [], hyphen = [], i;
    for (i = 0; i < name.length; i++) omission.push(name.slice(0, i) + name.slice(i + 1));
    for (i = 0; i < name.length; i++) doubling.push(name.slice(0, i + 1) + name.slice(i));
    for (i = 0; i < name.length; i++) {
      (NEIGHBOURS[name[i]] || []).forEach(function (c) { key.push(replaceAt(name, i, 1, c)); });
    }
    for (i = 0; i < name.length - 1; i++) {
      if (name[i] !== name[i + 1]) swap.push(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2));
    }
    GLYPHS.forEach(function (g) {
      var from = g[0], at = name.indexOf(from);
      while (at >= 0) {
        glyph.push(replaceAt(name, at, from.length, g[1]));
        at = name.indexOf(from, at + 1);
      }
    });
    for (i = 1; i < name.length; i++) hyphen.push(name.slice(0, i) + '-' + name.slice(i));
    return [
      { kind: 'typo', list: omission }, { kind: 'swap', list: swap }, { kind: 'homoglyph', list: glyph },
      { kind: 'typo', list: doubling }, { kind: 'typo', list: key }, { kind: 'homoglyph', list: hyphen }
    ];
  }

  function generateVariants(domain) {
    var p = splitDomain(domain);
    var input = String(domain == null ? '' : domain).trim().toLowerCase().replace(/\.+$/, '');
    var own = p.name + '.' + p.suffix;
    if (!validName(p.name) || !p.suffix) return [];
    var seen = {}, out = [];
    seen[input] = true; seen[own] = true;
    function add(name, suffix, kind) {
      if (out.length >= MAX_VARIANTS || !validName(name)) return;
      var d = name + '.' + suffix;
      if (seen[d]) return;
      seen[d] = true;
      out.push({ domain: d, kind: kind });
    }
    TLDS.forEach(function (t) { add(p.name, t, 'tld'); });
    var bs = buckets(p.name), idx = 0, more = true;
    while (more && out.length < MAX_VARIANTS) {
      more = false;
      bs.forEach(function (b) {
        if (idx < b.list.length) { more = true; add(b.list[idx], p.suffix, b.kind); }
      });
      idx++;
    }
    return out;
  }

  function hasA(res) {
    return !!res && res.answers.some(function (a) { return a.type === T.A || a.type === T.CNAME; });
  }
   
  function hasMx(res) {
    return !!res && res.answers.some(function (a) {
      if (a.type !== T.MX) return false;
      var parts = String(a.data).trim().split(/\s+/);
      var target = parts.length > 1 ? parts[parts.length - 1] : '';
      return target !== '' && target !== '.';
    });
  }
  function isUnavailable(e) { return !!e && e.name === 'DnsUnavailable'; }

  function cancelled() { var e = new Error('The check was cancelled.'); e.name = 'DnsCancelled'; return e; }

  function localPool(items, size, fn, signal) {
    var out = new Array(items.length), i = 0, workers = [];
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

  async function checkVariants(variants, dns, opts) {
    opts = opts || {};
    var run = opts.pool || localPool, signal = opts.signal;
    var done = 0, lastUnavailable = null;
    function settle(p) { return p.then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }); }
    

    var rows = await run(variants, POOL_SIZE, async function (v) {
      var ra = await settle(dns.query(v.domain, 'A'));
      if (!ra.ok && !isUnavailable(ra.e)) throw ra.e;
      var rm = await settle(dns.query(v.domain, 'MX'));
      if (!rm.ok && !isUnavailable(rm.e)) throw rm.e;
      var r = [ra, rm];
      var row;
      var a = r[0].ok && hasA(r[0].v), mx = r[1].ok && hasMx(r[1].v);
       
      if (mx || a || (r[0].ok && r[1].ok)) {
        row = { domain: v.domain, kind: v.kind, a: a, mx: mx };
        if (a && !r[1].ok) row.mxUnread = true;
      }
      else {
        r.forEach(function (x) { if (!x.ok) lastUnavailable = x.e; });
        row = { domain: v.domain, kind: v.kind, a: false, mx: false, unknown: true };
      }
      done++;
      if (opts.onProgress) opts.onProgress(done, variants.length);
      return row;
    }, signal);
    if (signal && signal.aborted) throw cancelled();
    if (variants.length && rows.every(function (x) { return x.unknown; })) throw lastUnavailable;
    return rows;
  }

  function summarise(checked) {
    var list = Array.isArray(checked) ? checked : [];
    var unknown = list.filter(function (x) { return x.unknown; }).length;
    var reg = list.filter(function (x) { return !x.unknown && (x.a || x.mx); }).map(function (x) {
      var out = { domain: x.domain, kind: x.kind, a: !!x.a, mx: !!x.mx };
      if (x.mxUnread) out.mxUnread = true;
      return out;
    });
    var mail = reg.filter(function (x) { return x.mx; });
    var web = reg.filter(function (x) { return !x.mx; });
    return {
      verdict: mail.length ? 'mail-ready' : reg.length ? 'registered' : 'none-found',
      listed: mail.concat(web),
      checkedCount: list.length,
      unknownCount: unknown,
      mailUnread: list.filter(function (x) { return x.mxUnread; }).length,
      mailReady: mail.length,
      webOnly: web.length
    };
  }

  return {
    MAX_VARIANTS: MAX_VARIANTS, POOL_SIZE: POOL_SIZE, TLDS: TLDS,
    splitDomain: splitDomain, generateVariants: generateVariants, checkVariants: checkVariants, summarise: summarise
  };
});
