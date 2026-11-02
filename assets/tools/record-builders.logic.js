

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.recordBuilders = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_AGE_LIMIT = 31557600;           
  var SPF_LOOKUP_LIMIT = 10;              
  var SPF_STRING_LIMIT = 255;             
  var SPF_TOTAL_LIMIT = 450;              

  

  var SPF_SENDERS = [
    { id: 'm365', label: 'Microsoft 365 (Exchange Online)', include: 'spf.protection.outlook.com', lookups: null, confirmed: true,
      source: 'https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure',
      note: 'This line is for the standard worldwide Microsoft 365. Government and 21Vianet plans use different lines on the same Microsoft page.' },
    { id: 'google', label: 'Google Workspace', include: '_spf.google.com', lookups: null, confirmed: true,
      source: 'https://knowledge.workspace.google.com/admin/security/set-up-spf', note: '' },
    { id: 'zoho', label: 'Zoho Mail', include: 'zohomail.com', lookups: null, confirmed: true,
      source: 'https://www.zoho.com/mail/help/adminconsole/spf-configuration.html',
      note: 'If you use more than one Zoho service, the same Zoho page gives a different line. The page gives no separate Australian line; if your account is on a regional Zoho site, check with Zoho.' },
    { id: 'mailchimp', label: 'Mailchimp', include: null, lookups: null, confirmed: false,
      source: 'https://mailchimp.com/help/set-up-email-domain-authentication/',
      note: 'Mailchimp\'s own domain page asks for two DKIM records and a DMARC record, and does not ask for an SPF record. Many customers need no SPF line for it. Check the Domains page in your Mailchimp account before adding anything.' },
    { id: 'xero', label: 'Xero', include: null, lookups: null, confirmed: false, source: 'https://central.xero.com/',
      note: 'I could not read a Xero page that gives an SPF line. Ask Xero, or check Xero Central, before adding one.' },
    { id: 'myob', label: 'MYOB', include: null, lookups: null, confirmed: false, source: 'https://help.myob.com/',
      note: 'I could not read a MYOB page that gives an SPF line for your own domain. Ask MYOB before adding one.' },
    { id: 'hubspot', label: 'HubSpot', include: null, lookups: null, confirmed: false,
      source: 'https://knowledge.hubspot.com/domains-and-urls/connect-your-email-sending-domain',
      note: 'HubSpot\'s page shows lines that differ between its example and its troubleshooting text, and the line can be specific to your account. Copy it from your HubSpot settings.' },
    { id: 'sendgrid', label: 'Twilio SendGrid', include: null, lookups: null, confirmed: false,
      source: 'https://www.twilio.com/docs/sendgrid/ui/account-and-settings/how-to-set-up-domain-authentication',
      note: 'SendGrid\'s page shows a line only as an example, and says it can manage SPF for you. Use what your SendGrid settings tell you.' }
  ];

   
  var CA_ISSUERS = [
    { id: 'letsencrypt', label: "Let's Encrypt", domain: 'letsencrypt.org', confirmed: true, source: 'https://letsencrypt.org/docs/caa/' },
    { id: 'digicert', label: 'DigiCert', domain: 'digicert.com', confirmed: true, source: 'https://docs.digicert.com/en/certcentral/manage-certificates/dns-caa-resource-record-check/edit-the-caa-resource-record-to-authorize-digicert-to-issue-certificates-for-your-domain.html' },
    { id: 'sectigo', label: 'Sectigo', domain: 'sectigo.com', confirmed: true, source: 'https://www.sectigo.com/knowledge-base/detail/CAA-Record-Certification-Authority-Authorization-1527076091491/kA01N000000zFMO' },
    { id: 'google', label: 'Google Trust Services', domain: 'pki.goog', confirmed: true, source: 'https://developers.google.com/public-key-infrastructure/faq/configure-caa' },
    { id: 'amazon', label: 'Amazon (AWS Certificate Manager)', domain: 'amazon.com', confirmed: true, source: 'https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html' }
  ];

  

  var CAA_NOTES = [
    'Before you publish, read which authority issued each certificate you serve, on every name. Leave one out and that certificate cannot renew, and nothing fails until it expires.',
    'A subdomain with no CAA records of its own uses its parent domain\'s records, so these reach your subdomains too. A name that is a CNAME uses its target\'s CAA records if the target has any; if not, the check climbs from the original name, not from the target.',
    'Some hosts, such as Cloudflare under Universal SSL, add CAA records of their own. They may not show in your DNS dashboard, so dig can show more than you set. That is not an error.'
  ];

  function err(message) { return { error: message }; }
  function isObj(o) { return o !== null && typeof o === 'object'; }
  function asList(v) {
    if (v == null || v === '') return [];
    return Array.isArray(v) ? v : [v];
  }

   
  function unsafe(s) { return /[\u0000-\u0020\u007f-\u009f"'`;\\<>(){}\u2028\u2029]/.test(s); }

  

  function hostname(input, opts) {
    opts = opts || {};
    if (typeof input !== 'string') return null;
    var s = input.trim().toLowerCase();
    if (!s || s.length > 253 || unsafe(s)) return null;
    var labels = s.split('.');
    if (labels.length < 2) return null;
    if (opts.wildcard && labels[0] === '*' && labels.length < 3) return null;
    if (opts.wildcard && labels[0] === '*' && labels.length === 3 && /^(com|net|org|edu|gov|asn|id|co|ac)\.[a-z]{2}$/.test(labels.slice(1).join('.'))) return null;
    var ok = labels.every(function (l, i) {
      if (i === 0 && opts.wildcard && l === '*') return true;
      if (l.length < 1 || l.length > 63) return false;
      var re = opts.underscore ? /^[a-z0-9_]([a-z0-9_\-]*[a-z0-9_])?$/ : /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/;
      return re.test(l);
    });
    if (!ok) return null;
    if (/^\d+$/.test(labels[labels.length - 1])) return null;
    return s;
  }

  function email(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim().replace(/^mailto:/i, '');
    var at = s.lastIndexOf('@');
    if (at < 1 || at !== s.indexOf('@')) return null;
    var local = s.slice(0, at), host = hostname(s.slice(at + 1));
    if (!host || local.length > 64 || !/^[A-Za-z0-9._%+\-]+$/.test(local)) return null;
    return local + '@' + host;
  }

   
  function httpsUrl(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim();
    var m = /^https:\/\/([^\/]+)((?:\/[A-Za-z0-9._~\-]+)*\/?)$/.exec(s);
    if (!m || unsafe(s)) return null;
    var host = hostname(m[1]);
    if (!host || s.length > 300) return null;
    return 'https://' + host + m[2];
  }

  function domainOf(input) {
    var d = hostname(input);
    return d;
  }

   
  function mailtoRua(input) {
    if (typeof input !== 'string' || !/^mailto:/i.test(input.trim())) return null;
    var a = email(input);
    return a ? 'mailto:' + a : null;
  }

  function dmarcPlan(opts) {
    if (!isObj(opts)) return err('Nothing to build from.');
    var domain = domainOf(opts.domain);
    if (!domain) return err('That does not look like a domain. Try yourbusiness.com.au.');
    var rua = mailtoRua(opts.rua);
    if (!rua) return err('Enter one email address for reports, such as dmarc@yourbusiness.com.au.');
    var host = '_dmarc.' + domain;
    var base = 'v=DMARC1; ';
    var tail = '; rua=' + rua;
    return {
      subdomains: 'Stages 2 to 4 reach your subdomains too, unless the record sets sp=. Before stage 2, confirm nothing real sends from a subdomain, such as mail.' + domain + '. Your DMARC reports show it. Adding sp=reject needs the same check.',
      stages: [
        { label: 'Stage 1: watch only (p=none)', p: 'none', wait: 'Start here. Publish it today, then read the reports for 2 to 4 weeks before stage 2.', host: host, value: base + 'p=none' + tail },
        { label: 'Stage 2: quarantine 25% (p=quarantine, pct=25)', p: 'quarantine', wait: 'Only after 2 to 4 weeks of reports show every real sender passing. Some receivers quarantine 25% of failing mail, and others quarantine all of it, so be ready for all of it. Read the reports for 1 to 2 more weeks before stage 3.', host: host, value: base + 'p=quarantine; pct=25' + tail },
        { label: 'Stage 3: quarantine all (p=quarantine)', p: 'quarantine', wait: 'Only after 1 to 2 weeks at stage 2 with no real mail going to junk. With no pct in the record, this is the step that covers all failing mail. Read the reports for another 2 to 4 weeks before stage 4.', host: host, value: base + 'p=quarantine' + tail },
        { label: 'Stage 4: reject (p=reject)', p: 'reject', wait: 'Only after 2 to 4 weeks at full quarantine with nothing real failing. This is the strongest setting. Rejected mail bounces back to whoever sent it, and you get no warning.', host: host, value: base + 'p=reject' + tail }
      ]
    };
  }

   
  function ip4(input) {
    if (typeof input !== 'string') return null;
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/.exec(input.trim());
    if (!m) return null;
    for (var i = 1; i <= 4; i++) if (Number(m[i]) > 255 || (m[i].length > 1 && m[i].charAt(0) === '0')) return null;
    if (m[5] != null && Number(m[5]) > 32) return null;
    return input.trim();
  }
  

  function ip4Scope(ip) {
    var m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/.exec(ip), a = Number(m[1]), b = Number(m[2]);
    var bits = m[5] == null ? 32 : Number(m[5]);
    if (bits < 8) return { refuse: true, warn: null };
    var warn = null;
    if (bits < 24) warn = ip + ' covers more than 256 addresses. Use the smallest range your provider gives you.';
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) warn = ip + ' is a private or loopback range, which no outside server can send from. Use your public address.';
    return { refuse: false, warn: warn };
  }

  function buildSpf(opts) {
    if (!isObj(opts)) return err('Nothing to build from.');
    var domain = domainOf(opts.domain);
    if (!domain) return err('That does not look like a domain. Try yourbusiness.com.au.');
    var ending = opts.ending == null || opts.ending === '' ? '~all' : opts.ending;
    if (ending === '+all') return err('I will not write +all: it tells every server in the world it may send as you.');
    if (ending !== '~all' && ending !== '-all') return err('The ending must be ~all or -all.');
    var includes = [], lookups = [], warnings = [], i;
    var ids = asList(opts.senderIds);
    for (i = 0; i < ids.length; i++) {
      var s = SPF_SENDERS.filter(function (x) { return x.id === ids[i]; })[0];
      if (!s) return err('I do not know the sender "' + String(ids[i]).slice(0, 20).replace(/[^\w\-]/g, '') + '".');
      if (!s.confirmed || !s.include) { warnings.push(s.label + ': I have no confirmed line for this one. Get it from the vendor and add it as an extra line.'); continue; }
      if (includes.indexOf(s.include) < 0) { includes.push(s.include); lookups.push(s.lookups); }
    }
    var extras = asList(opts.extraIncludes);
    for (i = 0; i < extras.length; i++) {
      var raw = typeof extras[i] === 'string' ? extras[i].trim().replace(/^include:/i, '') : extras[i];
      var h = hostname(raw, { underscore: true });
      if (!h) return err('"' + String(extras[i]).slice(0, 30).replace(/[^\w.\-: ]/g, '?') + '" is not a host name I can use as an include. Use just the host name, such as spf.example.com.');
      if (includes.indexOf(h) < 0) { includes.push(h); lookups.push(null); }
    }
    var ips = [], list = asList(opts.ip4s);
    for (i = 0; i < list.length; i++) {
      var ip = ip4(list[i]);
      if (!ip) return err('"' + String(list[i]).slice(0, 30).replace(/[^\w.\/]/g, '?') + '" is not an IPv4 address, such as 203.0.113.10 or 203.0.113.0/24.');
      var scope = ip4Scope(ip);
      if (scope.refuse) return err('I will not write ip4:' + ip.slice(0, 20).replace(/[^\w.\/]/g, '?') + ': a range that wide lets a large part of the internet send as you, the same as +all.');
      if (scope.warn) warnings.push(scope.warn);
      if (ips.indexOf(ip) < 0) ips.push(ip);
    }
     
    if (!includes.length && !ips.length) {
      var notes = ids.map(function (id) { var x = SPF_SENDERS.filter(function (y) { return y.id === id; })[0]; return x && x.note ? x.label + ': ' + x.note : ''; }).filter(Boolean);
      return err(['List at least one service or address that sends email as you. A record with none tells receivers to distrust all your mail. For a service marked "get the line from them", put the host name from its include line in the extra box.'].concat(notes).join(' '));
    }
    var parts = ['v=spf1'];
    ips.forEach(function (x) { parts.push('ip4:' + x); });
    includes.forEach(function (x) { parts.push('include:' + x); });
    parts.push(ending);
    var record = parts.join(' ');
    var min = 0, allKnown = true;
    lookups.forEach(function (n) { if (n == null) { min += 1; allKnown = false; } else min += n; });
    if (min > SPF_LOOKUP_LIMIT) warnings.push('This needs at least ' + min + ' lookups. The limit is ' + SPF_LOOKUP_LIMIT + ' (RFC 7208 section 4.6.4); past it, receivers can ignore the whole record. Remove a sender or move one to its own subdomain.');
    else if (includes.length && !allKnown) warnings.push('The lookup count is a minimum: each include can use more lookups inside it.');
    if (record.length > SPF_STRING_LIMIT) warnings.push('This record is ' + record.length + ' characters. One piece of a DNS text record holds 255, so it must be split into pieces of up to 255 characters inside the quotes (RFC 7208 section 3.3). Many DNS hosts do this for you; ask yours.');
    if (record.length > SPF_TOTAL_LIMIT) warnings.push('Over ' + SPF_TOTAL_LIMIT + ' characters in all, the answer may not fit in one small DNS reply (RFC 7208 section 3.4). Shorten it.');
    return { host: domain, record: record, lookupsMin: min, overLimit: min > SPF_LOOKUP_LIMIT, warnings: warnings };
  }

   
  function pad(n, w) { var s = String(n); while (s.length < (w || 2)) s = '0' + s; return s; }
   
  function stsId(date) {
    var d = date instanceof Date ? date : null;
    if (!d || isNaN(d.getTime())) return null;
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  function mtaStsKit(opts) {
    if (!isObj(opts)) return err('Nothing to build from.');
    var domain = domainOf(opts.domain);
    if (!domain) return err('That does not look like a domain. Try yourbusiness.com.au.');
    var hosts = asList(opts.mxHosts), mx = [], i;
    if (!hosts.length) return err('List at least one mail server host name (your MX records).');
    if (hosts.length > 20) return err('That is more than 20 mail servers. Use wildcards such as *.example.net.');
    for (i = 0; i < hosts.length; i++) {
      var h = hostname(hosts[i], { wildcard: true });
      if (!h) return err('"' + String(hosts[i]).slice(0, 30).replace(/[^\w.*\-]/g, '?') + '" is not a mail server host name.');
      if (mx.indexOf(h) < 0) mx.push(h);
    }
    var mode = opts.mode == null || opts.mode === '' ? 'testing' : opts.mode;
    if (mode !== 'testing' && mode !== 'enforce') return err('The mode must be testing or enforce.');
    var maxAge = opts.maxAge == null || opts.maxAge === '' ? (mode === 'enforce' ? 604800 : 86400) : Number(opts.maxAge);
    if (!isFinite(maxAge) || Math.floor(maxAge) !== maxAge || maxAge < 0) return err('The policy lifetime must be a whole number of seconds.');
    if (maxAge > MAX_AGE_LIMIT) maxAge = MAX_AGE_LIMIT;
    var id = typeof opts.id === 'string' ? opts.id.trim() : stsId(opts.id);
    if (!id || !/^[A-Za-z0-9]{1,32}$/.test(id)) return err('I need a valid policy id: letters and digits only, up to 32.');
    var rua = mailtoRua(typeof opts.rua === 'string' && !/^(mailto:|https:)/i.test(opts.rua.trim()) ? 'mailto:' + opts.rua.trim() : opts.rua);
    if (!rua) {
      var url = typeof opts.rua === 'string' ? httpsUrl(opts.rua) : null;
      if (!url) return err('The report address must be one email address, such as tlsrpt@yourbusiness.com.au, or an https address.');
      rua = url;
    }
    var file = ['version: STSv1', 'mode: ' + mode];
    mx.forEach(function (x) { file.push('mx: ' + x); });
    file.push('max_age: ' + maxAge);
    return {
      stsTxt: { host: '_mta-sts.' + domain, value: 'v=STSv1; id=' + id },
      tlsRpt: { host: '_smtp._tls.' + domain, value: 'v=TLSRPTv1; rua=' + rua },
      policyUrl: 'https://mta-sts.' + domain + '/.well-known/mta-sts.txt',
      policyFile: file.join('\n') + '\n',
      maxAge: maxAge,
      clamped: Number(opts.maxAge) > MAX_AGE_LIMIT
    };
  }

   
  function contactValue(input) {
    if (typeof input !== 'string') return null;
    var s = input.trim();
    if (/^https:/i.test(s)) return httpsUrl(s);
    var a = email(s);
    return a ? 'mailto:' + a : null;
  }

  function expiresDate(input, now) {
    var d = input instanceof Date ? input : (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(input.trim()) ? new Date(input.trim().length === 10 ? input.trim() + 'T00:00:00Z' : input.trim()) : null);
    if (!d || isNaN(d.getTime())) return null;
     
    if (typeof input === 'string' && d.toISOString().slice(0, 10) !== input.trim().slice(0, 10)) return null;
    return d;
  }

  function secWarnings(opts) {
    var d = expiresDate(opts && opts.expires);
    var now = opts && opts.now instanceof Date ? opts.now : new Date();
    var w = [];
    if (d && d.getTime() - now.getTime() > 366 * 86400000) w.push('Expires is more than a year away. RFC 9116 section 2.5.5 recommends less than a year, so the file is revisited.');
    return w;
  }

  function securityTxt(opts) {
    if (!isObj(opts)) return err('Nothing to build from.');
    var now = opts.now instanceof Date ? opts.now : new Date();
    var lines = [], i, list;
    list = asList(opts.contact);
    if (!list.length) return err('Add at least one contact: an email address or an https address.');
    for (i = 0; i < list.length; i++) {
      var c = contactValue(list[i]);
      if (!c) return err('A contact must be an email address or an https address. "' + String(list[i]).slice(0, 30).replace(/[^\w.@:\/\-]/g, '?') + '" is neither.');
      lines.push('Contact: ' + c);
    }
    var exp = expiresDate(opts.expires);
    if (!exp) return err('Expires must be a date, such as 2027-06-30.');
    if (exp.getTime() <= now.getTime()) return err('Expires must be in the future.');
    lines.push('Expires: ' + exp.toISOString().replace(/\.\d{3}Z$/, 'Z'));
    list = asList(opts.encryption);
    for (i = 0; i < list.length; i++) {
      var e = typeof list[i] === 'string' ? list[i].trim() : '';
      var ev = /^openpgp4fpr:[0-9A-Fa-f]{40}$/.test(e) ? e : httpsUrl(e);
      if (!ev) return err('Encryption must be an https address where your public key can be fetched. Do not paste the key itself.');
      lines.push('Encryption: ' + ev);
    }
    var langs = typeof opts.preferredLanguages === 'string' ? opts.preferredLanguages.split(',') : asList(opts.preferredLanguages);
    langs = langs.map(function (x) { return typeof x === 'string' ? x.trim() : x; }).filter(function (x) { return x !== ''; });
    if (langs.length) {
      for (i = 0; i < langs.length; i++) if (typeof langs[i] !== 'string' || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(langs[i])) return err('Languages are short codes separated by commas, such as en, fr.');
      lines.push('Preferred-Languages: ' + langs.join(', '));
    }
    list = asList(opts.policy);
    if (list.length > 1) return err('Give one policy address.');
    if (list.length) { var p = httpsUrl(list[0]); if (!p) return err('The policy must be an https address.'); lines.push('Policy: ' + p); }
    list = asList(opts.canonical);
    for (i = 0; i < list.length; i++) {
      var cu = httpsUrl(list[i]);
      if (!cu) return err('The canonical address must be an https address.');
      lines.push('Canonical: ' + cu);
    }
    return lines.join('\n') + '\n';
  }

   
  function caaRecords(opts) {
    if (!isObj(opts)) return err('Nothing to build from.');
    var domain = domainOf(opts.domain);
    if (!domain) return err('That does not look like a domain. Try yourbusiness.com.au.');
    function lookup(id) {
      var ca = CA_ISSUERS.filter(function (x) { return x.id === id; })[0];
      return ca && ca.confirmed && ca.domain ? ca : null;
    }
    var out = [], issuers = asList(opts.issuers), i, ca;
    if (!issuers.length) return err('Pick at least one certificate provider. An empty list would block every one.');
    for (i = 0; i < issuers.length; i++) {
      ca = lookup(issuers[i]);
      if (!ca) return err('I do not have a confirmed name for that provider.');
      out.push({ host: domain, value: '0 issue "' + ca.domain + '"' });
    }
    if (opts.issuewild != null) {
      var wild = asList(opts.issuewild);
      if (!wild.length) out.push({ host: domain, value: '0 issuewild ";"' });
      for (i = 0; i < wild.length; i++) {
        ca = lookup(wild[i]);
        if (!ca) return err('I do not have a confirmed name for that provider.');
        out.push({ host: domain, value: '0 issuewild "' + ca.domain + '"' });
      }
    }
    if (opts.iodef != null && opts.iodef !== '') {
      var io = typeof opts.iodef === 'string' && /^https:/i.test(opts.iodef.trim()) ? httpsUrl(opts.iodef) : (email(opts.iodef) ? 'mailto:' + email(opts.iodef) : null);
      if (!io) return err('The report address must be an email address or an https address.');
      out.push({ host: domain, value: '0 iodef "' + io + '"' });
    }
    return out;
  }

  return {
    SPF_SENDERS: SPF_SENDERS,
    CA_ISSUERS: CA_ISSUERS,
    CAA_NOTES: CAA_NOTES,
    dmarcPlan: dmarcPlan,
    buildSpf: buildSpf,
    mtaStsKit: mtaStsKit,
    stsId: stsId,
    securityTxt: securityTxt,
    securityTxtWarnings: secWarnings,
    caaRecords: caaRecords
  };
});
