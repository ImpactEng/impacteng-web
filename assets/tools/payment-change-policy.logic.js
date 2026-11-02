

(function (root, factory) {
  var core = typeof module === 'object' && module.exports ? require('./core.js') : root.IETools;
  var api = factory(core || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.IEToolLogic = root.IEToolLogic || {}; root.IEToolLogic.paymentPolicy = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MAX_THRESHOLD = 10000000, MAX_WATCH = 365;
  var CALLBACKS = {
    file: 'the phone number we already have on file for that supplier, staff member or customer',
    invoice: 'a phone number from an earlier invoice or contract with them'
  };

   
  function hasControl(s) { return core.hasHidden(s); }
  function hasUrl(s) {
    

    var named = s.replace(/\b(St|Mt|Dr|Mr|Ms|Ft|Pt|[A-Z])\.(?=[A-Z])/g, '');
    return /[a-z][a-z0-9+.\-]*:\/\//i.test(s) || /\bwww\./i.test(s) || /[a-z0-9\-]\.[a-z]{2,}\b/i.test(named) || /\.(com|net|org|au|nz|uk|io|co)\b/i.test(s) || /\b(mailto|javascript|data):/i.test(s);
  }
  function text(errors, key, raw, label, min, max) {
    var s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (hasControl(String(raw == null ? '' : raw).replace(/[\t\r\n\u2028\u2029]/g, ' '))) errors[key] = label.charAt(0).toUpperCase() + label.slice(1) + ' has characters I cannot use.';
    else if (s.length < min) errors[key] = 'Enter ' + label + '.';
    else if (s.length > max) errors[key] = label.charAt(0).toUpperCase() + label.slice(1) + ' must be ' + max + ' characters or fewer.';
    else if (hasUrl(s)) errors[key] = 'Leave web addresses and email addresses out of ' + label + '.';
    return s;
  }
  function wholeNumber(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/^\$/, '').replace(/,/g, '');
    return /^\d{1,9}$/.test(s) ? Number(s) : null;
  }

  function lowerFirst(s) { return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  function validate(input) {
    input = input || {};
    var errors = {};
    var businessName = text(errors, 'businessName', input.businessName, 'your business name', 1, 100);
    var approver = text(errors, 'approver', input.approver, 'the approver role', 1, 60);
    var callback = input.callback;
    if (callback !== 'file' && callback !== 'invoice') errors.callback = 'Choose how you confirm a change.';
    var threshold = wholeNumber(input.threshold);
    if (threshold === null || threshold > MAX_THRESHOLD) errors.threshold = 'Enter whole dollars from 0 to 10,000,000. Use 0 for every change.';
    var watchDays = null;
    var w = String(input.watchDays == null ? '' : input.watchDays).trim();
    if (w !== '') {
      watchDays = wholeNumber(w);
      if (watchDays === null || watchDays < 1 || watchDays > MAX_WATCH) { errors.watchDays = 'Enter whole days from 1 to 365, or leave it empty.'; watchDays = null; }
    }
    var ok = Object.keys(errors).length === 0;
    return { ok: ok, errors: errors, value: ok ? { businessName: businessName, approver: lowerFirst(approver.replace(/^the\s+/i, '')), callback: callback, threshold: threshold, watchDays: watchDays } : null };
  }

  function parseDay(today) {
    var d;
    if (today instanceof Date) d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    else if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}/.test(today)) d = new Date(today.slice(0, 10) + 'T00:00:00Z');
    else d = new Date(0);
    return d;
  }
  function fmt(d) { return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function dollars(n) { return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function buildPolicy(value, opts) {
    var start = parseDay(opts && opts.today);
    var review = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), 1));
    var dim = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth() + 1, 0)).getUTCDate();
    review.setUTCDate(Math.min(start.getUTCDate(), dim));
    var title = 'Payment change policy: ' + value.businessName;
    var lines = [title, ''];
    lines.push('1. When this applies', 'This applies to any request to change bank details, from a supplier, a staff member or a customer, by any channel: email, phone, text message, letter, a portal or in person.', '');
    lines.push('2. The rule',
      'We never act on the message alone. Before any bank detail is changed, we confirm the request by calling ' + CALLBACKS[value.callback] + '.',
      'We never use contact details given in the message that asks for the change, including phone numbers, email addresses and links.', '');
    lines.push('3. Who approves', 'Changes to bank details are approved by the ' + value.approver + '. No one else may make a change without that approval.', '');
    lines.push('4. Second sign-off');
    if (value.threshold === 0) lines.push('Every change needs a second person to sign off, after the callback and before any payment is made to the new account.');
    else lines.push('Any payment of more than ' + dollars(value.threshold) + ' to a changed account needs a second person to sign off, after the callback and before the payment is made.');
    if (value.watchDays) lines.push('We watch a new account for ' + value.watchDays + ' days after the change and check any payment to it against the invoice and the order.');
    lines.push('');
    lines.push('5. If something looks wrong',
      'Stop. Do not reply to the message and do not pay.',
      'Keep the message, with its sender details, as it arrived.',
      'Contact the bank straight away. If money has already been sent, ask them to try to recall it.',
      'Tell the ' + value.approver + ', then report it to ReportCyber (cyber.gov.au/report) and Scamwatch (scamwatch.gov.au).', '');
    lines.push('6. No one is in trouble for slowing a payment down', 'Anyone who delays a payment to check a change is doing the right thing. No one will be blamed for it.', '');
    lines.push('Adopted: ' + fmt(start), 'Review by: ' + fmt(review));
    return { title: title, text: lines.join('\n') };
  }

  return { validate: validate, buildPolicy: buildPolicy, MAX_THRESHOLD: MAX_THRESHOLD };
});
