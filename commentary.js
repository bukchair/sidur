/* commentary.js - commentary opened in place, while reading.
   Everything shown is the text of a printed book with its source and edition; the app writes no explanation of its own.
   Data: commentary/index.json (links), commentary/<book>.json (units), commentary/tehillim/NNN.json (by verse).
   Built by commentary/pack-app.mjs from the data folders in the repository. */
(function (g) {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cache = {};
  const getJSON = u => cache[u] || (cache[u] = fetch(u).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(e => { delete cache[u]; throw e; }));
  let INDEX = null;
  const ready = getJSON('commentary/index.json').then(j => { INDEX = j; return j; }).catch(() => null);

  const GEM = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
  const gem = s => [...s].reduce((n, c) => n + (GEM[c] || 0), 0);
  const LET = n => { let s = ''; for (const [v, c] of [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']]) while (n >= v) { s += c; n -= v; } return s.replace('יה', 'טו').replace('יו', 'טז'); };

  /* ---- Tehillim: the verse labels "(א)" of the original text become the handles for the commentary on that verse ---- */
  function markVerses(html) {
    let ps = 0;
    return html.replace(/פרק ([א-ת"'׳״]{1,6})<br>|(<br>|<\/span>|^)\(([א-ת"'׳״]{1,5})\) /g, (m, chap, pre, v) => {
      if (chap) { const n = gem(chap); ps = n >= 1 && n <= 150 ? n : 0; return m; }
      if (!ps) return m;
      return `${pre}<button class="vs" data-ps="${ps}" data-v="${gem(v)}">(${v})</button> `;
    });
  }

  /* ---- prayers: mark the phrases that a book comments on, and list the books at the head of each part ---- */
  let cur = { file: '', page: null }, sel = '';
  function decorate(body, file, skips) {
    cur = { file, page: null }; sel = '';
    const verses = body.querySelectorAll('.vs').length;
    const pg = INDEX && INDEX.pages[file]; if (!pg) return verses;
    cur.page = pg;
    const titleOf = {}; for (const s of skips || []) titleOf['sk' + s.line] = s.title;

    /* 1. the text of the page without points and punctuation, with the way back from every letter to its place */
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const nodes = [], posNode = [-1], posOff = [0], secs = []; const parts = [' ']; let len = 1, lastSp = true;
    const sep = () => { if (!lastSp) { parts.push(' '); posNode.push(-1); posOff.push(0); len++; lastSp = true; } };
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 1) { if (n.tagName === 'BR') sep(); else if (n.classList.contains('sk')) { sep(); secs.push({ title: titleOf[n.id], pos: len, el: n }); } continue; }
      const t = n.nodeValue, ni = nodes.push(n) - 1;
      for (let i = 0; i < t.length; i++) {
        const c = t.charCodeAt(i);
        if (c >= 0x5D0 && c <= 0x5EA) { parts.push(t[i]); posNode.push(ni); posOff.push(i); len++; lastSp = false; }
        else if (c === 32 || c === 10 || c === 45 || c === 0x5BE || c === 160) sep();
      }
    }
    sep(); const N = parts.join('');
    const range = scope => {
      if (scope === '*') return [[0, N.length]];
      if (scope === '^') return [[0, secs.length ? secs[0].pos : N.length]];
      return secs.map((s, i) => s.title === scope ? [s.pos - 1, i + 1 < secs.length ? secs[i + 1].pos : N.length] : null).filter(Boolean);
    };

    /* 2. find each phrase inside the part it was linked to */
    const perNode = {};
    pg.phrases.forEach((p, id) => {
      const narrow = p.s.filter(x => x !== '*'), needle = ' ' + p.a + ' ';
      for (const sc of narrow.length ? narrow : ['*']) for (const [a, b] of range(sc)) {
        const at = N.indexOf(needle, a); if (at < 0 || at + needle.length > b) continue;
        let k = at + 1; const end = at + 1 + p.a.length;
        while (k < end) {
          const ni = posNode[k]; if (ni < 0) { k++; continue; }
          const from = posOff[k]; let last = from; while (k < end && (posNode[k] === ni || posNode[k] < 0)) { if (posNode[k] === ni) last = posOff[k]; k++; }
          const t = nodes[ni].nodeValue; let to = last + 1; while (to < t.length) { const c = t.charCodeAt(to); if ((c >= 0x591 && c <= 0x5C7 && c !== 0x5BE) || c === 0x2011) to++; else break; }
          (perNode[ni] = perNode[ni] || []).push([from, to, id]);
        }
      }
    });

    /* 3. wrap the found pieces; a piece that two books quote carries both */
    let marked = 0;
    for (const ni of Object.keys(perNode)) {
      const node = nodes[ni], t = node.nodeValue, iv = perNode[ni];
      const cuts = [...new Set([0, t.length].concat(...iv.map(x => [x[0], x[1]])))].sort((x, y) => x - y);
      const frag = document.createDocumentFragment();
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a = cuts[i], b = cuts[i + 1], ids = [...new Set(iv.filter(x => x[0] <= a && x[1] >= b).map(x => x[2]))];
        if (!ids.length) { frag.appendChild(document.createTextNode(t.slice(a, b))); continue; }
        const sp = document.createElement('span'); sp.className = 'ph'; sp.dataset.ph = ids.join(','); sp.textContent = t.slice(a, b); frag.appendChild(sp); marked++;
      }
      node.parentNode.replaceChild(frag, node);
    }

    /* 4. the books that speak about each part, at its head */
    const chips = (links, label) => {
      const by = {}; for (const l of links) (by[l.b] = by[l.b] || []).push(l);
      const row = document.createElement('div'); row.className = 'com';
      row.innerHTML = `<span class="lb">${label}</span>` + Object.keys(by).map(b => {
        const k = by[b].map(l => pg.sections.indexOf(l)).join(',');
        return `<button class="c" data-sec="${k}">${esc(INDEX.books[b] ? INDEX.books[b].he : b)}</button>`;
      }).join('');
      return row;
    };
    const top = pg.sections.filter(l => l.w || l.p);
    if (top.length) body.insertBefore(chips(top, 'ספרים על התפילה:'), body.firstChild);
    for (const s of secs) {
      const links = pg.sections.filter(l => l.s === s.title); if (!links.length) continue;
      let n = s.el.nextSibling; while (n && ((n.nodeType === 3 && !n.nodeValue.trim()) || n.nodeName === 'BR')) n = n.nextSibling;
      const after = n && n.nodeType === 1 && n.classList.contains('fc') ? n : s.el;
      after.parentNode.insertBefore(chips(links, 'פירוש על הקטע:'), after.nextSibling);
    }
    return verses + marked + pg.sections.length;
  }

  /* ---- the bar of books: which books speak on this page, and reading with one of them only ---- */
  const bookOfChip = c => cur.page.sections[+c.dataset.sec.split(',')[0]].b;
  function books() {
    const body = $('#rbody'), pg = cur.page, n = {}; if (!INDEX || !body) return [];
    if (pg) {
      const ids = new Set(); body.querySelectorAll('.ph').forEach(el => el.dataset.ph.split(',').forEach(i => ids.add(+i)));
      ids.forEach(i => { const b = pg.phrases[i].b; n[b] = (n[b] || 0) + 1; });
      body.querySelectorAll('.com .c').forEach(c => { const b = bookOfChip(c); n[b] = (n[b] || 0) + 1; });
    }
    const list = Object.keys(INDEX.books).filter(b => n[b]).map(b => ({ id: b, he: INDEX.books[b].he, n: n[b] }));
    if (body.querySelector('.vs')) INDEX.tehillim.forEach(t => list.push({ id: t.id, he: t.he, n: 0 }));
    return list;
  }
  function select(id) {
    sel = id || ''; const pg = cur.page, body = $('#rbody'); if (!pg) return;
    body.querySelectorAll('.ph').forEach(el => el.classList.toggle('off', !!sel && !el.dataset.ph.split(',').some(i => pg.phrases[+i].b === sel)));
    body.querySelectorAll('.com').forEach(row => {
      let any = 0; row.querySelectorAll('.c').forEach(c => { const off = !!sel && bookOfChip(c) !== sel; c.classList.toggle('hide', off); if (!off) any++; });
      row.classList.toggle('hide', !any);
    });
  }
  /* the next place on the page where the chosen book speaks, from where the reader stands */
  function next() {
    const marks = [...$('#rbody').querySelectorAll('.ph:not(.off), .com:not(.hide) .c:not(.hide)')]; if (!marks.length) return false;
    const line = 132, m = marks.find(el => el.getBoundingClientRect().top > line + 6) || marks[0];
    window.scrollBy(0, m.getBoundingClientRect().top - line); m.classList.add('flash'); setTimeout(() => m.classList.remove('flash'), 1100); return true;
  }

  /* ---- the sheet ---- */
  const sheet = { open(title, html) { $('#comTitle').textContent = title; $('#comBody').innerHTML = html; $('#comBody').scrollTop = 0; openSheet('Com'); },
    close() { closeSheet('Com'); } };
  const failed = e => `<p class="cnone">לא ניתן לטעון את הפירוש (${esc(e && e.message || e)}).</p>`;
  const credit = ids => '<div class="ccr">' + ids.map(b => `<div>${esc((INDEX.books[b] || INDEX.tehillim.find(t => t.id === b) || {}).credit || '')}</div>`).join('') + '</div>';
  const plain = h => h.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');

  function openPhrases(ids) {
    const pg = cur.page; if (!pg) return; const list = ids.map(i => pg.phrases[i]).filter(p => p && (!sel || p.b === sel)); if (!list.length) return;
    sheet.open('פירוש על המילים', '<p class="cnone">טוען...</p>');
    Promise.all([...new Set(list.map(p => p.b))].map(b => getJSON('commentary/' + b + '.json'))).then(files => {
      const units = {}; files.forEach(f => { units[f.book] = f.units; });
      const html = list.map(p => {
        const u = units[p.b][p.u]; if (!u) return '';
        const text = plain(u.t), next = pg.phrases.filter(q => q.b === p.b && q.u === p.u && q.o > p.o).map(q => q.o).sort((x, y) => x - y)[0];
        const piece = text.slice(p.o, next === undefined ? text.length : next).trim();
        const whole = piece.length < text.trim().length;
        return `<article class="ce"><div class="csrc">${esc(u.h)}</div><div class="ctx">${esc(piece)}</div>` +
          (whole ? `<button class="cmore" data-full="${p.b}:${p.u}">הקטע המלא בספר</button>` : '') + '</article>';
      }).join('');
      $('#comBody').innerHTML = html + credit([...new Set(list.map(p => p.b))]);
      $('#comBody')._units = units;
    }).catch(e => { $('#comBody').innerHTML = failed(e); });
  }
  function openSection(keys) {
    const pg = cur.page; if (!pg) return; const links = keys.map(k => pg.sections[k]).filter(Boolean); if (!links.length) return;
    const b = links[0].b, book = INDEX.books[b];
    sheet.open(book.he, '<p class="cnone">טוען...</p>');
    getJSON('commentary/' + b + '.json').then(f => {
      const idx = []; for (const l of links) for (const [x, y] of l.u) for (let i = x; i <= y; i++) if (f.units[i] && !idx.includes(i)) idx.push(i);
      const note = links.some(l => l.general) ? '<p class="cnone">הספר עוסק בנושא באופן כללי, לא בקטע הזה מילה במילה.</p>' : links.some(l => l.weak) ? '<p class="cnone">הקישור בין הקטע לספר אינו ודאי.</p>' : '';
      const draw = n => idx.slice(0, n).map(i => `<article class="ce"><div class="csrc">${esc(f.units[i].h)}</div><div class="ctx">${f.units[i].t}</div></article>`).join('') +
        (n < idx.length ? `<button class="cmore" data-next="${n + 6}">המשך (${idx.length - n} קטעים נוספים)</button>` : '') + credit([b]);
      $('#comBody').innerHTML = note + draw(6); $('#comBody')._draw = n => { const top = $('#comBody').scrollTop; $('#comBody').innerHTML = note + draw(n); $('#comBody').scrollTop = top; };
    }).catch(e => { $('#comBody').innerHTML = failed(e); });
  }
  function openVerse(ps, v) {
    sheet.open(`תהילים ${LET(ps)}, ${LET(v)}`, '<p class="cnone">טוען...</p>');
    getJSON('commentary/tehillim/' + String(ps).padStart(3, '0') + '.json').then(f => {
      const c = f.verses[v] || {}, all = INDEX.tehillim.filter(t => c[t.id]), one = all.filter(t => t.id === sel), shown = one.length ? one : all;   /* the chosen commentator alone, when he speaks on this verse */
      $('#comBody').innerHTML = shown.length ? shown.map(t => `<article class="ce"><div class="csrc">${esc(t.he)}</div>${c[t.id].map(x => `<div class="ctx">${x}</div>`).join('')}</article>`).join('') + credit(shown.map(t => t.id))
        : '<p class="cnone">אין פירוש על הפסוק הזה בספרים שבאפליקציה.</p>';
    }).catch(e => { $('#comBody').innerHTML = failed(e); });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#comClose') || t.id === 'scrimCom') return sheet.close();
    const more = t.closest('.cmore');
    if (more) {
      if (more.dataset.next) return $('#comBody')._draw(+more.dataset.next);
      const [b, u] = more.dataset.full.split(':'), unit = $('#comBody')._units[b][u];
      more.previousElementSibling.innerHTML = unit.t; more.remove(); return;
    }
    if (document.documentElement.dataset.com !== 'on') return;
    const vs = t.closest('.vs'); if (vs) return openVerse(+vs.dataset.ps, +vs.dataset.v);
    const c = t.closest('.com .c'); if (c) return openSection(c.dataset.sec.split(',').map(Number));
    const ph = t.closest('.ph'); if (ph && !ph.classList.contains('off')) return openPhrases(ph.dataset.ph.split(',').map(Number));
  });

  /* the list of books and editions, for the "about" page */
  function credits() {
    if (!INDEX) return '';
    const line = x => `<li>${esc(x.credit)}</li>`;
    return '<h4>הפירושים שבאפליקציה</h4><p>כל פירוש מוצג כלשונו בספר, עם שם הספר והמקום. האפליקציה אינה מוסיפה הסבר משלה.</p><ul>' +
      Object.values(INDEX.books).map(line).join('') + INDEX.tehillim.map(line).join('') + '</ul>';
  }

  g.SidurCom = { ready, markVerses, decorate, credits, books, select, next, get sel() { return sel; }, get loaded() { return !!INDEX; } };
})(window);
