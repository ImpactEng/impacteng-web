

(function () {
  'use strict';
  var T = window.IETools, L = window.IEToolLogic && window.IEToolLogic.gbpChecklist;
  if (!T || !L) return;
  var el = T.el, TOOL = 'gbp_checklist';
  var list = document.getElementById('gb-list');
  var count = document.getElementById('gb-count');
  var next = document.getElementById('gb-next');
  var line = document.getElementById('gb-line');
  var nextHead = document.getElementById('gb-next-head');
  var showBtn = document.getElementById('gb-show');
  var printBtn = document.getElementById('gb-print');
  if (!list || !count || !next) return;

  var boxes = [], started = false, doneSent = false;
  var LINE = {
    started: 'A good start. The three below are the next ones to do.',
    'most-done': 'More than half done. Here are the next ones.',
    'all-done': 'Every item is ticked. Look again whenever your hours, staff or services change.'
  };

  L.ITEMS.forEach(function (it) {
    var box = el('input', { type: 'checkbox', id: 'gb-' + it.id, value: it.id });
    boxes.push(box);
    var li = el('li', { class: 'gb-item', id: 'gb-row-' + it.id },
      el('label', { class: 'gb-tick', for: 'gb-' + it.id }, box, el('span', { text: it.text })),
      el('details', { class: 'gb-why' },
        el('summary', { text: 'Why this matters' }),
        el('p', { text: it.why }),
        el('p', {}, 'Source: ', el('a', { href: it.source, rel: 'noopener', text: it.sourceName }))));
    list.appendChild(li);
    box.addEventListener('change', function () {
      if (!started) { started = true; T.track('tool_start', { tool: TOOL }); }
      update();
      if (ticked().length === L.ITEMS.length && !doneSent) {
        doneSent = true;
        T.track('tool_result', { tool: TOOL, verdict: 'all-done' });
      }
    });
  });

  function ticked() { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); }

  function update() {
    var r = L.score(ticked());
    boxes.forEach(function (b) { document.getElementById('gb-row-' + b.value).classList.toggle('is-done', b.checked); });
    count.textContent = r.done + ' of ' + r.total + ' done';
    if (line) line.textContent = r.done ? LINE[r.verdict] : 'Nothing ticked yet. Start with these.';
    next.hidden = !r.next.length;
    if (nextHead) nextHead.hidden = !r.next.length;
    next.replaceChildren.apply(next, r.next.map(function (it) {
      return el('li', {}, el('a', { href: '#gb-row-' + it.id, text: it.text }));
    }));
    return r;
  }

  if (showBtn) showBtn.addEventListener('click', function () {
    var r = update();
    if (!started) { started = true; T.track('tool_start', { tool: TOOL }); }
    T.track('tool_result', { tool: TOOL, verdict: r.verdict });
    var box = document.getElementById('gb-next-box');
    if (box) box.hidden = false;
  });
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('.gb-why').forEach(function (d) { d.open = true; });
  });
  update();
})();
