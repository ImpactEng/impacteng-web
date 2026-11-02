

(function (root, factory) {
  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.IETools;
  var api = factory(core || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.dmarcReport = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  var LIMITS = { fileBytes: 10 * 1024 * 1024, xmlBytes: 50 * 1024 * 1024, records: 50000 };
  var ORG_NAME = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/i;   
  var ORG_CAP = 60;   
  var TEXT_CAP = 255, FEED_SLICE = 16384, MAX_COUNT = 1000000000;
  

  var OVERRIDES = ['forwarded', 'sampled_out', 'trusted_forwarder', 'mailing_list', 'local_policy', 'other', 'policy_test_mode'];
  var LEFT_OUT = ['sampled_out', 'policy_test_mode'], EXPECTED = ['forwarded', 'mailing_list', 'trusted_forwarder'];
  var COVERAGE = 'Reports come only from receivers that choose to send them, and not every mail server does. So a clean report does not mean nobody is spoofing you.';

  var MESSAGES = {
    'too-big': 'That file is too big for me to read here (the limit is 10 MB, or 50 MB once unpacked, or 50,000 rows). Open a smaller report.',
    bomb: 'That file unpacks to far more than a real report would. I stopped and did not open it.',
    'not-a-report': 'That does not look like a DMARC report. I expect an XML file from a mail service, or that file zipped or gzipped. A file that declares its own entities or document type is refused.',
    'bad-archive': 'I could not unpack that file. It may be damaged, password protected, or in a format I do not read (I read .xml, .xml.gz and .zip). Unpack it yourself and drop the .xml file in.'
  };

  function ReportError(code, message) {
    var e = new Error(message || MESSAGES[code] || code);
    this.name = 'ReportError';
    this.code = code;
    this.message = e.message;
    this.stack = e.stack;
  }
  ReportError.prototype = Object.create(Error.prototype);
  ReportError.prototype.constructor = ReportError;

   
  function clean(s, cap) { return core.cleanText(s, cap || TEXT_CAP); }

   
  function isIp(t) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(t);
    if (m) return m.slice(1).every(function (x) { return Number(x) <= 255; });
    if (t.length > 45 || t.indexOf(':') < 0 || !/^[0-9A-Fa-f:.]+$/.test(t) || t.indexOf(':::') >= 0) return false;
    var dbl = t.split('::');
    if (dbl.length > 2) return false;
    var groups = t.split(':').filter(function (g) { return g !== ''; });
    var tail = groups[groups.length - 1] || '';
    var v4 = tail.indexOf('.') >= 0;
    if (v4 && !isIp(tail)) return false;
    var width = groups.length + (v4 ? 1 : 0);
    if (!groups.every(function (g, i) { return (v4 && i === groups.length - 1) || /^[0-9A-Fa-f]{1,4}$/.test(g); })) return false;
    return dbl.length === 2 ? width < 8 : width === 8;
  }
  function domainLike(d) { return /^[a-z0-9.\-]{1,253}$/.test(d) && d.indexOf('.') > 0 && !isIp(d) ? d : ''; }
  var POLICIES = ['none', 'quarantine', 'reject'];
  function numPct(t) { return /^\d{1,3}$/.test(t) && Number(t) <= 100 ? String(Number(t)) : ''; }

  function toBytes(b) {
    if (b instanceof Uint8Array) return b;
    if (b && typeof b.byteLength === 'number' && typeof b.slice === 'function' && !ArrayBuffer.isView(b)) return new Uint8Array(b);
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return new Uint8Array(0);
  }

   
  function detectType(bytes, name) {
    var b = toBytes(bytes);
    if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return 'gzip';
    if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6)) return 'zip';
    var i = 0;
    if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;
    while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
    if (i < b.length && b[i] === 0x3c) return 'xml';
    var n = String(name == null ? '' : name).toLowerCase();
    if (/\.(gz|gzip)$/.test(n)) return 'gzip';
    if (/\.zip$/.test(n)) return 'zip';
    if (/\.xml$/.test(n)) return 'xml';
    return 'unknown';
  }

  function decode(bytes) {
    var s = new TextDecoder('utf-8').decode(bytes);
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
  }

  

  async function inflate(bytes, format) {
    if (typeof DecompressionStream !== 'function') {
      throw new ReportError('bad-archive', 'This browser cannot unpack compressed files. Unpack it yourself and drop the .xml file in.');
    }
    var ds = new DecompressionStream(format);
    var writer = ds.writable.getWriter();
    var reader = ds.readable.getReader();
    var stop = false;
    var feeder = (async function () {
      try {
        for (var i = 0; i < bytes.length && !stop; i += FEED_SLICE) await writer.write(bytes.subarray(i, i + FEED_SLICE));
        if (!stop) await writer.close();
      } catch (e) {   }
    })();
    var chunks = [], total = 0;
    try {
      for (;;) {
        var r = await reader.read();
        if (r.done) break;
        total += r.value.length;
        if (total > LIMITS.xmlBytes) throw new ReportError('bomb');
        chunks.push(r.value);
      }
    } catch (e) {
      stop = true;
      try { await reader.cancel(); } catch (e2) {   }
      try { await writer.abort(); } catch (e3) {   }
      await feeder;
      if (e instanceof ReportError) throw e;
      throw new ReportError('bad-archive');
    }
    await feeder;
    var out = new Uint8Array(total), at = 0;
    chunks.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  }

   
  function zipFirstXml(b) {
    var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    var u16 = function (o) { return dv.getUint16(o, true); };
    var u32 = function (o) { return dv.getUint32(o, true); };
    var bad = function () { return new ReportError('bad-archive'); };
    var eocd = -1;
    for (var p = b.length - 22; p >= 0 && p >= b.length - 22 - 65535; p--) {
      if (u32(p) === 0x06054b50) { eocd = p; break; }
    }
    if (eocd < 0) throw bad();
    var count = u16(eocd + 10), cdOff = u32(eocd + 16);
    if (count === 0xffff || cdOff === 0xffffffff) throw bad();
    var o = cdOff, found = null, xmlFiles = 0;
    for (var i = 0; i < count; i++) {
      if (o + 46 > b.length || u32(o) !== 0x02014b50) throw bad();
      var flags = u16(o + 8), method = u16(o + 10), csize = u32(o + 20), usize = u32(o + 24);
      var nl = u16(o + 28), el = u16(o + 30), cl = u16(o + 32), lho = u32(o + 42);
      if (o + 46 + nl > b.length) throw bad();
      var name = decode(b.subarray(o + 46, o + 46 + nl));
      o += 46 + nl + el + cl;
      var base = name.slice(name.lastIndexOf('/') + 1);
      if (!/\.xml$/i.test(name) || /\/$/.test(name) || /^__MACOSX\//.test(name) || /^\._/.test(base)) continue;
      xmlFiles++;
      if (!found) found = { flags: flags, method: method, csize: csize, usize: usize, lho: lho };
    }
    if (!found) throw new ReportError('not-a-report');
    if (found.flags & 1) throw bad();
    if (found.method !== 0 && found.method !== 8) throw bad();
    if (found.csize === 0xffffffff || found.usize === 0xffffffff) throw bad();
    if (found.usize > LIMITS.xmlBytes || found.csize > LIMITS.xmlBytes) throw new ReportError('bomb');
    var h = found.lho;
    if (h + 30 > b.length || u32(h) !== 0x04034b50) throw bad();
    var start = h + 30 + u16(h + 26) + u16(h + 28);
    if (start + found.csize > b.length) throw bad();
    return { method: found.method, data: b.subarray(start, start + found.csize), extra: xmlFiles - 1 };
  }

   
  function zipExtraFiles(bytes, name) {
    var b = toBytes(bytes);
    try { return detectType(b, name) === 'zip' ? zipFirstXml(b).extra : 0; } catch (e) { return 0; }
  }

  async function readToText(bytes, name) {
    var b = toBytes(bytes);
    if (b.length > LIMITS.fileBytes) throw new ReportError('too-big');
    var type = detectType(b, name);
    if (type === 'xml') return decode(b);
    if (type === 'gzip') return decode(await inflate(b, 'gzip'));
    if (type === 'zip') {
      var z = zipFirstXml(b);
      if (z.method === 0) return decode(z.data);
      return decode(await inflate(z.data, 'deflate-raw'));
    }
    throw new ReportError('not-a-report');
  }

   
  function checkXml(text) {
    var t = String(text == null ? '' : text);
    if (/<!DOCTYPE/i.test(t) || /<!ENTITY/i.test(t)) throw new ReportError('not-a-report');
    if (t.indexOf('<feedback') < 0) throw new ReportError('not-a-report');
    

    var tags = 0, at = -1, limit = LIMITS.records * 40;
    while ((at = t.indexOf('<', at + 1)) >= 0) { if (++tags > limit) throw new ReportError('too-big'); }
    return true;
  }

   
  function kids(node, name) {
    var out = [];
    if (!node) return out;
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && (c.localName || c.nodeName) === name) out.push(c);
    }
    return out;
  }
  function kid(node, name) { return kids(node, name)[0] || null; }
  function text(node, name) {
    var n = name ? kid(node, name) : node;
    return n ? clean(n.textContent) : '';
  }
  function whole(s, max) {
    var n = parseInt(s, 10);
    return isFinite(n) && n >= 0 ? Math.min(n, max || MAX_COUNT) : 0;
  }
  var MAX_EPOCH = 4102444800;

  function extract(doc) {
    if (!doc || !doc.documentElement) throw new ReportError('not-a-report');
    if (doc.getElementsByTagName('parsererror').length) throw new ReportError('not-a-report');
    var rootEl = doc.documentElement;
    if ((rootEl.localName || rootEl.nodeName) !== 'feedback') throw new ReportError('not-a-report');
    var meta = kid(rootEl, 'report_metadata'), range = kid(meta, 'date_range'), pol = kid(rootEl, 'policy_published');
    var recs = kids(rootEl, 'record');
    if (recs.length > LIMITS.records) throw new ReportError('too-big', 'That report has more than 50,000 rows, which is more than I read here.');
    var records = recs.map(function (rec) {
      var row = kid(rec, 'row'), ev = kid(row, 'policy_evaluated'), ids = kid(rec, 'identifiers'), au = kid(rec, 'auth_results');
       
      if (!/^\d+$/.test(text(row, 'count'))) throw new ReportError('not-a-report', 'One row in that report has no readable message count, so I cannot total it. Open another report.');
      return {
        ip: text(row, 'source_ip'),
        count: whole(text(row, 'count')),
        disposition: text(ev, 'disposition').toLowerCase(),
        dkim: text(ev, 'dkim').toLowerCase(),
        spf: text(ev, 'spf').toLowerCase(),
        headerFrom: text(ids, 'header_from'),
        reasons: kids(ev, 'reason').map(function (x) { return text(x, 'type').toLowerCase(); }).filter(function (t) { return OVERRIDES.indexOf(t) >= 0; }),
        spfAddress: kids(au, 'spf').some(function (d) { return isIp(text(d, 'domain')); }),
        dkimDomains: kids(au, 'dkim').map(function (d) { return text(d, 'domain'); }).filter(Boolean),
        spfDomains: kids(au, 'spf').map(function (d) { return text(d, 'domain'); }).filter(Boolean),
        dkimAuth: kids(au, 'dkim').some(function (d) { return text(d, 'result').toLowerCase() === 'pass'; }),
        spfAuth: kids(au, 'spf').some(function (d) { return text(d, 'result').toLowerCase() === 'pass'; })
      };
    });
    return {
      orgName: text(meta, 'org_name'),
      reportId: text(meta, 'report_id'),
      begin: whole(text(range, 'begin'), MAX_EPOCH),
      end: whole(text(range, 'end'), MAX_EPOCH),
      domain: text(pol, 'domain').toLowerCase(),
      policy: {
        p: POLICIES.indexOf(text(pol, 'p').toLowerCase()) >= 0 ? text(pol, 'p').toLowerCase() : '',
        sp: POLICIES.indexOf(text(pol, 'sp').toLowerCase()) >= 0 ? text(pol, 'sp').toLowerCase() : '',
        pct: numPct(text(pol, 'pct')),
        adkim: text(pol, 'adkim').toLowerCase(), aspf: text(pol, 'aspf').toLowerCase()
      },
      records: records
    };
  }

   
  function passes(r) { return r.dkim === 'pass' || r.spf === 'pass'; }
  function hasReason(r, list) { return (r.reasons || []).some(function (t) { return list.indexOf(t) >= 0; }); }
  function msgs(n) { return n + (n === 1 ? ' message' : ' messages'); }
   
  function sourceNotes(s) {
    var out = [];
    if (s.sampled) out.push(s.sampled + (s.sampled === 1 ? ' failing message was' : ' failing messages were') + ' left out by your pct setting or test mode, so your policy was not fully applied to them.');
    if (s.local) out.push('The receiver\'s own rules exempted ' + msgs(s.local) + ' from your policy. That is its decision, not a normal SPF or DKIM failure, and it does not show the mail was genuine.');
    if (s.expected) out.push('The receiver treated ' + msgs(s.expected) + ' as forwarded or mailing list mail, where a failed check is expected.');
    if (s._dkimOnly) out.push('SPF failed on some of this mail, but DKIM passed for your domain, so DMARC passed. This is often forwarded mail and needs no action.');
    if (s._address) out.push('The SPF check here ran against an address, not a domain. That comes from the receiving side, such as an internal relay, so it says nothing about your SPF record.');
    return out.length ? ' ' + out.join(' ') : '';
  }

  function summarise(report) {
    var recs = (report && report.records) || [];
    var by = Object.create(null), order = [], total = 0, passing = 0, sampled = 0, acted = 0, subdomains = [];
    var home = domainLike(String((report && report.domain) || '').toLowerCase());
    recs.forEach(function (r) {
      var n = whole(r.count);
      total += n;
      var ok = passes(r);
      if (ok) passing += n;
      var key = !r.ip ? '(no address)' : isIp(r.ip) ? r.ip : '(not a valid address)';
      var s = by[key];
      if (!s) { s = by[key] = { ip: key, count: 0, pass: 0, fail: 0, sampled: 0, local: 0, expected: 0, domains: [], note: '', _misaligned: false, _dkimOnly: false, _address: false }; order.push(key); }
      s.count += n;
      if (ok) s.pass += n; else s.fail += n;
      (r.dkimDomains || []).concat(r.spfDomains || []).forEach(function (d) {
        d = domainLike(String(d).toLowerCase());
        if (d && s.domains.indexOf(d) < 0 && s.domains.length < 10) s.domains.push(d);
      });
      if (!ok && (r.dkimAuth || r.spfAuth)) s._misaligned = true;
      if (ok && r.dkim === 'pass' && r.spf !== 'pass') s._dkimOnly = true;
      if (r.spfAddress) s._address = true;
      if (!ok) {
        if (hasReason(r, LEFT_OUT)) { s.sampled += n; sampled += n; }
        if (hasReason(r, ['local_policy'])) s.local += n;
        if (hasReason(r, EXPECTED)) s.expected += n;
        if (r.disposition === 'quarantine' || r.disposition === 'reject') acted += n;
      }
      var from = domainLike(String(r.headerFrom || '').toLowerCase());
      if (home && from && from.slice(-(home.length + 1)) === '.' + home && subdomains.indexOf(from) < 0 && subdomains.length < 5) subdomains.push(from);
    });
    var senders = order.map(function (k) { return by[k]; }).sort(function (a, b) { return b.count - a.count; });
    senders.forEach(function (s) {
      if (s.fail === 0) s.note = 'Every message from this source passed DMARC.';
      else if (s.pass === 0) {
        s.note = 'None of the messages from this source passed DMARC: neither of the two sender checks (DKIM and SPF) matched your domain.' +
          (s._misaligned ? ' It did sign or pass for another domain, which suggests a real service that is not set up for yours.' : '');
      } else s.note = 'Some messages from this source passed and some failed.';
      s.note += sourceNotes(s);
      delete s._misaligned; delete s._dkimOnly; delete s._address;
    });
    var failing = total - passing;
     
    var explained = senders.reduce(function (a, s) { return a + Math.min(s.fail, s.local + s.expected); }, 0);
    var failFromDead = senders.reduce(function (a, s) { return a + (s.pass === 0 ? s.fail - Math.min(s.fail, s.local + s.expected) : 0); }, 0);
    var verdict = total === 0 ? 'empty'
      : failing === 0 ? 'clean'
      : (failing * 2 > total && failFromDead * 2 > total) ? 'mostly-spoofed'
      : 'senders-failing';
    var share = total ? failing / total : 0;
    var readyFor = total === 0 ? 'stay-at-none' : failing === 0 ? 'reject' : share <= 0.02 ? 'quarantine' : 'stay-at-none';
     
    var current = (report && report.policy && report.policy.p) || 'none';
    if (current === 'reject' && readyFor === 'reject') readyFor = 'at-reject';
    else if (current !== 'none' && readyFor === 'quarantine') readyFor = 'hold';
    var actions = [];
    if (verdict === 'empty') actions.push('This report has no mail in it. Open a report from another day.');
    else {
      if (verdict !== 'clean') {
        actions.push('Look at the sources that fail. For each one you recognise (your email provider, invoicing, newsletters, a website form), ask that service how to sign mail for your domain (DKIM) or add it to your SPF record.');
        actions.push('Leave sources you do not recognise alone for now. A failing source can be a real service you forgot, or someone sending as you; one report cannot tell which.');
      }
      if (sampled) actions.push('Your pct setting or test mode left out ' + sampled + ' of ' + failing + ' failing messages, so those did not get your full policy. Do not read this report as your policy working on all mail. Receivers differ on pct, so the share can change from one report to the next.');
      var subs = ' First confirm nothing real sends from a subdomain: subdomains follow your policy unless the record sets sp=.';
      if (readyFor === 'stay-at-none') actions.push('Do not make your policy stricter for now, so a real message from a service that is not yet set up is not blocked.');
      else if (readyFor === 'hold') actions.push('Keep your policy where it is until every real sender passes.');
      else if (readyFor === 'at-reject') actions.push('Your policy is already at reject, the strongest setting. Leave it there and keep reading your reports.');
      else if (readyFor === 'quarantine') actions.push('If the next few reports look like this, you could move to quarantine (suspect mail goes to junk), but some receivers may apply it to all failing mail at once, so first make sure every real sender passes.' + subs);
      else if (current === 'quarantine') actions.push('If the next few reports look like this, and quarantine has run quietly for a few weeks, you could go to reject.' + subs);
      else actions.push('If the next few reports look like this, you could move to quarantine first, then to reject once that has run quietly for a few weeks.' + subs);
      actions.push('This is judged from one report only. Read a few weeks of reports, from each provider that sends them, before you change the policy.');
    }
    return { verdict: verdict, total: total, passing: passing, failing: failing, senders: senders, readyFor: readyFor, actions: actions,
      sampled: sampled, explained: explained, acted: acted, subdomains: subdomains };
  }

  return {
    LIMITS: LIMITS,
    COVERAGE: COVERAGE,
    isIp: isIp,
    orgLabel: function (name) { var t = clean(name, ORG_CAP); return ORG_NAME.test(t) ? t : ''; },
    domainLike: domainLike,
    MESSAGES: MESSAGES,
    ReportError: ReportError,
    detectType: detectType,
    readToText: readToText,
    zipExtraFiles: zipExtraFiles,
    checkXml: checkXml,
    extract: extract,
    summarise: summarise
  };
});
