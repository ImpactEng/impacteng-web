

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.agentIsolation = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '2026-11';
  var BOOL = [true, false];
  var DOMAIN = {
    a: ['none', 'incidental', 'aimed'], others: BOOL, exec: BOOL, priv: BOOL, keys: [0, 1, 2, 3], act: BOOL,
    watch: ['every', 'auto', 'alone'], users: ['me', 'staff', 'public'], access: ['own', 'shared'],
    today: [0, 1, 2, 3], gateNow: [0, 1, 2], egressNow: [0, 1, 2, 3]
  };
  var FIELDS = ['a', 'others', 'exec', 'priv', 'keys', 'act', 'watch', 'users', 'access', 'today', 'gateNow', 'egressNow'];

  function preset(id, name, a, others, exec, priv, keys, act, watch, users, access) {
    return { id: id, name: name, a: a, others: others, exec: exec, priv: priv, keys: keys, act: act, watch: watch, users: users, access: access, today: 0, gateNow: 0, egressNow: 0 };
  }
  var PRESETS = [
    preset('laptop-own', 'Laptop, own repo', 'none', false, true, true, 2, true, 'every', 'me', 'own'),
    preset('laptop-others', "Laptop, others' code", 'aimed', true, true, true, 2, true, 'auto', 'me', 'own'),
    preset('ci', 'CI bot, public repo', 'aimed', false, true, true, 2, true, 'alone', 'me', 'own'),
    preset('ops', 'Ops agent, Terraform', 'none', false, true, true, 3, true, 'alone', 'me', 'own'),
    preset('inbox', 'Inbox assistant', 'aimed', false, false, true, 1, true, 'auto', 'me', 'own'),
    preset('research', 'Research agent', 'aimed', false, true, false, 0, true, 'alone', 'me', 'own'),
    preset('browser-agent', 'Browser agent', 'aimed', false, true, true, 2, true, 'every', 'me', 'own'),
    preset('staff-assistant', 'Internal staff assistant', 'aimed', false, false, true, 1, true, 'auto', 'staff', 'shared'),
    preset('website-chatbot', 'Website chatbot', 'none', false, false, false, 1, false, 'alone', 'public', 'shared'),
    preset('product', 'Product agent, customers', 'aimed', false, true, true, 1, true, 'alone', 'public', 'shared'),
    preset('interp', 'Code interpreter', 'aimed', true, true, false, 0, false, 'alone', 'public', 'own')
  ];

  function derive(s) {
    var multi = s.users !== 'me';
    return {
      multi: multi,
      A: !!(s.a === 'aimed' || s.users === 'public'),
      incidental: s.a === 'incidental',
      B: !!(s.priv || s.keys >= 2),
      

      C: !!(s.act || s.exec),
       
      sharedReach: !!(multi && s.access === 'shared' && (s.priv || s.act || s.exec || s.keys >= 2))
    };
  }

  function compute(s) {
    var v = derive(s), A = v.A, B = v.B, C = v.C, multi = v.multi;
    var m;
    if (!s.exec) m = 0;
    else if (multi) m = 3;
    else if (s.watch === 'alone' || s.others || (A && s.watch !== 'every')) m = 2;
    else m = 1;  

    var k = s.keys === 3 ? 3 : s.keys === 2 ? ((s.watch === 'alone' || A) ? 2 : 1) : s.keys === 1 ? 1 : 0;
    if (v.sharedReach) k = Math.max(k, 2);

    var e = (A && B && C) ? 3 : (B && C) ? 2 : C ? 1 : 0;
    if (s.watch === 'every' && !A && !v.incidental && !multi) e = Math.min(e, 1);
    

    if (s.exec && A && s.watch === 'alone') e = Math.max(e, 2);
    if (multi) e = Math.max(e, 2);

    var t = (A && B && C) ? 3 : (s.keys === 3 && C) ? 2 : (C && (s.keys >= 2 || s.watch === 'alone')) ? 1 : 0;

    var g = (A && B && C) ? 2 : (s.watch === 'alone' && C && (B || s.keys >= 1)) ? 2 : (s.keys >= 2 && C) ? 1 : 0;

    var r = (C && s.keys >= 2) ? 2 : (C || s.watch === 'alone') ? 1 : 0;

    return { A: A, B: B, C: C, multi: multi, incidental: v.incidental, sharedReach: v.sharedReach, m: m, k: k, e: e, t: t, g: g, r: r };
  }

  function riskLevel(s) {
    var v = derive(s);
    var corners = (v.A ? 1 : 0) + (v.B ? 1 : 0) + (v.C ? 1 : 0);
    if (corners === 3 || s.keys === 3 || (s.watch === 'alone' && s.keys >= 2) || (v.multi && s.exec)) return 'high';
    if (corners >= 2 || s.keys === 2 || (s.exec && (s.others || s.watch === 'alone')) || v.sharedReach) return 'moderate';
    return 'lower';
  }

  var LEVELS = ['lower', 'moderate', 'high'];
  

  function residualRisk(s) {
    var inherent = riskLevel(s), d = compute(s);
    var inPlace = s.today >= d.m && s.gateNow >= d.g && s.egressNow >= d.e;
    return inPlace ? LEVELS[Math.max(0, LEVELS.indexOf(inherent) - 1)] : inherent;
  }

  function risk(row, col) {
    if (col === 3) return 'high';
    if (col === 2) return row === 0 ? 'high' : 'medium';
    if (col === 1) return row === 0 ? 'medium' : 'low';
    return 'low';
  }

  function grid(s) {
    var d = compute(s);
    return {
      start: { row: s.today, col: s.keys },
      advised: { row: Math.max(d.m, s.today), col: s.keys >= 2 ? 1 : s.keys }
    };
  }

  function levers(s, setting) {
    var base = compute(s)[setting];
    var out = [];
    if (!base) return out;
    FIELDS.forEach(function (f) {
      if (f === 'today' || f === 'gateNow' || f === 'egressNow') return;
      DOMAIN[f].forEach(function (v) {
        if (v === s[f]) return;
        var alt = Object.assign({}, s); alt[f] = v;
        var lvl = compute(alt)[setting];
        if (lvl < base) out.push({ field: f, value: v, level: lvl });
      });
    });
    out.sort(function (x, y) { return x.level - y.level; });
    return out;
  }

  function layers(s) {
    var d = compute(s);
    return [
      { id: 'in', hole: !!(s.a !== 'none' || s.others || s.users === 'public') },
      { id: 'run', hole: !!(s.exec && s.today < d.m) },
      { id: 'reach', hole: !!(s.keys >= 2 || s.priv || d.sharedReach) },
      

      { id: 'out', hole: !!(d.C && (s.a !== 'none' || s.priv || s.keys >= 1) && !(s.gateNow >= d.g && s.egressNow >= d.e)) }
    ];
  }

  var CODES = {
    a: { none: 'n', incidental: 'i', aimed: 'a' },
    watch: { every: 'e', auto: 'a', alone: 'l' },
    users: { me: 'm', staff: 's', public: 'p' },
    access: { own: 'o', shared: 's' }
  };
  function invert(o) { var r = {}; for (var k in o) r[o[k]] = k; return r; }
  var DECODES = { a: invert(CODES.a), watch: invert(CODES.watch), users: invert(CODES.users), access: invert(CODES.access) };

  function encode(s) {
    var b = function (x) { return x ? '1' : '0'; };
    return ['s', CODES.a[s.a], b(s.others), b(s.exec), b(s.priv), String(s.keys), b(s.act),
      CODES.watch[s.watch], CODES.users[s.users], CODES.access[s.access], String(s.today),
      String(s.gateNow), String(s.egressNow)].join('-');
  }

  function decode(str) {
    if (typeof str !== 'string' || !/^s(-[0-9a-z]){12}$/.test(str)) return null;
    var p = str.split('-').slice(1);
    var bool = function (c) { return c === '1' ? true : c === '0' ? false : null; };
    var num = function (c) { return /^[0-3]$/.test(c) ? Number(c) : null; };
    var pick = function (map, c) { return Object.prototype.hasOwnProperty.call(map, c) ? map[c] : null; };
    var s = {
      a: pick(DECODES.a, p[0]), others: bool(p[1]), exec: bool(p[2]), priv: bool(p[3]), keys: num(p[4]), act: bool(p[5]),
      watch: pick(DECODES.watch, p[6]), users: pick(DECODES.users, p[7]), access: pick(DECODES.access, p[8]), today: num(p[9]),
      gateNow: /^[0-2]$/.test(p[10]) ? Number(p[10]) : null, egressNow: num(p[11])
    };
    for (var i = 0; i < FIELDS.length; i++) if (s[FIELDS[i]] === null) return null;
    return s;
  }

  function product(fields, domain) {
    var out = [{}];
    fields.forEach(function (f) {
      var next = [];
      out.forEach(function (partial) {
        domain[f].forEach(function (v) { var n = Object.assign({}, partial); n[f] = v; next.push(n); });
      });
      out = next;
    });
    return out;
  }
  function allStates() { return product(FIELDS, DOMAIN); }

   
  var SB_DOMAIN = {
    reads: ['yes', 'no', 'unsure'], private: ['yes', 'no', 'unsure'], acts: ['yes', 'no', 'unsure'],
    signin: ['none', 'limited', 'own', 'admin', 'unsure'], checks: ['every', 'approve', 'alone', 'unsure'],
    where: ['vendor', 'computer', 'unsure'], users: ['me', 'staff', 'public', 'unsure'], addons: ['yes', 'no', 'unsure']
  };
  var SB_FIELDS = ['reads', 'private', 'acts', 'signin', 'checks', 'where', 'users', 'addons'];
  var SB_PRESET = { reads: 'yes', private: 'yes', acts: 'yes', signin: 'limited', checks: 'approve', where: 'vendor', users: 'me', addons: 'no' };
  var SIGNIN_KEYS = { none: 0, limited: 1, own: 2, admin: 3, unsure: 3 };
  var CHECKS_WATCH = { every: 'every', approve: 'auto', alone: 'alone', unsure: 'alone' };
  var SB_USERS = { me: 'me', staff: 'staff', public: 'public', unsure: 'public' };

  function fromSmallBusiness(ans) {
    if (!ans || typeof ans !== 'object' || Array.isArray(ans)) return null;
    for (var i = 0; i < SB_FIELDS.length; i++) {
      var f = SB_FIELDS[i];
      if (SB_DOMAIN[f].indexOf(ans[f]) === -1) return null;
    }
    var yes = function (v) { return v !== 'no'; };
    var users = SB_USERS[ans.users];
    return {
      a: yes(ans.reads) ? 'aimed' : 'none', others: yes(ans.addons), exec: ans.where !== 'vendor', priv: yes(ans.private),
      keys: SIGNIN_KEYS[ans.signin], act: yes(ans.acts) || ans.where !== 'vendor', watch: CHECKS_WATCH[ans.checks],
      users: users, access: users === 'me' ? 'own' : 'shared', today: 0, gateNow: 0, egressNow: 0
    };
  }
  function allSmallBusinessAnswers() { return product(SB_FIELDS, SB_DOMAIN); }

  return {
    VERSION: VERSION, FIELDS: FIELDS, DOMAIN: DOMAIN, PRESETS: PRESETS,
    compute: compute, riskLevel: riskLevel, residualRisk: residualRisk, risk: risk, grid: grid, levers: levers, layers: layers,
    encode: encode, decode: decode, allStates: allStates,
    SB_DOMAIN: SB_DOMAIN, SB_FIELDS: SB_FIELDS, SB_PRESET: SB_PRESET,
    fromSmallBusiness: fromSmallBusiness, allSmallBusinessAnswers: allSmallBusinessAnswers
  };
});
