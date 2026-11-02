

(function (root, factory) {
  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.IETools;
  var api = factory(core || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.emailSpoofing = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  var DKIM_SELECTORS = ['google', 'selector1', 'selector2', 'default', 'k1', 'k2', 'k3', 's1', 's2', 'mail', 'dkim', 'smtp', 'mandrill', 'mxvault', 'everlytickey1', 'everlytickey2', 'zendesk1', 'zendesk2', 'cm', 'pm', 'sendgrid', 'smtpapi', 'mailjet', 'hs1', 'hs2', 'sig1', 'protonmail', 'protonmail2', 'fm1', 'fm2', 'fm3', 'key1', 'dk', 'mimecast20190104', 'mimecast', 'pp', 'ppfrom', 'krs', 'sm', '20230601', 'zoho', 'zmail', 'ctct1', 'ctct2', 'selector', 'x', 'a1', 'ml', 'titan1'];
  var T = { CNAME: 5, MX: 15, TXT: 16, DS: 43, CAA: 257 };
  var MAX_DEPTH = 10, SPF_LIMIT = 10, MAILTO_CAP = 1800;
  var POLICIES = ['none', 'quarantine', 'reject'];
  var ALL_TERM = /^[+\-~?]?all$/i;
  var SHARED_SUFFIXES = core.SHARED_SUFFIXES || [];
  var PCT_NOTE = 'Some receivers apply pct and report the rest as sampled_out; others follow the newer standard (RFC 9989), which dropped pct, and apply the policy to all failing mail.';

   
  function clean(s) { return core.cleanText(s); }
  function isBudget(e) { return !!e && e.name === 'DnsBudgetError'; }
  function isUnavailable(e) { return !!e && e.name === 'DnsUnavailable'; }
  function txtOf(res, txtStrings) {
    return res.answers.filter(function (a) { return a.type === T.TXT; }).map(function (a) { return clean(txtStrings(a.data)); });
  }

   
  function txtStrings(data) {
    var s = String(data == null ? '' : data).trim();
    var un = function (x) { return x.replace(/\\(\d{3}|.)/g, function (_, c) { return c.length === 3 ? String.fromCharCode(parseInt(c, 10)) : c; }); };
    if (s.charAt(0) !== '"') return un(s);
    var out = [], re = /"((?:[^"\\]|\\.)*)"/g, m;
    while ((m = re.exec(s))) out.push(un(m[1]));
    return out.join('');
  }
  var txts = function (res) { return txtOf(res, txtStrings); };
  var KEEP_TAGS = ' Keep any other tags in your current record that this line leaves out.';
  var SUBDOMAIN_WARN = ' Subdomains follow this policy too unless the record sets sp=, so first confirm nothing real sends from a subdomain. Mail that is refused bounces, and you get no warning.';
  var isSpf = function (t) { return /^v=spf1(\s|$)/i.test(t); };

   
  var PROVIDERS = [['Google Workspace', ['.google.com', '.googlemail.com']], ['Microsoft 365', ['.protection.outlook.com', '.mail.outlook.com']],
    ['Mimecast', ['.mimecast.com', '.mimecast.com.au']], ['Proofpoint', ['.pphosted.com', '.ppe-hosted.com']],
    ['Barracuda', ['.barracudanetworks.com']], ['Zoho', ['.zoho.com', '.zoho.com.au', '.zoho.eu']], ['Broadcom', ['.messagelabs.com']],
    ['MailGuard', ['.mailguard.com.au']], ['GoDaddy', ['.secureserver.net']], ['Proton', ['.protonmail.ch', '.proton.me']]];
  function provider(mxs) {
    var hosts = mxs.map(function (x) { return String(x).toLowerCase().replace(/\.$/, ''); });
    for (var i = 0; i < PROVIDERS.length; i++) {
      var ends = PROVIDERS[i][1];
      if (hosts.some(function (h) { return ends.some(function (e) { return h.slice(-e.length) === e; }); })) return PROVIDERS[i][0];
    }
    return mxs.length ? 'Another provider' : 'None';
  }

   
  

  async function spfLookups(domain, dns, rootTxts) {
    var ctx = { seen: new Set(), counted: new Map(), capped: false, all: null, open: false, broken: false, macro: false };
    var lookups = await walk(domain, 0, dns, ctx, true, rootTxts || null);
    return { lookups: lookups, capped: ctx.capped, all: ctx.all, open: ctx.open, broken: ctx.broken, macro: ctx.macro };
  }
  

  function wideRange(t) {
    var v4 = /^ip4:[\d.]+\/(\d{1,2})$/.exec(t), v6 = /^ip6:[0-9a-f:.]+\/(\d{1,3})$/.exec(t);
    return (!!v4 && Number(v4[1]) < 8) || (!!v6 && Number(v6[1]) < 16);
  }
  async function walk(domain, depth, dns, ctx, viaRedirect, given) {
    if (depth > MAX_DEPTH) { ctx.capped = true; return 0; }
    

    if (domain.indexOf('%') >= 0) { if (viaRedirect) ctx.capped = true; else ctx.macro = true; return 0; }
    

    if (ctx.seen.has(domain)) {
      if (!ctx.counted.has(domain)) ctx.broken = true;
      return ctx.counted.get(domain) || 0;
    }
    ctx.seen.add(domain);
    var recs;
    if (given) recs = given;
    else {
      try { recs = txts(await dns.query(domain, 'TXT')); }
      catch (e) { if (isBudget(e) || isUnavailable(e)) { ctx.capped = true; ctx.counted.set(domain, 0); return 0; } throw e; }
    }
    var spf = recs.filter(isSpf);
     
    if (!spf.length) { if (depth > 0) ctx.broken = true; ctx.counted.set(domain, 0); return 0; }
    if (spf.length > 1 && depth > 0) ctx.broken = true;
    var n = 0, terms = spf[0].split(/\s+/).slice(1);
    for (var i = 0; i < terms.length; i++) {
      var raw = terms[i], t = raw.replace(/^[+\-~?]/, '').toLowerCase();
      if (!/^[\-~?]/.test(raw) && (wideRange(t) || (t === 'all' && !viaRedirect))) ctx.open = true;
      if (t === 'all') { if (viaRedirect && ctx.all == null) ctx.all = (/^[+\-~?]/.test(raw) ? raw.charAt(0) : '+') + 'all'; continue; }
      if (t.indexOf('include:') === 0) n += 1 + await walk(t.slice(8), depth + 1, dns, ctx, false, null);
       
      else if (t.indexOf('redirect=') === 0) { if (!terms.some(function (x) { return ALL_TERM.test(x); })) n += 1 + await walk(t.slice(9), depth + 1, dns, ctx, viaRedirect, null); }
      else if (/^(a|mx|ptr)$/.test(t) || /^(a|mx|ptr|exists)[:\/]/.test(t)) n += 1;
    }
    ctx.counted.set(domain, n);
    return n;
  }

   
  function emptyModel(domain) {
    return { domain: domain, exists: true, mx: [], nullMx: false, sends: false, provider: 'None',
      spf: { records: [], all: null, lookups: 0, capped: false, open: false, broken: false, macro: false }, dmarc: null, dkim: [], dkimUnread: false,
      mtaSts: false, tlsRpt: false, bimi: false, caa: [], dnssec: false, checkedAt: new Date(),
      unread: { mx: false, txt: false, dmarc: false, mtaSts: false, tlsRpt: false, bimi: false, caa: false, dnssec: false } };
  }

  

  function unreadable(res) { return !res || (res.status !== 0 && res.status !== 3); }

  

  var RUA_PART = /^mailto:[A-Za-z0-9._%+\-]+@([A-Za-z0-9.\-]+)(![0-9]+[kmgtKMGT]?)?$/;
  function parseRua(raw, domain) {
    var out = { rua: '', state: 'none', external: false };
    var text = String(raw || '').trim();
    if (!text) return out;
    var parts = text.split(',').map(function (x) { return x.trim(); });
    var ok = parts.length <= 5 && parts.every(function (x) { return x.length <= 254 && RUA_PART.test(x); });
    if (!ok) { out.state = 'invalid'; return out; }
    out.rua = parts.join(',');
    out.state = 'ok';
    out.external = parts.some(function (x) {
      var h = RUA_PART.exec(x)[1].toLowerCase();
      return h !== domain && h.slice(-(domain.length + 1)) !== '.' + domain;
    });
    return out;
  }
  function parsePct(raw) {
    var t = String(raw == null ? '100' : raw).trim();
    return /^\d{1,3}$/.test(t) && Number(t) <= 100 ? String(Number(t)) : 'invalid';
  }

  async function inspect(domain, dns, dkimDns, onStep) {
    var say = typeof onStep === 'function' ? onStep : function () {};
    var opt = { allowFailure: true };
    var m = emptyModel(domain);
    say('Reading mail servers...');
    var mxRes = await dns.query(domain, 'MX', opt);
    if (mxRes.status === 3) { m.exists = false; return m; }
    m.unread.mx = unreadable(mxRes);
    var mxRaw = mxRes.answers.filter(function (a) { return a.type === T.MX; }).map(function (a) { return clean(a.data).split(/\s+/).pop(); });
    m.mx = mxRaw.filter(function (x) { return x && x !== '.'; }).map(function (x) { return x.replace(/\.$/, ''); });
    m.nullMx = !m.mx.length && mxRaw.some(function (x) { return x === '.' || x === ''; });
    m.sends = m.mx.length > 0;
    m.provider = provider(m.mx);

    say('Reading SPF, DMARC and transport records...');
    var r = await Promise.all([
      dns.query(domain, 'TXT', opt), dns.query('_dmarc.' + domain, 'TXT', opt), dns.query('_mta-sts.' + domain, 'TXT', opt),
      dns.query('_smtp._tls.' + domain, 'TXT', opt), dns.query('default._bimi.' + domain, 'TXT', opt),
      dns.query(domain, 'CAA', opt), dns.query(domain, 'DS', opt)
    ]);
    m.unread.txt = unreadable(r[0]); m.unread.dmarc = unreadable(r[1]); m.unread.mtaSts = unreadable(r[2]);
    m.unread.tlsRpt = unreadable(r[3]); m.unread.bimi = unreadable(r[4]); m.unread.caa = unreadable(r[5]); m.unread.dnssec = unreadable(r[6]);
    var rootTxt = txts(r[0]);
    m.spf.records = rootTxt.filter(isSpf);
    if (m.spf.records.length) {
      var s = await spfLookups(domain, dns, rootTxt);
      m.spf.lookups = s.lookups; m.spf.capped = s.capped; m.spf.open = s.open; m.spf.broken = s.broken; m.spf.macro = s.macro; m.spf.all = s.all == null ? 'none' : s.all;
    }
    var dm = txts(r[1]).filter(function (t) { return /^v=dmarc1\s*(;|$)/i.test(t); });
    if (dm.length) {
      var tags = Object.create(null);
      dm[0].split(';').forEach(function (kv) {
        var i = kv.indexOf('='), k = kv.slice(0, Math.max(i, 0)).trim().toLowerCase();
        if (i > 0 && !(k in tags)) tags[k] = kv.slice(i + 1).trim();
      });
      var p = (tags.p || '').toLowerCase();
      var ru = parseRua(tags.rua, domain);
      m.dmarc = { record: dm[0], p: dm.length > 1 || POLICIES.indexOf(p) < 0 ? '' : p,
        sp: POLICIES.indexOf((tags.sp || '').toLowerCase()) >= 0 ? tags.sp.toLowerCase() : '',
        adkim: /^[rs]$/i.test(tags.adkim || '') ? tags.adkim.toLowerCase() : '',
        aspf: /^[rs]$/i.test(tags.aspf || '') ? tags.aspf.toLowerCase() : '',
        test: /^y$/i.test(tags.t || ''),
        pct: parsePct(tags.pct), rua: ru.rua, ruaState: ru.state, ruaExternal: ru.external, count: dm.length };
    }
    m.mtaSts = txts(r[2]).some(function (t) { return /v=STSv1/i.test(t); });
    m.tlsRpt = txts(r[3]).some(function (t) { return /v=TLSRPTv1/i.test(t); });
    m.bimi = txts(r[4]).some(function (t) { return /v=BIMI1/i.test(t); });
    m.caa = r[5].answers.filter(function (a) { return a.type === T.CAA; }).map(function (a) { return clean(a.data); });
    m.dnssec = r[6].answers.some(function (a) { return a.type === T.DS; });

    say('Looking for DKIM signing keys...');
    var errors = 0, lastErr = null;
    var found = await poolMap(DKIM_SELECTORS, 8, async function (sel) {
      try {
        var res = await dkimDns.query(sel + '._domainkey.' + domain, 'TXT');
        var hit = res.answers.some(function (a) {
          return a.type === T.TXT && /(^|;)\s*p=[A-Za-z0-9+\/=]+/.test(txtStrings(a.data));
        });
        return hit ? sel : null;
      } catch (e) {
        if (e && (e.name === 'DnsCancelled')) throw e;
        errors++; lastErr = e; return null;
      }
    });
    if (errors === DKIM_SELECTORS.length) throw lastErr;
    m.dkim = found.filter(Boolean);
    m.dkimUnread = errors > 0 && !m.dkim.length;
    m.checkedAt = new Date();
    return m;
  }
  async function poolMap(items, size, fn) {
    var out = new Array(items.length), i = 0;
    await Promise.all(Array.from({ length: size }, async function () {
      while (i < items.length) { var k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
  }

   
  function pctFull(d) { return d.pct === '100'; }
   
  function keptTags(d) { return (d.sp ? '; sp=' + d.sp : '') + (d.adkim ? '; adkim=' + d.adkim : '') + (d.aspf ? '; aspf=' + d.aspf : ''); }
  function unreadRequired(m) { var u = m.unread || {}; return !!(u.mx || u.txt || u.dmarc); }
  function dmarcEnforced(d) { return !!d && (d.p === 'quarantine' || d.p === 'reject'); }
  

  function dmarcApplied(d) { return dmarcEnforced(d) && d.pct !== '0' && !d.test; }
  function dmarcCatches(d) { return dmarcApplied(d) || (dmarcEnforced(d) && d.p === 'reject'); }
  function hasRedirect(m) {
    var terms = String(m.spf.records[0] || '').trim().split(/\s+/);
    return terms.some(function (t) { return /^redirect=/i.test(t); }) && !terms.some(function (t) { return ALL_TERM.test(t); });
  }
  function spfProblem(m) {
    var s = m.spf;
    if (!s.records.length) return 'missing';
    if (s.records.length > 1) return 'two';
    if (s.open) return 'open';
    if (s.broken) return 'broken';
    if (s.capped && hasRedirect(m) && (s.all === 'none' || s.all == null)) return 'capped';
    if (s.all === '+all' || s.all === '?all' || s.all === 'none' || s.all == null) return 'weak-all';
    if (s.capped) return 'capped';
    if (s.lookups > SPF_LIMIT) return 'lookups';
    return null;
  }
  function spfNamesSenders(m) {
    var r = m.spf.records[0];
    return !!r && r.trim().split(/\s+/).slice(1).some(function (t) { return !/^[+\-~?]?all$/i.test(t) && !/^exp=/i.test(t); });
  }
  function isLocked(m) { return !!m.dmarc && m.dmarc.p === 'reject' && pctFull(m.dmarc) && !m.dmarc.test && m.spf.all === '-all' && !spfNamesSenders(m); }
   
  function maySend(m) { return spfNamesSenders(m) || m.dkim.length > 0; }
  function likelySubdomain(domain) {
    var l = String(domain).split('.');
    if (l.length <= 2) return false;
    if (l.length === 3 && SHARED_SUFFIXES.indexOf(l.slice(-2).join('.')) >= 0) return false;
    return true;
  }
  var SUBDOMAIN_NOTE = ' A subdomain can inherit the DMARC record of its main domain, so check the main domain as well before you add one here.';

  

  var SPF_DOMAIN = '[A-Za-z0-9._\\-]{1,253}';
  var SPF_TERM = new RegExp('^(?:v=spf1|[+\\-~?]?all|[+\\-~?]?(?:include|exists):' + SPF_DOMAIN + '|[+\\-~?]?(?:a|mx)(?::' + SPF_DOMAIN + ')?(?:/\\d{1,2})?(?://\\d{1,3})?' +
    '|[+\\-~?]?ptr(?::' + SPF_DOMAIN + ')?|[+\\-~?]?ip4:\\d{1,3}(?:\\.\\d{1,3}){3}(?:/\\d{1,2})?|[+\\-~?]?ip6:[0-9A-Fa-f:.]{2,45}(?:/\\d{1,3})?|redirect=' + SPF_DOMAIN + '|exp=' + SPF_DOMAIN + ')$', 'i');
  function spfTermsOk(record) {
    var terms = String(record).trim().split(/\s+/);
    return terms.length <= 60 && String(record).length <= 450 && terms.every(function (t) { return SPF_TERM.test(t); });
  }
  

  function fixSpfAll(record) {
    if (!spfTermsOk(record)) return null;
    var terms = String(record).trim().split(/\s+/), done = false;
    if (terms.some(function (t) { return /^redirect=/i.test(t); })) return null;
    terms = terms.map(function (t) { if (/^[+?]?all$/i.test(t)) { done = true; return '~all'; } return t; });
    if (!done && !terms.some(function (t) { return /^[\-~]all$/i.test(t); })) terms.push('~all');
    return terms.join(' ');
  }
  function spfInclude(p) {
    return { 'Microsoft 365': 'include:spf.protection.outlook.com', 'Google Workspace': 'include:_spf.google.com', 'Zoho': 'include:zohomail.com' }[p] || 'include:<your mail provider>';
  }

   
  function firstGap(m) {
    var d = m.dmarc;
    if (d && !pctFull(d)) return 'Raise the DMARC percentage to 100 once your real senders are confirmed.';
    if (d && d.sp === 'none') return 'Your record leaves subdomains open to fake mail. Ask whoever manages your DNS to change sp=none to sp=quarantine, once you know nothing real sends from a subdomain.';
    var sp = spfProblem(m);
    if (sp === 'missing') return 'Publish one SPF record that lists the services which send as you.';
    if (sp === 'two') return 'Merge your two SPF records into one.';
    if (sp === 'open') return 'Narrow your SPF record: it allows nearly any server to send as you.';
    if (sp === 'broken') return 'Fix your SPF record: one of its includes leads nowhere.';
    if (sp === 'weak-all') return hasRedirect(m) ? 'Check the record your SPF redirect points to: the ending is set there, so leave your own record as it is.' : 'Change the end of your SPF record to ~all.';
    if (sp === 'capped') return 'Check your SPF record by hand: it chains through more lookups than I will follow.';
    if (sp === 'lookups') return 'Trim your SPF record to 10 lookups or fewer.';
    if (!m.dkim.length) return m.dkimUnread ? 'Run this check again: some DKIM lookups did not answer.' : 'Turn on DKIM signing for this domain in your mail provider settings.';
    return '';
  }

  function verdict(m) {
    var d = m.domain;
    if (!m.exists) return { code: 'no-domain', head: 'I cannot find that domain.',
      body: 'No DNS record exists for ' + d + '. It may be mistyped or not registered.', todo: 'Check the spelling and try again.' };
    if (unreadRequired(m)) {
      var what = [m.unread.mx ? 'mail servers' : '', m.unread.txt ? 'SPF' : '', m.unread.dmarc ? 'DMARC' : ''].filter(Boolean).join(', ');
      return { code: 'unreadable', head: 'I could not read all of your records.',
        body: 'A public DNS service answered with an error for your ' + what + ' records, so I cannot say what they say. This tells you nothing about your domain.',
        todo: 'Try again in a few minutes.' };
    }
    var dm = m.dmarc;
    if (spfProblem(m) === 'open' || m.spf.all === '+all') return { code: 'spoofable', head: 'Your records say others can send email as ' + d + '.',
      body: 'Your SPF record allows nearly any server, so fake mail can pass DMARC whatever its policy says.',
      todo: 'Narrow your SPF record to the exact addresses your mail services give you.' };
    if (!m.sends) {
      if (isLocked(m)) return { code: dm.sp === 'none' ? 'partial' : 'locked', head: 'Your records say this domain refuses to send email.',
        body: 'It lists no mail servers, its SPF record allows no sender, and DMARC says to reject anything that claims to come from it.' + (dm.sp === 'none' ? ' Its sp=none setting leaves subdomains out of that.' : ''),
        todo: dm.sp === 'none' ? 'Change sp=none to sp=reject, once you have confirmed nothing real sends from a subdomain.' : 'Nothing to change.' };
      if (maySend(m)) return { code: dmarcCatches(dm) ? 'partial' : 'spoofable', head: 'Your records do not agree on whether this domain sends email.',
        body: 'It lists no mail servers, but its SPF record or a DKIM key suggests something sends as it. A domain can send email without receiving any.',
        todo: 'Find out what sends for this domain before you add anything.' };
      if (m.dkimUnread) return { code: 'unreadable', head: 'I could not read all of your records.',
        body: 'Some DKIM lookups did not answer, so I cannot say whether this domain sends email.', todo: 'Try again in a few minutes.' };
      return { code: 'spoofable', head: 'Your records say others can send email as ' + d + '.',
        body: 'This domain lists no mail servers, but it does not tell receivers to reject mail sent in its name. If it never sends email, two records fix that.',
        todo: 'If it never sends email, use the two records shown below.' };
    }
    if (!dm) return { code: 'spoofable', head: 'Your records say fake email from your address would be delivered.',
      body: 'There is no DMARC record, so nothing tells receiving servers to refuse mail that fakes your address.' + (likelySubdomain(d) ? SUBDOMAIN_NOTE : ''),
      todo: 'Add the watch-only DMARC record below. It only asks for reports, so it should not change how your real email is delivered.' };
    if (dm.count > 1) return { code: 'spoofable', head: 'Your records say fake email from your address would be delivered.',
      body: 'More than one DMARC record at the same name makes receivers ignore all of them.', todo: 'Keep one record and delete the others.' };
    if (!dmarcEnforced(dm)) return { code: 'spoofable', head: 'Your records say fake email from your address would be delivered.',
      body: dm.p === 'none' ? 'Your DMARC record is in watch-only mode (p=none), so fake mail is still delivered.' : 'Your DMARC record has no valid policy, so it does not protect you.',
      todo: dm.p === 'none' ? 'Read your DMARC reports, then move to p=quarantine as shown below.' : 'Replace the record with the one shown below.' };
    if (!dmarcApplied(dm)) {
      var eased = dm.test ? 't=y' : 'pct=0';
      var easedTodo = 'Remove ' + eased + ' once your reports look clean, as shown below.';
      if (dmarcCatches(dm)) return { code: 'partial', head: 'Your records say fake email is mostly caught, with gaps.',
        body: 'Your DMARC record says reject, but ' + eased + ' asks receivers to go one level lower, so suspected fake mail goes to junk at most.', todo: easedTodo };
      return { code: 'spoofable', head: 'Your records say fake email from your address would be delivered.',
        body: 'Your DMARC record says quarantine, but ' + eased + ' asks receivers to go one level lower, so fake mail can still be delivered.', todo: easedTodo };
    }
    var gap = firstGap(m);
    if (gap) return { code: 'partial', head: 'Your records say fake email is mostly caught, with gaps.',
      body: 'DMARC tells receivers to ' + (dm.p === 'reject' ? 'refuse' : 'send suspected') + ' fake mail' + (dm.p === 'reject' ? '' : ' to junk') + ', but something around it is incomplete.', todo: gap };
    return { code: 'enforced', head: 'Your records say fake email from your address is turned away.',
      body: 'DMARC is set to ' + dm.p + ' for all mail, and SPF and DKIM are in place' + (m.mtaSts ? ', with an MTA-STS record' : '') + '. That is what the public records show; I cannot see whether every real sender signs its mail.',
      todo: !dm.rua ? 'Nothing urgent. Add a reporting address (rua=) to your DMARC record, so you can see who sends as you.'
        : !m.mtaSts && !(m.unread && m.unread.mtaSts) ? 'Nothing urgent. MTA-STS would make mail sent to you travel encrypted. This one is not about fake mail.'
        : 'Nothing urgent. Read your DMARC reports now and then.' };
  }

   
  function firstFix(m, v, rows) {
    if (v.code === 'enforced' || v.code === 'locked') return null;
    var id = '', sp = spfProblem(m);
    if (sp === 'open' || m.spf.all === '+all') id = 'spf';
    else if (v.code === 'partial' && m.sends) {
      var d = m.dmarc;
      id = d && !dmarcApplied(d) ? 'dmarc' : d && !pctFull(d) ? 'dmarc' : d && d.sp === 'none' ? 'dmarc-sp' : sp ? 'spf' : 'dkim';
    }
    var hit = id ? rows.filter(function (r) { return r.id === id; })[0] : rows.filter(function (r) { return r.fix && r.status !== 'pass'; })[0];
    return hit && hit.fix ? hit : null;
  }

   
  function buildChecks(m) {
    var d = m.domain, rows = [];
    var dm = m.dmarc, u = m.unread || {};
    var usable = !!dm && dm.ruaState === 'ok';
    var rua = usable ? dm.rua : 'mailto:dmarc-reports@' + d;
    var ruaNote = usable ? '' : (dm && dm.ruaState === 'invalid' ? ' The reporting address in your current record could not be reused as it stands, so check it before you publish this.' : '') +
      ' Create the mailbox dmarc-reports@' + d + ', or put the address of a reporting service in its place.';
    var ruaExt = usable && dm.ruaExternal ? ' Your reports currently go to an address at another domain. Check that you trust whoever runs it; the address is in the record above.' : '';
    var sub = likelySubdomain(d) ? SUBDOMAIN_NOTE : '';
    if (!m.exists) return rows;
    rows.push({ id: 'mx', status: u.mx ? 'warn' : 'info',
      title: u.mx ? 'I could not read the mail servers' : m.sends ? 'Mail is handled by ' + m.provider : (m.nullMx ? 'This domain says it receives no email' : 'No mail servers listed'),
      tag: 'MX', text: u.mx ? 'A public DNS service answered with an error, so I do not know what the mail servers are.' : m.sends ? 'These servers receive email for your domain.' : 'There is no working mail server in the records, so I treat this domain as one that does not send email.',
      record: u.mx ? 'Not read' : m.mx.length ? m.mx.join('\n') : (m.nullMx ? 'MX 0 .' : 'No MX record at ' + d) });
    if (unreadRequired(m)) {
      if (u.dmarc) rows.push({ id: 'dmarc', status: 'warn', title: 'I could not read the DMARC record', tag: 'DMARC', text: 'A public DNS service answered with an error, so I cannot say whether you have a DMARC record. Try again in a few minutes.', record: 'Not read' });
      if (u.txt) rows.push({ id: 'spf', status: 'warn', title: 'I could not read the SPF record', tag: 'SPF', text: 'A public DNS service answered with an error, so I cannot say whether you have an SPF record. Try again in a few minutes.', record: 'Not read' });
      return rows;
    }

    if (!m.sends) {
      var locked = isLocked(m), names = maySend(m), unsure = !locked && !names && m.dkimUnread;
      rows.push({ id: 'lockdown', status: locked ? 'pass' : names || unsure ? 'warn' : 'fail', title: locked ? 'Locked against spoofing' : names || unsure ? 'Unclear whether this domain sends email' : 'Not locked against spoofing', tag: 'SPF + DMARC',
        text: locked ? 'Your records say nothing may send as this domain and receivers should reject anything that tries.'
          : names ? 'This domain lists no mail servers, but its SPF record or a DKIM key suggests something sends as it. Find out what first: locking the domain down would block it.' + sub
          : unsure ? 'Some DKIM lookups did not answer, so I cannot say whether this domain sends email. Try again in a few minutes.'
          : 'This domain lists no mail servers, but it does not tell receivers to reject mail sent in its name. Scammers favour domains like this.' + sub,
        record: [m.spf.records[0], dm && dm.record].filter(Boolean).join('\n') || 'No SPF or DMARC record',
        fix: locked || names || m.dkimUnread ? undefined : { label: 'If this domain never sends email, use these two records, replacing any SPF or DMARC record it has', value: d + '  TXT  "v=spf1 -all"\n_dmarc.' + d + '  TXT  "v=DMARC1; p=reject' + (dm && dm.count === 1 ? keptTags(dm) : '') + (usable ? '; rua=' + rua : '') + '"' },
        after: locked || names || m.dkimUnread ? undefined : SUBDOMAIN_WARN.trim() });
    } else if (!dm) {
      rows.push({ id: 'dmarc', status: 'fail', title: 'No DMARC policy', tag: 'DMARC',
        text: 'DMARC is the record that tells mail servers what to do with email faking your address. Without it, fake invoices and payment requests can reach inboxes looking like they came from you.' + sub,
        record: 'No record at _dmarc.' + d,
        fix: { label: 'Start here (watch only)', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=none; rua=' + rua + '"' },
        after: 'After 2-4 weeks of reports, once every real sender passes, move to p=quarantine, then p=reject.' + ruaNote });
    } else if (dm.count > 1) {
      rows.push({ id: 'dmarc', status: 'fail', title: 'Two DMARC records', tag: 'DMARC', text: 'More than one DMARC record at the same name makes receivers ignore all of them.', record: dm.record,
        fix: { label: 'Keep one record, delete the others', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=none; rua=' + rua + '"' }, after: (ruaNote + ruaExt).trim() || undefined });
    } else if (dm.p === 'none') {
      rows.push({ id: 'dmarc', status: 'fail', title: 'DMARC is set to watch only', tag: 'DMARC',
        text: 'You have a DMARC record, but p=none means fake email using your domain is still delivered.', record: dm.record,
        fix: { label: 'Next step once your reports look clean', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=quarantine' + keptTags(dm) + '; rua=' + rua + '"' },
        after: (usable ? 'Expect receivers to apply this to all failing mail. Run it for a few weeks, then switch to p=reject.' : 'Add a reporting address (rua) first, so you can see who sends as you before tightening.' + ruaNote) + ruaExt + KEEP_TAGS + SUBDOMAIN_WARN });
    } else if (dm.test && dmarcEnforced(dm)) {
      rows.push({ id: 'dmarc', status: 'warn', title: 'DMARC is in test mode', tag: 'DMARC', text: 'The record sets t=y, which asks receivers to apply one level below your policy: junk instead of refused, or normal delivery instead of junk.', record: dm.record,
        fix: { label: 'Once your reports look clean, remove t=y', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=' + dm.p + keptTags(dm) + '; rua=' + rua + '"' },
        after: ('Keep any other tags in your current record, except t=y.' + ruaNote + ruaExt + SUBDOMAIN_WARN).trim() });
    } else if (dm.p === 'quarantine' && !pctFull(dm)) {
      rows.push({ id: 'dmarc', status: 'warn', title: dm.pct === 'invalid' ? 'DMARC percentage is not a valid number' : 'DMARC asks receivers to quarantine only ' + dm.pct + '% of fake mail', tag: 'DMARC',
        text: (dm.pct === 'invalid' ? 'The pct value in the record is not a whole number from 0 to 100.' : 'This is part-way. Where a receiver honours pct, the rest of the fake mail is delivered normally.') + ' ' + PCT_NOTE, record: dm.record,
        fix: { label: 'Raise coverage to 100%', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=quarantine' + keptTags(dm) + '; rua=' + rua + '"' }, after: (KEEP_TAGS + ruaNote + ruaExt + SUBDOMAIN_WARN).trim() });
    } else if (dm.p === 'quarantine') {
      rows.push({ id: 'dmarc', status: 'pass', title: 'DMARC sends fake mail to spam', tag: 'DMARC',
        text: 'Once your real senders are confirmed, p=reject tells receivers to refuse fake mail.', record: dm.record,
        fix: { label: 'Optional final step', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=reject' + keptTags(dm) + '; rua=' + rua + '"' }, after: (KEEP_TAGS + ruaNote + ruaExt + SUBDOMAIN_WARN).trim() });
    } else if (dm.p === 'reject' && !pctFull(dm)) {
      rows.push({ id: 'dmarc', status: 'warn', title: dm.pct === 'invalid' ? 'DMARC percentage is not a valid number' : 'DMARC asks receivers to reject only ' + dm.pct + '% of fake mail', tag: 'DMARC',
        text: (dm.pct === 'invalid' ? 'The pct value in the record is not a whole number from 0 to 100.' : 'This is part-way. Where a receiver honours pct, the rest of the fake mail is treated as quarantine instead.') + ' ' + PCT_NOTE, record: dm.record,
        fix: { label: 'Raise coverage to 100%', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=reject' + keptTags(dm) + '; rua=' + rua + '"' }, after: (KEEP_TAGS + ruaNote + ruaExt + SUBDOMAIN_WARN).trim() });
    } else if (dm.p === 'reject') {
      rows.push({ id: 'dmarc', status: 'pass', title: 'DMARC rejects fake mail', tag: 'DMARC', text: 'This is the strongest setting. Receivers are told to refuse email that fakes your domain.' + ruaExt, record: dm.record });
    } else {
      rows.push({ id: 'dmarc', status: 'fail', title: 'DMARC record has no valid policy', tag: 'DMARC', text: 'The record exists, but its p= value is not none, quarantine or reject, so it does not protect you.', record: dm.record,
        fix: { label: 'Replace it with', value: '_dmarc.' + d + '  TXT  "v=DMARC1; p=none; rua=' + rua + '"' }, after: (ruaNote + ruaExt).trim() || undefined });
    }
    if (dm && dm.count === 1 && dmarcEnforced(dm) && dm.sp === 'none') rows.push({ id: 'dmarc-sp', status: 'warn', title: 'Subdomains are left out of your DMARC policy', tag: 'DMARC',
      text: 'The record sets sp=none, so fake mail from a name under your domain is still delivered. Change it to sp=quarantine or sp=reject once you have confirmed nothing real sends from a subdomain.', record: dm.record });
    if (!m.sends) return rows;

    var s = m.spf, sp = spfProblem(m);
    if (sp === 'missing') rows.push({ id: 'spf', status: 'fail', title: 'No SPF record', tag: 'SPF', text: 'SPF is the list of servers allowed to send your email. Nothing lists them.', record: 'No v=spf1 record at ' + d,
      fix: { label: 'Add (adjust for every service that sends as you)', value: d + '  TXT  "v=spf1 ' + spfInclude(m.provider) + ' ~all"' } });
    else if (sp === 'two') rows.push({ id: 'spf', status: 'fail', title: 'Two SPF records cancel each other out', tag: 'SPF', text: 'Mail servers treat more than one SPF record as an error, so SPF fails for every message.', record: s.records.join('\n'),
      fix: { label: 'Merge them into one record', value: 'Combine every include: from both records into a single "v=spf1 ... ~all" record, then delete the other.' } });
    else if (sp === 'broken') rows.push({ id: 'spf', status: 'fail', title: 'SPF has an include that leads nowhere', tag: 'SPF', text: 'One include or redirect in your record leads to a name with no usable SPF record, or back to itself. Receivers treat that as an error, so SPF can fail for your real mail.', record: s.records[0],
      fix: { label: 'How to fix', value: 'Remove any include: for a service you no longer use, or get the current line from that service. I have not rewritten this record.' } });
    else if (sp === 'open') rows.push({ id: 'spf', status: 'fail', title: 'SPF allows nearly any server', tag: 'SPF', text: 'A very wide IP range, or an include that ends in +all, lets almost any server pass SPF as you. Fake mail that passes SPF can pass DMARC too.', record: s.records[0],
      fix: { label: 'How to fix', value: 'Replace wide ranges with the exact addresses your mail services give you, and remove any include you do not recognise. I have not rewritten this record.' } });
    else if (sp === 'weak-all') {
      var weakTitle = s.all === 'none' ? 'SPF has no ending rule' : 'SPF ends in "' + s.all + '"';
      var weakText = s.all === 'none' ? 'Without an "all" ending, the record does not say what to do with other servers.' : 'This lets any server in the world send as you.';
      var redirects = hasRedirect(m);
      var fixed = redirects ? null : fixSpfAll(s.records[0]);
      var row = { id: 'spf', status: 'fail', title: weakTitle, tag: 'SPF', text: weakText, record: s.records[0] };
      if (redirects) row.text += ' The ending of this record is set in the record it redirects to, so the change belongs there. I have not written a record for it.';
      else if (fixed) row.fix = { label: 'Change the ending', value: d + '  TXT  "' + fixed + '"' };
      else row.fix = { label: 'How to fix', value: 'Your SPF record holds text I cannot safely copy, so I have not rewritten it. Change its ending to ~all by hand.' };
      rows.push(row);
    }
    else if (sp === 'capped') rows.push({ id: 'spf', status: 'warn', title: 'SPF chains further than I followed', tag: 'SPF', text: 'I stopped counting at the limit for one check, or a lookup did not answer, so I cannot say whether you are within the limit of 10 lookups.', record: s.records[0] });
    else if (sp === 'lookups') rows.push({ id: 'spf', status: 'fail', title: 'SPF needs ' + s.lookups + ' lookups (the limit is 10)', tag: 'SPF', text: 'Past 10, SPF returns an error, which can push your real email into spam.', record: s.records[0],
      fix: { label: 'How to fix', value: 'Remove include: entries for services you no longer use, or replace some with the IP ranges they stand for ("flattening").' } });
    else rows.push({ id: 'spf', status: 'pass', title: s.macro ? 'One SPF record' : 'One SPF record, within the 10-lookup limit', tag: 'SPF',
      text: s.macro ? 'One record, at least ' + s.lookups + ' of 10 lookups used. It uses a macro, so the real count depends on each message.' : 'One record, ' + s.lookups + ' of 10 lookups used.', record: s.records[0] });

    if (m.dkim.length) rows.push({ id: 'dkim', status: 'pass', title: 'DKIM signing key found', tag: 'DKIM', text: 'DKIM is a signature on outgoing mail. Your mail can be signed, so receivers can tell it was not altered.', record: m.dkim.map(function (x) { return x + '._domainkey.' + d; }).join('\n') });
    else if (m.dkimUnread) rows.push({ id: 'dkim', status: 'warn', title: 'I could not finish the DKIM check', tag: 'DKIM', text: 'Some lookups did not answer, so I cannot say whether a signing key exists. Try again in a few minutes.', record: 'Not fully read' });
    else rows.push({ id: 'dkim', status: 'warn', title: 'No DKIM key found', tag: 'DKIM', text: 'I looked under ' + DKIM_SELECTORS.length + ' common names and found no signing key. It may sit under a custom name. If signing is off, DMARC cannot fully protect you.', record: 'Checked ' + DKIM_SELECTORS.length + ' common names',
      fix: { label: 'How to fix', value: 'In the admin settings of ' + (m.provider === 'Another provider' || m.provider === 'None' ? 'your mail provider' : m.provider) + ', turn on DKIM signing for ' + d + '. It gives you one or two DNS records to add.' } });

    if (m.mtaSts) rows.push({ id: 'mta-sts', status: 'pass', title: 'An MTA-STS record is published', tag: 'MTA-STS', text: 'I did not read the policy file, so I cannot tell whether it is set to enforce.' + (m.tlsRpt ? ' A TLS-RPT reporting record is present.' : ' A TLS-RPT record would add reports on failures.'), record: '_mta-sts.' + d + (m.tlsRpt ? '\n_smtp._tls.' + d : '') });
    else if (u.mtaSts) rows.push({ id: 'mta-sts', status: 'info', title: 'I could not read the MTA-STS record', tag: 'MTA-STS', text: 'A public DNS service answered with an error, so I do not know whether you have one. Try again in a few minutes.', record: 'Not read' });
    else {
      var id = m.checkedAt.toISOString().slice(0, 10).replace(/-/g, '');
      var hosts = m.mx.filter(function (x) { return /^[a-z0-9._\-]+$/i.test(x); }).map(function (x) { return 'mx: ' + x.toLowerCase(); }).join('\n');
      rows.push({ id: 'mta-sts', status: 'warn', title: 'Incoming mail can fall back to unencrypted', tag: 'MTA-STS',
        text: 'MTA-STS tells senders to deliver to you only over an encrypted connection. Without it, someone in the network path can force email onto an unencrypted one. Two small records and one text file fix it.',
        record: [m.mtaSts ? 'MTA-STS: present' : 'MTA-STS: missing', m.tlsRpt ? 'TLS-RPT: present' : (u.tlsRpt ? 'TLS-RPT: not read' : 'TLS-RPT: missing')].join('\n'),
        fix: { label: 'Add, starting in testing mode', value: '_mta-sts.' + d + '  TXT  "v=STSv1; id=' + id + '"' + (m.tlsRpt || u.tlsRpt ? '' : '\n_smtp._tls.' + d + '  TXT  "v=TLSRPTv1; rua=mailto:tls-reports@' + d + '"') + '\n\nServe this at https://mta-sts.' + d + '/.well-known/mta-sts.txt :\nversion: STSv1\nmode: testing\n' + hosts + '\nmax_age: 86400' } });
    }
    rows.push({ id: 'bimi', status: m.bimi ? 'pass' : 'info', title: m.bimi ? 'Your logo can show in inboxes' : u.bimi ? 'I could not read the BIMI record' : 'No inbox logo (BIMI)', tag: 'BIMI', text: m.bimi ? 'A BIMI record is published.' : u.bimi ? 'A public DNS service answered with an error, so I do not know whether one is published.' : 'Optional. Once DMARC is at quarantine or reject, BIMI can show your logo beside your emails in some inboxes.', record: m.bimi ? 'default._bimi.' + d : u.bimi ? 'Not read' : 'No record' });
    var both = m.dnssec && m.caa.length > 0;
    rows.push({ id: 'dns', status: both ? 'pass' : 'info', title: both ? 'DNSSEC and CAA records are present' : 'DNSSEC and CAA are optional', tag: 'DNSSEC + CAA',
      text: 'DNSSEC signs your DNS answers. CAA limits which companies may issue certificates for your site. I read CAA on this name only. Both need care: a CAA record that leaves out your certificate provider stops renewal, and nothing fails until the certificate expires; a DNSSEC mistake can take your domain offline. Leave them to whoever manages your DNS.',
      record: [m.dnssec ? 'DNSSEC: on' : (u.dnssec ? 'DNSSEC: not read' : 'DNSSEC: off'), m.caa.length ? 'CAA: ' + m.caa.join(', ') : (u.caa ? 'CAA: not read' : 'CAA: none')].join('\n') });
    return rows;
  }

   
  function buildItEmail(m) {
    var rows = buildChecks(m).filter(function (r) { return r.fix; });
    var date = m.checkedAt.toISOString().slice(0, 10);
    var subject = 'Email security records to change for ' + m.domain;
    var lines = ['Hello,', '',
      'A free check of the public email records for ' + m.domain + ' (read on ' + date + ') found ' + (rows.length ? 'the changes below. Some lines may repeat text found in the current records, so read each one before you publish it. Add or change them where the DNS for ' + m.domain + ' is managed.' : 'nothing to change.'), ''];
    rows.forEach(function (r, i) {
      lines.push((i + 1) + '. ' + r.title + ' (' + r.tag + ')');
      lines.push('   ' + r.fix.label + ':');
      r.fix.value.split('\n').forEach(function (l) { lines.push('   ' + l); });
      if (r.after) lines.push('   Afterwards: ' + r.after.trim());
      lines.push('');
    });
    lines.push('Standards: SPF RFC 7208, DKIM RFC 6376, DMARC RFC 7489 (replaced by RFC 9989), MTA-STS RFC 8461.');
    lines.push('The check reads public DNS records only. It is not a security audit.');
    var body = lines.join('\n');
    var note = '\n\n[Cut to fit a link. Use "Copy the note" on the page for the full text.]';
    var enc = encodeURIComponent;
    var href;
    if (enc(body).length <= MAILTO_CAP) href = 'mailto:?subject=' + enc(subject) + '&body=' + enc(body);
    else {
      var lo = 0, hi = body.length;
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2), p = body.slice(0, mid);
        if (/[\ud800-\udbff]$/.test(p)) p = p.slice(0, -1);
        if (enc(p + note).length <= MAILTO_CAP) lo = mid; else hi = mid - 1;
      }
      var cut = body.slice(0, lo);
      if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
      var nl = cut.lastIndexOf('\n');
      if (nl > cut.length / 2) cut = cut.slice(0, nl);
      href = 'mailto:?subject=' + enc(subject) + '&body=' + enc(cut + note);
    }
    return { subject: subject, body: body, mailtoHref: href };
  }

  return { DKIM_SELECTORS: DKIM_SELECTORS, inspect: inspect, spfLookups: spfLookups, verdict: verdict, buildChecks: buildChecks, buildItEmail: buildItEmail, firstFix: firstFix, likelySubdomain: likelySubdomain, fixSpfAll: fixSpfAll };
});
