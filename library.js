/* library.js - the library: a bookcase of Tanakh, Talmud, Mishnah, Midrash, Halakhah, Chasidut, Musar and Kabbalah,
   each book from a known edition (Sefaria's export), with its licence shown in "about".
   The bookcase is one rendered picture (shelves, drawers, a lectern with an open book); the volumes on its shelves,
   their names and everything behind them are drawn here.
   Where the text comes from: a pack the user downloaded (on Android the shell keeps it under lib-local/), otherwise
   the same files online (LIB_REMOTE). The file format is the pipeline's contract (library/pipeline):
     catalog.json  books[] {id, ord, he, shelf, group[], kind base|commentary, on, pack, version{title,license,source}}
     books/<id>/toc.json  {sections:[{k,label,path[],n}]}   books/<id>/<k>.json  {seg:[...]}
   A commentary's chunk k belongs to its base's chunk k; seg[i] holds the comments on the base's segment i. */
'use strict';
(function () {
  const N = window.SidurNative || null;
  const LOCAL = N && N.libPacks ? 'lib-local/' : null;
  const REMOTE = window.SIDUR_LIB_REMOTE || 'https://bukchair.github.io/sidur-library/';
  /* the books online are spread over a few sites by shelf (each site has a size limit); the index has its own */
  const HOST = { talmud: 'sidur-lib-talmud', halakhah: 'sidur-lib-halakhah', tanakh: 'sidur-lib-tanakh', mishnah: 'sidur-lib-more', midrash: 'sidur-lib-more', chasidut: 'sidur-lib-more', musar: 'sidur-lib-more', kabbalah: 'sidur-lib-more' };
  const remoteOf = path => { if (L.base !== REMOTE) return L.base + path; const m = path.match(/^books\/([^/]+)\//), b = m && L.by[m[1]];
    const site = b ? (L.cat.hosts || HOST)[b.shelf] : /^search\//.test(path) ? 'sidur-lib-search' : null; return site ? 'https://bukchair.github.io/' + site + '/' + path : REMOTE + path; };
  const L = { cat: null, by: {}, comm: {}, packs: [], installed: {}, toc: {}, chunk: new Map(), base: REMOTE };
  const RAD = 2752 / 1536;                       /* the render's height over its width */
  const short = s => String(s || '').replace(/^(משנה תורה, |שולחן ערוך, |תלמוד ירושלמי |משנה )/, '').replace(/^הלכות /, '');

  /* ---------------- getting the files: downloaded first, then online ---------------- */
  async function getJSON(path) {
    if (L.chunk.has(path)) return L.chunk.get(path);
    const p = (async () => {
      if (LOCAL) { try { const r = await fetch(LOCAL + path); if (r.ok) return await r.json(); } catch (e) { } }
      const r = await fetch(remoteOf(path)); if (!r.ok) throw new Error(r.status); return r.json();
    })();
    L.chunk.set(path, p); p.catch(() => L.chunk.delete(path));
    if (L.chunk.size > 400) L.chunk.delete(L.chunk.keys().next().value);
    return p;
  }
  const toc = id => L.toc[id] || (L.toc[id] = getJSON(`books/${id}/toc.json`).catch(e => { delete L.toc[id]; throw e; }));
  const chunk = (id, k) => getJSON(`books/${id}/${k}.json`);
  let ready = null;
  function load() {
    if (ready) return ready;
    ready = (async () => {
      /* a local test library (lib-data) wins in a browser; the app's own catalog otherwise */
      let cat = null;
      if (!LOCAL) { try { const r = await fetch('lib-data/catalog.json'); if (r.ok) { cat = await r.json(); L.base = 'lib-data/'; } } catch (e) { } }
      if (!cat) cat = await (await fetch('lib/catalog.json')).json();
      L.cat = cat; L.packs = cat.packs || [];
      for (const b of cat.books) { L.by[b.id] = b; if (b.kind === 'commentary' && b.on) (L.comm[b.on] = L.comm[b.on] || []).push(b); }
      refreshInstalled();
      return cat;
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }
  function refreshInstalled() {
    try { L.installed = N && N.libPacks ? (JSON.parse(N.libPacks()).installed || {}) : {}; } catch (e) { L.installed = {}; }
  }
  const partsOf = p => (p && p.parts ? p.parts.map(f => f.replace(/\.zip$/, '')) : [p ? p.id : '']);
  const packIn = id => { const p = L.packs.find(x => x.id === id); return !!p && partsOf(p).every(x => L.installed[x]); };
  const have = b => !b.pack || packIn(b.pack) || !LOCAL;      /* in a browser everything reads online */

  /* ---------------- the sets on the shelves, from the catalog ---------------- */
  const BAY = { R: [71.0, 91.8], C: [32.6, 67.7], L: [8.5, 29.3] };
  const SIDE = [[22.9, 32.5], [33.3, 42.9], [43.5, 53.1], [53.6, 63.1], [63.6, 73.4]];
  const BOOK_H = 8.2;
  const DRAWERS = [
    { t: 'מועדפים', x: [65.5, 91.5], y: [79.2, 86.5], k: 'fav' }, { t: 'לימוד היום', x: [37.0, 63.0], y: [79.2, 86.5], k: 'today' },
    { t: 'אחרונים', x: [8.5, 34.5], y: [79.2, 86.5], k: 'recent' }, { t: 'סימניות', x: [65.5, 91.5], y: [87.5, 94.8], k: 'marks' },
    { t: 'חיפוש', x: [37.0, 63.0], y: [87.5, 94.8], k: 'find' }, { t: 'שמור בטלפון', x: [8.5, 34.5], y: [87.5, 94.8], k: 'save' }];
  const LECTERN = { x: [38.0, 63.0], y: [56.1, 62.4] };
  let SETS = [];
  function buildSets() {
    /* a short introduction is not a volume of its own on the shelf (it is found by search and from its book) */
    const base = L.cat.books.filter(b => b.kind === 'base' && !/(^|, )הקדמה$/.test(b.he));
    const sort = a => a.slice().sort((x, y) => ((x.order ?? 1e9) - (y.order ?? 1e9)) || (x.ord - y.ord));
    const pick = f => sort(base.filter(f));
    const vols = list => list.map(b => ({ name: short(b.he), books: [b] }));
    const grouped = (list, key) => { const m = new Map(); for (const b of list) { const g = key(b); if (!m.has(g)) m.set(g, { name: g, books: [] }); m.get(g).books.push(b); } return [...m.values()]; };
    const tanakh = pick(b => b.shelf === 'tanakh' && !/תרגום|אונקלוס/.test(b.he));
    const bavli = pick(b => b.shelf === 'talmud' && b.group[0] === 'בבלי');
    const half = Math.ceil(bavli.length / 2);
    const sa = pick(b => b.shelf === 'halakhah' && /^(שולחן ערוך|טור)$/.test(b.group[0] || ''));
    const rambam = pick(b => b.shelf === 'halakhah' && b.group[0] === 'משנה תורה');
    const halacha = pick(b => b.shelf === 'halakhah' && !sa.includes(b) && !rambam.includes(b));
    const chas = pick(b => b.shelf === 'chasidut'); const ba = chas.findIndex(b => b.he === 'בית אהרן'); if (ba > 0) chas.unshift(chas.splice(ba, 1)[0]);
    SETS = [
      { id: 'tanakh', name: 'תנ"ך', full: 'תנ"ך', sub: 'ניקוד וטעמים · מצודות ומפרשים', tex: 'navy', bay: 'C', y: [21.8, 32.5], vols: vols(tanakh) },
      { id: 'chasidut', name: 'חסידות', full: 'ספרי חסידות', sub: 'בית אהרן בראש המדף', tex: 'black', bay: 'C', y: [36.5, 50.1], vols: vols(chas) },
      { id: 'bavli1', name: 'ש"ס בבלי', full: 'ש"ס בבלי · כרך א', sub: 'עם רש"י ותוספות', tex: 'burgundy', bay: 'R', s: 0, vols: vols(bavli.slice(0, half)) },
      { id: 'bavli2', name: 'ש"ס בבלי ב', full: 'ש"ס בבלי · כרך ב', sub: 'עם רש"י ותוספות', tex: 'burgundy', bay: 'R', s: 1, vols: vols(bavli.slice(half)) },
      { id: 'yeru', name: 'ירושלמי', full: 'תלמוד ירושלמי', sub: 'עם פני משה', tex: 'green', bay: 'R', s: 2, vols: vols(pick(b => b.shelf === 'talmud' && b.group[0] === 'ירושלמי')) },
      { id: 'mishna', name: 'משנה', full: 'משנה', sub: 'עם ברטנורא', tex: 'brown', bay: 'R', s: 3, vols: vols(pick(b => b.shelf === 'mishnah')) },
      { id: 'midrash', name: 'מדרש', full: 'מדרש', sub: 'מדרש רבה, תנחומא ועוד', tex: 'brown', bay: 'R', s: 4, vols: vols(pick(b => b.shelf === 'midrash')) },
      { id: 'shulchan', name: 'שולחן ערוך', full: 'שולחן ערוך וטור', sub: 'עם משנה ברורה ונושאי הכלים', tex: 'black', bay: 'L', s: 0, vols: vols(sa) },
      { id: 'rambam', name: 'רמב"ם', full: 'משנה תורה לרמב"ם', sub: 'עם נושאי הכלים', tex: 'navy', bay: 'L', s: 1, vols: grouped(rambam, b => b.group[1] || 'משנה תורה') },
      { id: 'halacha', name: 'הלכה', full: 'ספרי הלכה', sub: 'פוסקים ושו"ת', tex: 'green', bay: 'L', s: 2, vols: vols(halacha) },
      { id: 'musar', name: 'מוסר', full: 'ספרי מוסר', sub: 'ראשונים ואחרונים', tex: 'plum', bay: 'L', s: 3, vols: vols(pick(b => b.shelf === 'musar')) },
      { id: 'kabbalah', name: 'קבלה', full: 'זוהר וקבלה', sub: 'זוהר, תיקונים ועוד', tex: 'brown', bay: 'L', s: 4, vols: vols(pick(b => b.shelf === 'kabbalah')) },
    ];
  }
  const rectOf = s => { const [x0, x1] = BAY[s.bay], [y0, y1] = s.y || SIDE[s.s]; return { x0, x1, y0, y1 }; };
  const bri = k => (0.93 + ((k * 37) % 5) * 0.025).toFixed(3);
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- the bookcase ---------------- */
  let cur = null, book = null, drawerOpen = null;
  function drawCase() {
    const sc = $('#lbScene'); sc.querySelectorAll('.slot,.plq,.drawer,.lectbook').forEach(x => x.remove());
    sc.insertAdjacentHTML('beforeend', SETS.map((s, i) => {
      const r = rectOf(s), w = r.x1 - r.x0, h = r.y1 - r.y0, n = Math.max(1, Math.min(s.vols.length, 46)), sw = Math.min(w / n - .15, s.bay === 'C' ? 2.3 : 2.6);
      const dim = v => v.books.every(b => !have(b));
      const sp = s.vols.slice(0, n).map((v, k) => `<span class="sp${dim(v) ? ' off' : ''}" style="--b:${bri(k)};width:${sw}cqw;height:${BOOK_H * RAD}cqw"></span>`).join('');
      return `<button class="slot t-${s.tex}" data-set="${i}" aria-label="${s.full}" style="right:${100 - r.x1}%;width:${w}%;top:${r.y0}%;height:${h}%"${s.vols.length ? '' : ' disabled'}>${sp}</button>`
        + `<span class="plq" style="right:${100 - (r.x0 + r.x1) / 2}%;top:calc(${r.y1}% + .2cqw)">${s.name}</span>`;
    }).join('') + DRAWERS.map((d, i) => `<button class="drawer" data-drawer="${i}" aria-label="${d.t}" style="right:${100 - d.x[1]}%;width:${d.x[1] - d.x[0]}%;top:${d.y[0]}%;height:${d.y[1] - d.y[0]}%"><span class="en">${d.t}</span></button>`).join('')
      + `<button class="lectbook" data-lect="1" aria-label="ממשיכים מאיפה שעצרת" style="right:${100 - LECTERN.x[1]}%;width:${LECTERN.x[1] - LECTERN.x[0]}%;top:${LECTERN.y[0]}%;height:${LECTERN.y[1] - LECTERN.y[0]}%"><span class="en">ממשיכים</span></button>`);
  }
  /* the scene keeps the render's proportions and takes the whole height it can */
  function fit() {
    const bc = $('#lbCase'), W = bc.clientWidth, H = bc.clientHeight, w = Math.min(W, H / RAD);
    const sc = $('#lbScene'); sc.style.width = w + 'px'; sc.style.left = (W - w) / 2 + 'px';
    return { W, H, w, off: (W - w) / 2 };
  }
  function camera(s) {
    const f = fit(), SH = f.w * RAD, r = rectOf(s);
    const w = (r.x1 - r.x0) / 100 * f.w, h = (r.y1 - r.y0) / 100 * SH, k = Math.min((f.W - 8) / w, (f.H * .5) / h);
    const cx = f.off + (r.x0 + r.x1) / 2 / 100 * f.w, cy = (r.y0 + r.y1) / 2 / 100 * SH;
    return { k, tx: f.W / 2 - cx * k, ty: f.H * .46 - cy * k, box: { left: f.W / 2 - w * k / 2, top: f.H * .46 - h * k / 2, width: w * k, height: h * k }, ox: f.off };
  }
  const head = (t, c) => { $('#lbT').textContent = t; $('#lbC').textContent = c || ''; };
  function openShelf(i) {
    const s = SETS[i], c = camera(s), sc = $('#lbScene'); cur = { i, s, c };
    sc.style.transformOrigin = `${-c.ox}px 0`; sc.style.transform = `translate(${c.tx - c.ox + c.ox * c.k}px,${c.ty}px) scale(${c.k})`;
    sc.classList.add('zoomed'); head(s.full, 'ספרייה › ' + s.name);
    setTimeout(() => {
      if (!cur || cur.s !== s) return;
      sc.querySelector(`.slot[data-set="${i}"]`).classList.add('away');
      const sv = $('#lbSv'); Object.assign(sv.style, { left: c.box.left + 'px', top: c.box.top + 'px', width: c.box.width + 'px', height: c.box.height + 'px' });
      const H = c.box.height, sh = Math.min(96, BOOK_H / (rectOf(s).y1 - rectOf(s).y0) * 100);
      $('#lbRow').className = 'svrow t-' + s.tex;
      $('#lbRow').innerHTML = s.vols.map((v, k) => `<button class="bigsp${v.books.every(b => !have(b)) ? ' off' : ''}" data-vol="${k}" style="--i:${Math.min(k, 30)};--b:${bri(k)};--w:46px;--sh:${sh}%;--fs:${Math.min(16, Math.max(10, H * sh / 100 * .44 / Math.max(3, v.name.length) * 1.12))}px" aria-label="${esc(v.name)}"><span class="nm">${esc(v.name)}</span><span class="no">${CalCore.heNum(k + 1)}</span></button>`).join('');
      sv.hidden = false; $('#lbRow').scrollLeft = 0;
      $('#lbHd').innerHTML = `<span class="p">${esc(s.full)}</span><small>${esc(s.sub)} · ${s.vols.length} כרכים</small>`; $('#lbHd').classList.add('on'); $('#lbFt').classList.add('on');
    }, reduce() ? 0 : 760);
  }
  function closeShelf() {
    const sc = $('#lbScene'); $('#lbSv').hidden = true; $('#lbHd').classList.remove('on'); $('#lbFt').classList.remove('on');
    sc.querySelectorAll('.slot.away').forEach(x => x.classList.remove('away'));
    sc.style.transform = ''; sc.classList.remove('zoomed'); cur = null; head('ספרייה', 'לחצו על מדף');
  }
  /* a volume comes out of the case and opens: its title page and its contents */
  async function openVol(v, fromEl, texName) {
    const bc = $('#lbCase'), W = bc.clientWidth, H = bc.clientHeight, b0 = bc.getBoundingClientRect(), a = fromEl.getBoundingClientRect();
    const from = { left: a.left - b0.left, top: a.top - b0.top, width: a.width, height: a.height }, to = { left: W * .06, top: H * .04, width: W * .88, height: H * .92 };
    const el = document.createElement('div'); el.className = 'vol t-' + (texName || 'brown');
    const b1 = v.books[0];
    el.innerHTML = `<div class="pg" id="lbPg"><div class="shaar"><div class="k">${esc(v.books.length > 1 ? v.name : b1.he)}</div><div class="d">${esc(cur ? cur.s.sub : '')}</div></div><div id="lbToc"><p class="lbwait">טוען את התוכן...</p></div></div><div class="cv"><div class="fr"><b>${esc(v.name)}</b><small>${esc(cur ? cur.s.full : '')}</small></div></div>`;
    Object.assign(el.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
    bc.appendChild(el); $('#lbDim').classList.add('on'); book = { el, from, v }; head(v.name, (cur ? cur.s.name + ' › ' : '') + v.name);
    if (!reduce()) el.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 650, easing: 'cubic-bezier(.3,.7,.2,1)' }).onfinish = () => setTimeout(() => el.classList.add('opened'), 120);
    else el.classList.add('opened');
    drawContents(v);
  }
  async function drawContents(v) {
    const box = $('#lbToc'); if (!box) return;
    if (v.books.length > 1) { box.innerHTML = '<div class="toc2">הספרים בכרך</div><ul class="lst2">' + v.books.map(b => `<li data-book="${b.id}"><span>${esc(short(b.he))}</span><small>${have(b) ? '›' : '⇣'}</small></li>`).join('') + '</ul>'; return; }
    const b = v.books[0];
    if (!have(b)) box.innerHTML = `<p class="lbnote">הספר הזה עוד לא הורד לטלפון. אפשר לקרוא אותו עכשיו באינטרנט, או להוריד את החבילה "${esc((L.packs.find(p => p.id === b.pack) || {}).he || '')}" במגירת "שמור בטלפון".</p>`;
    try {
      const t = await toc(b.id), secs = t.sections, grid = secs.length > 6 && secs.every(x => x.label.length <= 4 && !(x.path || []).length);
      const at = (store.get('libpos', {})[b.id] || {}).k;
      let html = '';
      if (grid) html = `<div class="toc2">${esc((b.heAddr || ['פרק'])[0])}</div><div class="grid2">${secs.map(x => `<button data-book="${b.id}" data-k="${x.k}"${x.k === at ? ' class="on"' : ''}>${esc(x.label)}</button>`).join('')}</div>`;
      else { let last = ''; html = '<ul class="lst2">' + secs.map(x => { const p = (x.path || []).join(' · '), hd = p && p !== last ? `<li class="lh">${esc(p)}</li>` : ''; last = p || last; return hd + `<li data-book="${b.id}" data-k="${x.k}"${x.k === at ? ' class="on"' : ''}><span>${esc(x.label)}</span><small>›</small></li>`; }).join('') + '</ul>'; }
      box.insertAdjacentHTML('beforeend', html);
      box.querySelector('.lbwait') && box.querySelector('.lbwait').remove();
    } catch (e) { box.innerHTML = '<p class="lbnote">אין חיבור לאינטרנט, והספר הזה לא שמור בטלפון.</p>'; }
  }
  function closeVol(instant) {
    if (!book) return; const { el, from } = book; book = null; $('#lbDim').classList.remove('on'); el.classList.remove('opened');
    const to = { left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
    const done = () => { el.remove(); document.querySelectorAll('.bigsp.pull').forEach(x => x.classList.remove('pull')); };
    if (cur) head(cur.s.full, 'ספרייה › ' + cur.s.name); else head('ספרייה', 'לחצו על מדף');
    if (instant || reduce()) return done();
    setTimeout(() => el.animate([{ transform: 'none', transformOrigin: '0 0' }, { transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`, transformOrigin: '0 0', opacity: .4 }], { duration: 520, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).onfinish = done, 650);
  }
  /* the drawers and the lectern: a tray of index cards comes up from below */
  function tray(title, rows, el) {
    $('#lbTray').innerHTML = `<h4>${esc(title)}<button id="lbTrayX">סגירה</button></h4>` + (rows.length ? '<ul>' + rows.map(r => `<li ${r.attr || ''}><span>${esc(r.a)}</span><small>${esc(r.b || '')}</small></li>`).join('') + '</ul>' : '<p class="lbnote">עדיין ריק.</p>');
    $('#lbDim').classList.add('on'); setTimeout(() => $('#lbTray').classList.add('on'), reduce() ? 0 : 140); head(title, 'ספרייה › ' + title);
    if (el) el.classList.add('pulled'); drawerOpen = el || true;
  }
  function closeTray() { $('#lbTray').classList.remove('on'); $('#lbDim').classList.remove('on'); if (drawerOpen && drawerOpen.classList) drawerOpen.classList.remove('pulled'); drawerOpen = null; head('ספרייה', 'לחצו על מדף'); }
  const placeName = (id, k, label) => { const b = L.by[id]; return b ? short(b.he) + (label ? ' ' + label : '') : id; };
  function openDrawer(i, el) {
    const d = DRAWERS[i];
    if (d.k === 'find') return go('#find');
    if (d.k === 'save') return openSave();
    if (d.k === 'fav') return tray(d.t, store.get('libfav', []).map((f, j) => ({ a: placeName(f.id, f.k, f.label), b: f.at || '', attr: `data-open="${f.id}" data-k="${f.k}"` })), el);
    if (d.k === 'recent') return tray(d.t, store.get('librecent', []).map(f => ({ a: placeName(f.id, f.k, f.label), b: ago(f.t), attr: `data-open="${f.id}" data-k="${f.k}"` })), el);
    if (d.k === 'marks') return tray(d.t, store.get('libmarks', []).map(f => ({ a: placeName(f.id, f.k, f.label) + (f.snip ? ' · ' + f.snip : ''), b: f.note || 'סימניה', attr: `data-open="${f.id}" data-k="${f.k}" data-seg="${f.seg}"` })), el);
    if (d.k === 'today') return tray(d.t, today(), el);
  }
  function today() {
    const rows = [], info = typeof dayInfo === 'function' ? dayInfo(sync(NOW())) : null;
    if (info && info.daf) { const [mas, daf] = splitDaf(info.daf), b = L.cat.books.find(x => x.kind === 'base' && x.group[0] === 'בבלי' && x.he === mas);
      rows.push({ a: 'דף יומי: ' + info.daf, b: 'בבלי', attr: b ? `data-open="${b.id}" data-label="${daf}."` : '' }); }
    rows.push({ a: 'חוק לישראל של היום', b: 'חוק לישראל', attr: 'data-go="#chok"' }, { a: 'שניים מקרא: פרשת השבוע', b: 'חומש', attr: 'data-go="#smv"' }, { a: 'תהילים של היום', b: 'תהילים', attr: 'data-go="menu:showTehilimTypeMenu"' });
    return rows;
  }
  const splitDaf = s => { const m = String(s).match(/^(.*\S)\s+(\S+)$/); return m ? [m[1], m[2]] : [s, '']; };
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'עכשיו' : m < 60 ? `לפני ${m} דקות` : m < 1440 ? `לפני ${Math.round(m / 60)} שעות` : `לפני ${Math.round(m / 1440)} ימים`; };
  function openLectern(el) { tray('על הסטנדר', store.get('librecent', []).slice(0, 4).map(f => ({ a: placeName(f.id, f.k, f.label), b: ago(f.t), attr: `data-open="${f.id}" data-k="${f.k}"` })), el); }

  /* ---------------- the reader ---------------- */
  const R = { id: null, k: 0, t: null, mode: store.get('libmode', 'daf'), open: {}, hl: null };
  async function openBook(id, k, opt) {
    opt = opt || {}; await load(); const b = L.by[id]; if (!b) return;
    const t = await toc(id).catch(() => null); if (!t) { alert0('אין חיבור לאינטרנט, והספר הזה לא שמור בטלפון.'); return; }
    if (opt.label) { const s = t.sections.find(x => x.label === opt.label); if (s) k = s.k; }
    if (k === undefined || k === null || !t.sections.some(x => x.k === k)) k = ((store.get('libpos', {})[id] || {}).k) ?? t.sections[0].k;
    Object.assign(R, { id, k, t, open: {}, hl: opt.hl || null, seg: opt.seg ?? null });
    if (curView !== 'libread') nav('libread', { depth: depth() });
    drawReader();
  }
  const isTalmud = b => b.shelf === 'talmud' && b.group[0] === 'בבלי';
  const dh = s => { s = String(s).replace(/<[^>]+>/g, ''); const m = s.match(/^(.{2,90}?)\s+[–-]\s+/); return m ? `<b class="dh">${esc(m[1])}</b> ${esc(s.slice(m[0].length))}` : esc(s); };
  const flat = x => Array.isArray(x) ? x.flat(Infinity) : [x];
  async function drawReader() {
    const b = L.by[R.id], sec = R.t.sections.find(x => x.k === R.k), i = R.t.sections.indexOf(sec);
    $('#lrT').textContent = short(b.he) + ' ' + sec.label; $('#lrC').textContent = (sec.path || []).join(' · ') || (b.group || []).join(' · ');
    $('#lrPrev').disabled = i <= 0; $('#lrNext').disabled = i >= R.t.sections.length - 1;
    const pos = store.get('libpos', {}); pos[R.id] = { k: R.k }; store.set('libpos', pos);
    const rec = store.get('librecent', []).filter(f => f.id !== R.id); rec.unshift({ id: R.id, k: R.k, label: sec.label, t: Date.now() }); store.set('librecent', rec.slice(0, 20));
    $('#lrStar').setAttribute('aria-pressed', String(store.get('libfav', []).some(f => f.id === R.id && f.k === R.k)));
    const talmud = isTalmud(b);
    $('#lrModes').classList.toggle('hide', !talmud);
    document.querySelectorAll('#lrModes [data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === (talmud ? R.mode : 'read'))));
    $('#lrBody').innerHTML = '<p class="lbwait">טוען...</p>';
    let ch; try { ch = await chunk(R.id, R.k); } catch (e) { $('#lrBody').innerHTML = '<p class="lbnote">אין חיבור לאינטרנט, והספר הזה לא שמור בטלפון.</p>'; return; }
    /* the main commentaries first; a page asks for at most 24 of them */
    const PRI = [/^rashi_on/, /^tosafot_on/, /^steinsaltz_on/, /^metzudat_david/, /^metzudat_zion/, /^bartenura/, /^penei_moshe/, /^mishnah_berurah/, /^biur_halacha/, /^onkelos/];
    const pri = c => { const i = PRI.findIndex(r => r.test(c.id)); return i < 0 ? (c.pack === b.pack ? 50 : 99) : i; };
    const comms = (L.comm[R.id] || []).slice().sort((x, y) => pri(x) - pri(y)).slice(0, 24);
    const cdata = await Promise.all(comms.map(c => chunk(c.id, R.k).then(x => ({ c, seg: x.seg })).catch(() => null)));
    R.comms = cdata.filter(Boolean);
    if (talmud && R.mode === 'daf') return drawDaf(ch);
    drawRead(ch);
  }
  function drawRead(ch) {
    /* a commentary is read under each segment when it is laid out by them (lists per segment, or one per segment); otherwise as a whole */
    const bySeg = x => x.c.align ? x.c.align === 'segment' : (x.seg.some(Array.isArray) || x.seg.length === ch.seg.length);
    const per = R.comms.filter(bySeg), whole = R.comms.filter(x => !bySeg(x));
    let html = ch.seg.map((t, i) => {
      const btns = per.map((x, j) => { const n = flat(x.seg[i] || []).filter(Boolean).length; return n ? `<button data-seg="${i}" data-c="${j}" aria-pressed="${R.open[i] === j}">${esc(short(x.c.he).replace(/ על .*$/, ''))}<small>${n}</small></button>` : ''; }).join('');
      const o = R.open[i], com = o !== undefined && per[o] ? `<div class="com"><span class="lb">${esc(per[o].c.he)}</span>${flat(per[o].seg[i]).map(dh).join('<br>')}</div>` : '';
      const txt = Array.isArray(t) ? t.join(' ') : t;
      return `<div class="seg${R.seg === i ? ' hit' : ''}" id="ls${i}"><div class="txt">${R.hl ? mark(txt, R.hl) : txt}</div>${btns ? `<div class="tools">${btns}<button class="mk" data-mark="${i}" aria-label="סימניה">☆</button></div>` : `<div class="tools"><button class="mk" data-mark="${i}" aria-label="סימניה">☆</button></div>`}${com}</div>`;
    }).join('');
    if (whole.length) html += whole.map((x, j) => `<details class="whole"><summary>${esc(x.c.he)} <small>${flat(x.seg).filter(Boolean).length}</small></summary>${flat(x.seg).filter(Boolean).map(dh).join('<br>')}</details>`).join('');
    $('#lrBody').innerHTML = `<div class="lrtxt">${html}</div>` + srcLine();
    if (R.seg !== null && R.seg !== undefined) { const el = document.getElementById('ls' + R.seg); if (el) el.scrollIntoView({ block: 'center' }); R.seg = null; } else window.scrollTo(0, 0);
  }
  function srcLine() {
    const b = L.by[R.id], all = [b].concat((R.comms || []).map(x => x.c));
    return '<p class="lrsrc">' + all.map(x => `${esc(x.he)}: ${esc(x.version.title)} (${esc(x.version.license)})`).join(' · ') + '. מתוך ספריא.</p>';
  }
  function drawDaf(ch) {
    const main = ch.seg.map(t => Array.isArray(t) ? t.join(' ') : t).join(' ');
    const by = re => R.comms.find(x => re.test(x.c.title || x.c.id));
    const ra = by(/^rashi/i), to = by(/^tosafot/i);
    const side = x => x ? flat(x.seg).filter(Boolean).map(dh).join(' ') : '';
    const sec = R.t.sections.find(x => x.k === R.k);
    $('#lrBody').innerHTML = `<div class="dafwrap" id="lrDaf"><div class="stage" id="lrStage"><div class="dafhdr">${esc(L.by[R.id].he)} · ${esc(sec.label)}</div><div id="lrDafRoot"></div></div></div><p class="lbhint"><span>הדף כמו בדפוס וילנא: הגמרא באמצע, רש"י ותוספות בצדדים.</span><button id="lrZoom">הגדלה</button></p>` + srcLine();
    const run = () => {
      try {
        const r = dafRenderer('#lrDafRoot', { contentWidth: '560px', mainWidth: '46%', padding: { vertical: '8px', horizontal: '12px' }, fontFamily: { inner: 'RashiScript', outer: 'RashiScript', main: 'Frank' }, direction: 'rtl', fontSize: { main: '15px', side: '10.5px' }, lineHeight: { main: '19px', side: '14px' } });
        r.render(main, side(ra), side(to), /:$/.test(sec.label) ? 'b' : 'a');
      } catch (e) { $('#lrDafRoot').textContent = 'לא הצלחתי לסדר את הדף.'; }
      fitDaf();
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(run);
  }
  let dafZoom = false;
  /* the page is laid out at 580px and scaled to the screen; the frame takes the scaled height, so nothing is cut */
  function fitDaf() { const wrap = $('#lrDaf'), st = $('#lrStage'); if (!wrap || !st) return; const w = wrap.clientWidth; if (!w) return;
    const s = dafZoom ? Math.max(1, w / 580 * 1.6) : Math.min(1, (w - 8) / 580); st.style.width = '580px'; st.style.transform = `scale(${s})`;
    /* the three bodies of text are absolutely placed by the renderer: the page is as tall as the lowest of them */
    let nat = st.offsetHeight; st.querySelectorAll('#lrDafRoot > *').forEach(c => { nat = Math.max(nat, c.offsetTop + c.offsetHeight + (c.offsetParent === st ? 0 : ($('#lrDafRoot').offsetTop || 0))); });
    wrap.style.height = Math.ceil(nat * s + 24) + 'px'; $('#lrZoom').textContent = dafZoom ? 'הדף כולו' : 'הגדלה'; }
  const mark = (html, q) => { const re = libWordRe(q); return re ? html.replace(/>([^<]+)</g, (m, t) => '>' + t.replace(re, x => `<mark>${x}</mark>`) + '<').replace(/^([^<]+)/, t => t.replace(re, x => `<mark>${x}</mark>`)) : html; };
  function alert0(t) { $('#lrBody') && ($('#lrBody').innerHTML = `<p class="lbnote">${esc(t)}</p>`); }

  /* ---------------- search, in every word of every book ---------------- */
  const PRE = 'והבכלמש';
  const nrm = w => String(w).replace(/[֑-ׇ]/g, '').replace(/[^א-ת]/g, '').replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ');
  const key = w => { w = nrm(w); return w.length > 1 ? w[0] + w.slice(1).replace(/[וי]/g, '') : w; };
  function libWordRe(q) {   /* a word in pointed text, letters with any points between them */
    const ws = String(q).split(/\s+/).map(nrm).filter(w => w.length > 1); if (!ws.length) return null;
    const P = '[\\u0591-\\u05C7]*', fin = { 'כ': '[כך]', 'מ': '[מם]', 'נ': '[נן]', 'פ': '[פף]', 'צ': '[צץ]' };
    return new RegExp(ws.map(w => [...w].map(c => (fin[c] || c) + P).join('')).join('|'), 'g');
  }
  const meta = {};
  async function shardsOf(where) { if (!meta[where]) meta[where] = getJSON(where + 'meta.json').then(m => new Set((m.shards || []).map(s => typeof s === 'string' ? s : s.name))).catch(() => new Set()); return meta[where]; }
  const unpack = s => { const out = []; let v = 0; for (const p of String(s).split('.')) { if (!p) continue; v += parseInt(p, 36); out.push(v); } return out; };
  async function postings(k, where) {
    const names = await shardsOf(where); let name = null;
    for (let n = k.length; n >= 2 && !name; n--) if (names.has(k.slice(0, n))) name = k.slice(0, n);
    if (!name) return [];
    const sh = await getJSON(where + name + '.json').catch(() => ({})); return sh[k] ? unpack(sh[k]) : [];
  }
  /* sections holding every word of the query (by the index); the words are checked in the text when shown */
  async function search(q, limit) {
    await load(); const ks = [...new Set(String(q).split(/\s+/).map(key).filter(w => w.length > 1))]; if (!ks.length) return { hits: [], total: 0 };
    /* the index of every book online, and the indexes of the packs in the phone (which answer without a connection) */
    const where = ['search/'].concat(LOCAL ? Object.keys(L.installed).map(p => 'search/' + p + '/') : []);
    const mul = 20000, lists = await Promise.all(ks.map(async k => [...new Set((await Promise.all(where.map(w => postings(k, w).catch(() => [])))).flat())].sort((a, b) => a - b)));
    let set = lists[0] || []; for (const l of lists.slice(1)) { const s = new Set(l); set = set.filter(x => s.has(x)); }
    const hits = set.map(p => ({ b: L.cat.books[Math.floor(p / mul)], k: p % mul })).filter(h => h.b);
    return { hits: hits.slice(0, limit || 400), total: hits.length };
  }
  async function snippet(h, q) {
    try { const ch = await chunk(h.b.id, h.k), re = libWordRe(q); const segs = ch.seg.map(s => flat(s).join(' ').replace(/<[^>]+>/g, ''));
      const i = segs.findIndex(s => re && re.test(s)); if (re) re.lastIndex = 0; if (i < 0) return null;
      const s = segs[i], m = re.exec(s), at = m ? m.index : 0, a = Math.max(0, at - 60), z = Math.min(s.length, at + 90);
      const t = await toc(h.b.id).catch(() => null), sec = t && t.sections.find(x => x.k === h.k);
      return { seg: i, label: sec ? sec.label : '', html: (a ? '... ' : '') + esc(s.slice(a, z)).replace(libWordRe(q), x => `<mark>${x}</mark>`) + (z < s.length ? ' ...' : '') };
    } catch (e) { return null; }
  }

  /* ---------------- downloads (the Android shell does the work; see MainActivity) ---------------- */
  const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' גיגה' : Math.max(1, Math.round(n / 1e6)) + ' מגה';
  function packState() { try { return N && N.libPacks ? JSON.parse(N.libPacks()) : { installed: {}, active: {}, free: 0 }; } catch (e) { return { installed: {}, active: {}, free: 0 }; } }
  const packUrl = part => (L.cat.packsBase || 'https://github.com/bukchair/sidur-library/releases/download/packs/') + part + '.zip';
  function getPack(p) { if (!N || !N.libGet) return; const parts = partsOf(p); parts.forEach((x, i) => N.libGet(x, packUrl(x), 'סידור: ' + p.he + (parts.length > 1 ? ' (' + (i + 1) + '/' + parts.length + ')' : ''), !!store.get('libWifi', true))); }
  async function openSave() {
    await load(); if (curView !== 'libsave') nav('libsave', { depth: depth() }); drawSave();
    clearInterval(openSave.t); openSave.t = setInterval(() => { if (curView !== 'libsave') return clearInterval(openSave.t); drawSave(); }, 1500);
  }
  function drawSave() {
    const st = packState(); L.installed = st.installed || {};
    const used = Object.values(L.installed).reduce((a, x) => a + (x.bytes || 0), 0);
    $('#lsTop').innerHTML = LOCAL ? `<div class="lsbar"><b>הספרייה בטלפון: ${fmt(used)}</b><span>${st.free ? 'פנוי בטלפון: ' + fmt(st.free) : ''}</span></div>`
      : '<p class="lbnote">כאן, בדפדפן, הספרים נקראים ישר מהאינטרנט. הורדה לשימוש בלי אינטרנט קיימת באפליקציה לאנדרואיד.</p>';
    $('#lsList').innerHTML = L.packs.map(p => {
      const parts = partsOf(p), inst = packIn(p.id), acts = parts.map(x => (st.active || {})[x]).filter(Boolean);
      const act = acts.length ? { status: acts.some(a => a.status === 'run') ? 'run' : acts[0].status, pct: Math.round(parts.reduce((a, x) => a + (L.installed[x] ? 100 : ((st.active || {})[x] || {}).pct || 0), 0) / parts.length) } : null;
      const state = inst ? '<span class="ok">שמור</span>' : act ? `<span class="dl">${act.status === 'wait' ? 'ממתין ל-Wi-Fi' : act.status === 'unpack' ? 'פורס...' : 'יורד ' + (act.pct | 0) + '%'}</span>` : '';
      const btn = !LOCAL ? '' : inst ? `<button data-del="${p.id}">מחיקה</button>` : act ? `<button data-cancel="${p.id}">ביטול</button>` : `<button class="main" data-get="${p.id}">הורדה</button>`;
      return `<li><div class="t"><b>${esc(p.he)}${p.base ? ' <em>בסיס</em>' : ''}</b><small>${esc(p.desc || '')} · ${fmt(p.zipBytes || p.bytes || 0)}</small>${act && act.pct ? `<i class="pr" style="--p:${act.pct | 0}%"></i>` : ''}</div>${state}${btn}</li>`;
    }).join('');
    $('#lsWifi').setAttribute('aria-checked', String(!!store.get('libWifi', true)));
  }

  /* ---------------- events ---------------- */
  function wire() {
    $('#lbScene').addEventListener('click', e => {
      if (cur || book || drawerOpen) return;
      if (e.target.closest('[data-lect]')) return openLectern(e.target.closest('[data-lect]'));
      const dr = e.target.closest('[data-drawer]'); if (dr) return openDrawer(+dr.dataset.drawer, dr);
      const sl = e.target.closest('.slot'); if (sl && !sl.disabled) openShelf(+sl.dataset.set);
    });
    $('#lbRow').onclick = e => { const b = e.target.closest('[data-vol]'); if (!b || book) return; b.classList.add('pull'); setTimeout(() => openVol(cur.s.vols[+b.dataset.vol], b, cur.s.tex), reduce() ? 0 : 230); };
    $('#lbCase').addEventListener('click', e => {
      const x = e.target.closest('[data-book]'); if (x && book) { const k = x.dataset.k; if (k === undefined) { const bk = L.by[x.dataset.book]; book.v = { name: short(bk.he), books: [bk] }; return drawContents(book.v); } return openBook(x.dataset.book, +k); }
    });
    $('#lbDim').onclick = () => { if (drawerOpen) return closeTray(); if (book) closeVol(); };
    $('#lbTray').addEventListener('click', e => {
      if (e.target.id === 'lbTrayX') return closeTray();
      const o = e.target.closest('[data-open],[data-go]'); if (!o) return;
      if (o.dataset.go) { closeTray(); return go(o.dataset.go); }
      closeTray(); openBook(o.dataset.open, o.dataset.k !== undefined ? +o.dataset.k : null, { label: o.dataset.label, seg: o.dataset.seg !== undefined ? +o.dataset.seg : null });
    });
    $('#lbFind').onclick = () => go('#find');
    $('#lbBack').onclick = () => { if (drawerOpen) return closeTray(); if (book) return closeVol(); if (cur) return closeShelf(); history.back(); };
    $('#lrPrev').onclick = () => step(-1); $('#lrNext').onclick = () => step(1);
    $('#lrModes').onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; R.mode = b.dataset.mode; store.set('libmode', R.mode); drawReader(); };
    $('#lrBody').addEventListener('click', e => {
      if (e.target.id === 'lrZoom') { dafZoom = !dafZoom; return fitDaf(); }
      const m = e.target.closest('[data-mark]'); if (m) { const i = +m.dataset.mark, sec = R.t.sections.find(x => x.k === R.k), marks = store.get('libmarks', []), at = marks.findIndex(f => f.id === R.id && f.k === R.k && f.seg === i);
        if (at >= 0) marks.splice(at, 1); else marks.unshift({ id: R.id, k: R.k, seg: i, label: sec.label, snip: (document.querySelector('#ls' + i + ' .txt') || {}).textContent.slice(0, 40) }); store.set('libmarks', marks.slice(0, 200)); m.textContent = at >= 0 ? '☆' : '★'; return; }
      const b = e.target.closest('[data-seg][data-c]'); if (!b) return; const i = +b.dataset.seg, j = +b.dataset.c; R.open[i] = R.open[i] === j ? undefined : j;
      chunk(R.id, R.k).then(drawRead);
    });
    $('#lrStar').onclick = () => { const f = store.get('libfav', []), at = f.findIndex(x => x.id === R.id && x.k === R.k), sec = R.t.sections.find(x => x.k === R.k);
      if (at >= 0) f.splice(at, 1); else f.unshift({ id: R.id, k: R.k, label: sec.label }); store.set('libfav', f.slice(0, 200)); $('#lrStar').setAttribute('aria-pressed', String(at < 0)); };
    $('#lsList').onclick = e => { const g = e.target.closest('[data-get],[data-cancel],[data-del]'); if (!g || !N) return;
      const p = L.packs.find(x => x.id === (g.dataset.get || g.dataset.cancel || g.dataset.del));
      if (g.dataset.get) getPack(p); if (g.dataset.cancel) partsOf(p).forEach(x => N.libCancel(x)); if (g.dataset.del) partsOf(p).forEach(x => N.libDelete(x)); setTimeout(drawSave, 300); };
    $('#lsWifi').onclick = () => { store.set('libWifi', !store.get('libWifi', true)); drawSave(); };
    window.addEventListener('resize', () => { if (curView === 'library' && !cur) fit(); if (curView === 'libread') fitDaf(); });
    /* the shell tells us when a pack has landed */
    window.SidurLibChanged = () => { refreshInstalled(); if (curView === 'library') drawCase(); if (curView === 'libsave') drawSave(); };
  }
  async function step(d) { const i = R.t.sections.findIndex(x => x.k === R.k), s = R.t.sections[i + d]; if (!s) return; R.k = s.k; R.open = {}; R.hl = null; drawReader(); }
  let wired = false;
  async function open(fromBack) {
    if (fromBack) show('library'); else if (curView !== 'library') nav('library', { depth: depth() });
    if (!wired) { wired = true; wire(); }
    try { await load(); } catch (e) { head('ספרייה', 'הספרייה עוד לא זמינה'); return; }
    buildSets(); fit(); drawCase();
    if (book) closeVol(true); if (drawerOpen) closeTray(); if (cur) closeShelf();
  }
  window.SidurLib = { open, openBook, openSave, search, snippet, load, packs: () => L.packs, getPack, cat: () => L.cat, back: () => { if (curView === 'library' && (drawerOpen || book || cur)) { $('#lbBack').click(); return true; } return false; }, reader: () => curView === 'libread' && drawReader() };
})();
