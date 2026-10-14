/* extras.js - what the owner asked for on top of the original siddur:
   reminders the user defines (before a time of the day, at a fixed hour, for a prayer or a study session with
   what is learned attached), the original's "do not disturb me while praying", the home-screen window of Android,
   a small search with favourites, and Chok LeYisrael.
   Times always come from the siddur's own engine. The device work (alarms, notifications, widget, do-not-disturb)
   is done by the Android shell through window.SidurNative; in a plain browser those parts say so and stay idle. */
'use strict';
(function () {
  const N = window.SidurNative || null, C = window.CalCore;
  /* iPhone and iPad: the same reminders through the app's local notifications (there is no "do not disturb" for apps there) */
  const CAP = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.nativePromise ? window.Capacitor : null;
  const capCall = (method, options) => CAP ? CAP.nativePromise('LocalNotifications', method, options || {}) : Promise.reject(new Error('no native shell'));
  let capAllowed = null;
  function iosSchedule(list) {                           /* iOS keeps at most 64 waiting notifications per app */
    capCall('getPending').then(p => p && p.notifications && p.notifications.length ? capCall('cancel', { notifications: p.notifications.map(n => ({ id: n.id })) }) : null)
      .then(() => list.length ? capCall('schedule', { notifications: list.slice(0, 60).map((a, i) => ({ id: 1000 + i, title: a.title, body: a.text, schedule: { at: new Date(a.at).toISOString(), allowWhileIdle: true }, extra: { go: a.go } })) }) : null).catch(() => { });
  }
  if (CAP) { try { CAP.addListener('LocalNotifications', 'localNotificationActionPerformed', ev => { const t = ev && ev.notification && ev.notification.extra && ev.notification.extra.go; if (t) { if (ENG) goTarget(t); else window.__afterBoot = () => goTarget(t); } }); } catch (e) { }
    capCall('checkPermissions').then(r => { capAllowed = r && r.display === 'granted'; }).catch(() => { }); }
  const nativeInfo = () => { try { return N ? JSON.parse(N.info()) : null; } catch (e) { return null; } };
  const pad = n => String(n).padStart(2, '0'), hm = min => Math.floor(min / 60) + ':' + pad(min % 60);
  const dayAt = (k, h, m) => { const n = NOW(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + k, h || 0, m || 0, 0, 0); };

  /* ================= where a reminder, a favourite or a search result leads ================= */
  const BOOKS = [[1, 41, 'ספר ראשון'], [42, 72, 'ספר שני'], [73, 89, 'ספר שלישי'], [90, 106, 'ספר רביעי'], [107, 150, 'ספר חמישי']];
  function openPsalm(n) {
    const b = BOOKS.findIndex(x => n >= x[0] && n <= x[1]); if (b < 0) return; sync();
    openPage({ file: 'tehilim/book' + (b + 1), title: BOOKS[b][2], forceDay: 0 });
    const want = 'פרק ' + C.heNum(n), btn = [...document.querySelectorAll('#steps button')].find(x => x.textContent === want); if (btn) btn.click();
  }
  function goTarget(t, label) {
    if (!t || !ENG) return;
    if (t.startsWith('tfila:')) { sync(); const b = tfilaButton(ENG.menu('showTfilaMenu'), t.slice(6)); return b ? clickButton(b) : go('menu:showTfilaMenu'); }
    if (t.startsWith('path:')) {                       /* a walk through the original's own menus, by the names of its buttons */
      const [root, ...names] = t.slice(5).split('>'); sync(); let m = ENG.menu(root), r = null;
      for (const nm of names) { const b = m.buttons.find(x => x.visible && x.text === nm); if (!b) { r = null; break; } r = ENG.click(b); if (r.menu) m = r.menu; else break; }
      if (r && r.dialog) return ask(r.dialog); if (r && r.pages && r.pages.length) return openPage(r.pages[0]);
      return pushMenu(m, root === 'showTfilaMenu' && !names.length ? 'tfila' : '');
    }
    if (t.startsWith('ps:')) return openPsalm(+t.slice(3));
    if (t.startsWith('smv:')) return Luach.openSmv(+t.slice(4));
    if (t.startsWith('yz:')) { const [m, d] = t.slice(3).split(':').map(Number); return Luach.showYz(m, d); }
    if (t.startsWith('part:')) {                       /* a part inside a prayer: open the prayer, then go to the part, as the strip does */
      const at = t.lastIndexOf('|'); goTarget(t.slice(5, at), label);
      const a = document.getElementById('sk' + t.slice(at + 1)); if (curView === 'reader' && a) a.scrollIntoView({ block: 'start' }); return;
    }
    if (t === '#chok') return openChok();
    if (t === '#rem') return openRem();
    return go(t, label);
  }
  /* a reminder was pressed: the shell hands over what was attached to it */
  window.SidurGo = () => { let t = ''; try { t = N ? N.takeGo() : ''; } catch (e) { } if (!t) return; const run = () => { $('#splash').style.display = 'none'; goTarget(t); }; if (ENG) run(); else window.__afterBoot = run; };

  /* ================= search, with favourites ================= */
  let findIndex = null, findDay = '';
  const favs = store.get('favs', []);
  const norm = s => String(s).replace(/[֑-ׇ"'׳״().,:;-]/g, '').replace(/\s+/g, ' ').trim();
  function buildIndex() {
    const key = NOW().toDateString() + '|' + cityIndex() + '|' + (place().name || ''); if (findIndex && findDay === key) return findIndex; findDay = key; sync();
    const out = [], add = (label, target, group) => out.push({ label, target, group, n: norm(label) });
    const walk = (root, group, m, path, depth) => { for (const b of m.buttons) { if (!b.visible || !b.text) continue; const p = path.concat(b.text), label = p.join(' · ');
      let r = null; try { r = ENG.click(b); } catch (e) { continue; }
      const target = 'path:' + root + '>' + p.join('>'); add(label, target, group);
      /* the parts of a prayer, by the names of its own strip (שחרית · ברוך שאמר) */
      if (root === 'showTfilaMenu' && r.pages && r.pages.length) { let pg = null; try { pg = ENG.page(r.pages[0].file, r.pages[0].forceDay); } catch (e) { }
        for (const s of (pg && pg.skips) || []) { const pl = p.concat(s.title).join(' · '); if (s.title && !out.some(x => x.label === pl)) add(pl, 'part:' + target + '|' + s.line, 'חלקי התפילה'); } }
      if (r.menu && depth < 2) walk(root, group, r.menu, p, depth + 1); } };
    try { walk('showTfilaMenu', 'תפילות', ENG.menu('showTfilaMenu'), [], 0); walk('showTehilimTypeMenu', 'תהילים', ENG.menu('showTehilimTypeMenu'), [], 0); } catch (e) { }
    for (let n = 1; n <= 150; n++) add('תהילים פרק ' + C.heNum(n), 'ps:' + n, 'תהילים');
    C.PARSHA.concat(['וזאת הברכה']).forEach((p, i) => add('חומש · פרשת ' + p, 'smv:' + i, 'חומש'));
    add('פרשת המן · שניים מקרא ואחד תרגום', '#haman', 'תפילות');
    try { for (const z of dayInfo(sync(NOW())).times) add(z.name + ' · היום ' + z.text, '#luach', 'זמני היום'); } catch (e) { }
    [['חוק לישראל', '#chok'], ['לוח שנה ויארצייט', '#cal'], ['זמני היום', '#luach'], ['תזכורות', '#rem'], ['ניווט לבית כנסת הקרוב', '#shul'], ['הגדרות', '#settings'], ['מדריך', '#guide'], ['שיתוף הסידור', '#share'], ['עזרה (ההנחיות של התוכנה המקורית)', 'page:help'], ['אודות', '#about']].forEach(([l, t]) => add(l, t, 'מסכים'));
    sync(NOW()); return (findIndex = out);
  }
  const isFav = t => favs.some(f => f.target === t);
  /* every result, grouped by kind in a fixed order; a strip of the kinds found filters to one of them */
  const GROUPS = ['תפילות', 'חלקי התפילה', 'תהילים', 'חומש', 'זמני היום', 'יארצייט צדיקים', 'מסכים'], SHOW = 8;
  let findCat = '', findOpen = {};
  const row = (x, i) => `<li><button class="fr" data-i="${i}"><span class="t">${esc(x.label)}</span>${x.sub ? `<span class="x">${esc(x.sub)}</span>` : ''}</button><button class="star" data-s="${i}" aria-pressed="${isFav(x.target)}" aria-label="מועדף">${isFav(x.target) ? '★' : '☆'}</button></li>`;
  function drawFind() {
    const q = norm($('#findQ').value), terms = q.split(' ').filter(Boolean);
    if (!terms.length) {
      const hits = favs.map(f => ({ label: f.label, target: f.target, group: 'מועדפים' }));
      $('#findCats').innerHTML = ''; $('#findNote').textContent = favs.length ? 'המועדפים שלך' : 'אפשר לחפש תפילה, חלק בתפילה, פרק תהילים, פרשה, זמן מזמני היום, צדיק ברשימת היארצייט או מסך. התוצאות מסודרות לפי סוג. הכוכב שומר תוצאה למועדפים.';
      $('#findRes').innerHTML = hits.map((x, i) => row(x, i)).join(''); $('#findRes')._hits = hits; return;
    }
    const last = x => x.n.slice(x.n.lastIndexOf('·') + 1).trim();
    const found = buildIndex().filter(x => terms.every(t => x.n.indexOf(t) !== -1))
      .concat(window.Luach && Luach.yzFind ? Luach.yzFind(q).map(y => ({ label: y.t, sub: y.when, target: 'yz:' + y.m + ':' + y.d, group: 'יארצייט צדיקים', n: norm(y.t) })) : []);
    const by = {}; for (const x of found) (by[x.group] = by[x.group] || []).push(x);
    for (const g in by) by[g].sort((a, b) => (last(b).startsWith(terms[0]) ? 1 : 0) - (last(a).startsWith(terms[0]) ? 1 : 0));
    const cats = GROUPS.filter(g => by[g]); if (findCat && !by[findCat]) findCat = '';
    $('#findCats').innerHTML = cats.length > 1 ? `<button data-c="" aria-pressed="${!findCat}">הכול <small>${found.length}</small></button>` + cats.map(g => `<button data-c="${g}" aria-pressed="${findCat === g}">${g} <small>${by[g].length}</small></button>`).join('') : '';
    $('#findNote').textContent = found.length ? '' : 'לא נמצא. אפשר לנסות מילה אחת בלבד, או כתיב אחר.';
    const hits = []; let html = '';
    for (const g of (findCat ? [findCat] : cats)) {
      const all = by[g], cut = findCat || findOpen[g] ? all.length : SHOW;
      html += `<li class="fgrp">${g}<small>${all.length}</small></li>` + all.slice(0, cut).map(x => { hits.push(x); return row(x, hits.length - 1); }).join('');
      if (all.length > cut) html += `<li class="fmore"><button data-more="${g}">עוד ${all.length - cut} ב${g}</button></li>`;
    }
    $('#findRes').innerHTML = html; $('#findRes')._hits = hits;
  }
  $('#findCats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; findCat = b.dataset.c; drawFind(); $('#findRes').parentNode.scrollTop = 0; };
  function openFind() { $('#findQ').value = ''; findCat = ''; findOpen = {}; drawFind(); openSheet('Find'); if (window.Luach && Luach.yzReady) Luach.yzReady.then(() => { if ($('#findQ').value) drawFind(); }); }
  $('#findQ').oninput = () => { findOpen = {}; drawFind(); };
  $('#findRes').onclick = e => {
    const more = e.target.closest('[data-more]'); if (more) { findOpen[more.dataset.more] = 1; return drawFind(); }
    const hits = $('#findRes')._hits || [], s = e.target.closest('.star');
    if (s) { const x = hits[+s.dataset.s], at = favs.findIndex(f => f.target === x.target); if (at >= 0) favs.splice(at, 1); else favs.push({ label: x.label, target: x.target }); store.set('favs', favs); return drawFind(); }
    const b = e.target.closest('.fr'); if (!b) return; const x = hits[+b.dataset.i]; closeSheet('Find'); goTarget(x.target, x.label);
  };
  $('#scrimFind').onclick = () => closeSheet('Find'); $('#findClose').onclick = () => closeSheet('Find');

  /* ================= reminders ================= */
  const rems = store.get('rems', []);
  const saveRems = () => { store.set('rems', rems); plan(); };
  const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'], BEFORE = [0, 5, 10, 15, 20, 30, 45, 60, 90];
  const zmanNames = () => { const set = []; try { for (const k of [0, 1, 2, 3, 4, 5, 6]) { const d = dayAt(k, 12); for (const z of dayInfo(sync(d)).times) if (!set.includes(z.name)) set.push(z.name); } sync(NOW()); } catch (e) { } return set; };
  function attachOptions() {
    const out = [['', 'בלי']]; if (!ENG) return out; sync();
    for (const b of ENG.menu('showTfilaMenu').buttons) if (b.visible && b.text) { const base = DAYSEQ.find(n => b.text.startsWith(n)) || b.text; out.push(['tfila:' + base, 'תפילה · ' + base]); }
    out.push(['path:showTehilimTypeMenu>לפי ימי החודש>היום הנוכחי', 'תהילים · של היום בחודש'], ['path:showTehilimTypeMenu>לפי ימי השבוע>היום הנוכחי', 'תהילים · של היום בשבוע'],
      ['smv:-1', 'חומש · העלייה של היום'], ['#haman', 'פרשת המן · שניים מקרא ואחד תרגום'], ['#chok', 'חוק לישראל · של היום'], ['#cal', 'לוח שנה ויארצייט'], ['#luach', 'זמני היום']);
    return out;
  }
  const whenText = r => (r.kind === 'zman' ? (r.before ? r.before + " דק' לפני " : 'ב') + r.zman : 'בשעה ' + r.time) + ' · ' + (r.days.length === 7 ? 'כל יום' : r.days.length ? 'ימים ' + r.days.map(d => DAYS[d]).join(' ') : 'אף יום');
  function drawRem() {
    const info = nativeInfo();
    $('#remState').innerHTML = CAP ? (capAllowed ? '<p>ההתראות מאושרות. התזכורות מתוזמנות לימים הקרובים (עד 60 בכל פעם) ומתחדשות בכל פתיחה של הסידור.</p>' : '<p>כדי שתזכורת תופיע בזמן, צריך לאשר לסידור להציג התראות.</p><button class="pbtn main" id="remAsk">אישור התראות</button>')
      : !N ? '<p>ההתראות עצמן פועלות באפליקציה (אנדרואיד ואייפון). כאן, בדפדפן, אפשר להגדיר את הרשימה והיא נשמרת.</p>'
      : !info || !info.notify ? '<p>כדי שתזכורת תופיע בזמן, צריך לאשר לסידור להציג התראות.</p><button class="pbtn main" id="remAsk">אישור התראות</button>'
      : `<p>ההתראות מאושרות.${info.exact ? '' : ' המכשיר אינו מרשה התראה בדקה מדויקת, ולכן תזכורת עשויה להתאחר במעט.'} התזכורות מתוזמנות ל-30 הימים הקרובים ומתחדשות בכל פתיחה של הסידור.</p>`;
    $('#remList').innerHTML = rems.length ? rems.map((r, i) => `<li><button class="rrow" data-i="${i}"><span class="t">${esc(r.title || (r.kind === 'zman' ? r.zman : 'תזכורת'))}</span><span class="x">${esc(whenText(r))}${r.attach && r.attach.target ? ' · נפתח: ' + esc(r.attach.label) : ''}</span></button><button class="sw" role="switch" aria-checked="${!!r.on}" data-on="${i}" aria-label="פעילה"></button></li>`).join('')
      : '<li class="none">עדיין אין תזכורות. אפשר להגדיר תזכורת לפני זמן מזמני היום, בשעה קבועה, או לתפילה וללימוד עם מה שייפתח בלחיצה.</li>';
  }
  function openRem() { if (curView !== 'rem') nav('rem', { depth: depth() }); drawRem(); }
  let editing = -1;
  function editRem(i) {
    editing = i; const r = i >= 0 ? rems[i] : { kind: 'time', time: '07:00', zman: '', before: 10, days: [0, 1, 2, 3, 4, 5], title: '', attach: { target: '', label: '' }, on: 1 };
    $('#reTitle').value = r.title || ''; $('#reKind').value = r.kind; $('#reTime').value = r.time || '07:00';
    const zn = zmanNames(); $('#reZman').innerHTML = zn.map(z => `<option>${esc(z)}</option>`).join(''); if (r.zman && zn.includes(r.zman)) $('#reZman').value = r.zman;
    $('#reBefore').innerHTML = BEFORE.map(b => `<option value="${b}">${b ? b + ' דקות לפני' : 'בזמן עצמו'}</option>`).join(''); $('#reBefore').value = String(r.before || 0);
    const at = attachOptions(); $('#reAttach').innerHTML = at.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    if (r.attach && r.attach.target && !at.some(a => a[0] === r.attach.target)) $('#reAttach').insertAdjacentHTML('beforeend', `<option value="${esc(r.attach.target)}">${esc(r.attach.label)}</option>`);
    $('#reAttach').value = (r.attach && r.attach.target) || '';
    $('#reDays').innerHTML = DAYS.map((d, k) => `<button class="chipb" data-d="${k}" aria-pressed="${r.days.includes(k)}">${d}</button>`).join('');
    $('#reDel').classList.toggle('hide', i < 0); syncKind(); openSheet('Rem');
  }
  const syncKind = () => { const z = $('#reKind').value === 'zman'; $('#reRowTime').classList.toggle('hide', z); $('#reRowZman').classList.toggle('hide', !z); $('#reRowBefore').classList.toggle('hide', !z); };
  $('#reKind').onchange = syncKind;
  $('#reDays').onclick = e => { const b = e.target.closest('[data-d]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); };
  $('#reSave').onclick = () => {
    const a = $('#reAttach'), r = { on: 1, title: $('#reTitle').value.trim(), kind: $('#reKind').value, time: $('#reTime').value || '07:00', zman: $('#reZman').value, before: +$('#reBefore').value,
      days: [...document.querySelectorAll('#reDays [aria-pressed="true"]')].map(b => +b.dataset.d), attach: { target: a.value, label: a.value ? a.options[a.selectedIndex].textContent : '' } };
    if (editing >= 0) { r.on = rems[editing].on; rems[editing] = r; } else rems.push(r);
    closeSheet('Rem'); saveRems(); drawRem();
    const info = nativeInfo(); if (N && info && !info.notify) N.askNotify();
    if (CAP && !capAllowed) capCall('requestPermissions').then(r => { capAllowed = r && r.display === 'granted'; drawRem(); plan(); }).catch(() => { });
  };
  $('#reDel').onclick = () => { if (editing >= 0) rems.splice(editing, 1); closeSheet('Rem'); saveRems(); drawRem(); };
  $('#reCancel').onclick = () => closeSheet('Rem'); $('#scrimRem').onclick = () => closeSheet('Rem');
  $('#remNew').onclick = () => editRem(-1);
  $('#remList').onclick = e => { const s = e.target.closest('[data-on]'); if (s) { const r = rems[+s.dataset.on]; r.on = r.on ? 0 : 1; saveRems(); return drawRem(); } const b = e.target.closest('.rrow'); if (b) editRem(+b.dataset.i); };
  $('#remState').onclick = e => { if (e.target.id !== 'remAsk') return; if (N) return N.askNotify();
    if (CAP) capCall('requestPermissions').then(r => { capAllowed = r && r.display === 'granted'; drawRem(); plan(); }).catch(() => { }); };
  /* reminders offered by the new user's kit: added once each, by their title, and then they are ordinary reminders */
  const hasRem = title => rems.some(r => r.title === title);
  function addRems(list) {
    const fresh = list.filter(r => !hasRem(r.title)); if (!fresh.length) return 0;
    fresh.forEach(r => rems.push(r)); saveRems(); if (curView === 'rem') drawRem();
    const info = nativeInfo(); if (N && info && !info.notify) N.askNotify();
    if (CAP && !capAllowed) capCall('requestPermissions').then(r => { capAllowed = r && r.display === 'granted'; plan(); }).catch(() => { });
    return fresh.length;
  }
  window.SidurPerm = () => { if (curView === 'rem') drawRem(); plan(); };

  /* ---- the plan for the coming days: alarms for the reminders, and the timeline of the home-screen window ---- */
  let planTimer = 0;
  function plan() { clearTimeout(planTimer); planTimer = setTimeout(runPlan, 1200); }
  function runPlan() {
    if (!ENG) return; const now = NOW().getTime(), alarms = [], tl = [], infos = [], HORIZON = 30, WIDGET_DAYS = 14;
    let k = 0;
    const step = () => {
      try {
        const noon = dayAt(k, 12), info = dayInfo(sync(noon)); infos[k] = info; const wd = noon.getDay();
        rems.forEach((r, ri) => {
          if (!r.on || !r.days.includes(wd)) return; let min, text;
          if (r.kind === 'zman') { if (wd === 5 && r.zman.startsWith('מוצ')) return; const z = info.times.find(x => x.name === r.zman); if (!z) return; min = z.min - (r.before || 0); text = z.name + ' בשעה ' + z.text; }
          else { const [h, m] = (r.time || '07:00').split(':').map(Number); min = h * 60 + m; text = ''; }
          const at = dayAt(k, 0, min).getTime(); if (at <= now) return;
          alarms.push({ id: ri, at, title: r.title || (r.kind === 'zman' ? (r.before ? 'בעוד ' + r.before + ' דקות: ' : '') + r.zman : 'תזכורת'), text: [text, r.attach && r.attach.label ? 'לחיצה פותחת: ' + r.attach.label : ''].filter(Boolean).join(' · '), go: (r.attach && r.attach.target) || '' });
        });
      } catch (e) { infos[k] = null; }
      if (++k <= HORIZON) return void setTimeout(step, 0);
      /* the widget: one entry per change of "the next time", and the date turns at sunset */
      for (let d = 0; d < WIDGET_DAYS; d++) {
        const info = infos[d], next = infos[d + 1]; if (!info) continue; const day = dayAt(d, 12), wd = day.getDay();
        const zs = info.times.filter(z => !(wd === 5 && z.name.startsWith('מוצ'))).slice().sort((a, b) => a.min - b.min);
        const shkia = (info.times.find(z => z.name.startsWith('שקיעה')) || {}).min, line = i => (i.tachanun && i.tachanun !== 'אין יארצייט' ? 'לוח תחנון: ' + i.tachanun : 'דף יומי: ' + i.daf);
        const dateOf = min => shkia !== undefined && min >= shkia && next ? 'ליל ' + DOW[(wd + 1) % 7] + ', ' + next.date : 'יום ' + DOW[wd] + ', ' + info.date;
        let from = 0;
        const after = i => zs.slice(i + 1, i + 3).map(z => z.name + ' ' + z.text).join(' · '), saying = min => { const p = nowPair(info, min)[0]; return (p ? 'עכשיו אומרים: ' + p + ' · ' : '') + line(info); };
        zs.forEach((z, i) => { tl.push({ from: dayAt(d, 0, from).getTime(), date: dateOf(from), next: z.name, time: z.text, after: after(i), line: saying(from) }); from = z.min; });
        const first = next && next.times.slice().sort((a, b) => a.min - b.min)[0];
        tl.push({ from: dayAt(d, 0, from).getTime(), date: dateOf(from), next: first ? first.name + ' (מחר)' : '', time: first ? first.text : '', after: '', line: saying(from) });
      }
      try { sync(NOW()); } catch (e) { }
      alarms.sort((a, b) => a.at - b.at);
      try { if (N) { N.setAlarms(JSON.stringify(alarms.slice(0, 200))); N.setWidget(JSON.stringify(tl)); } } catch (e) { }
      if (CAP) iosSchedule(alarms);
      window.__plan = { alarms: alarms.length, first: alarms[0] || null, widget: tl.length };
    };
    step();
  }
  window.SidurPlan = plan;

  /* ================= "do not disturb me while praying" (the original's own feature) ================= */
  let dndOn = false;
  window.SidurDndOff = () => { dndOn = false; };
  function onView(prev, view) {
    if (!N || !cfg.autoDnd) return;
    if (view === 'reader' && !dndOn) { dndOn = true; try { N.setDnd(true); } catch (e) { } }
    else if (view !== 'reader' && dndOn) { dndOn = false; try { N.setDnd(false); } catch (e) { } }
  }
  function onSetting(key) { if (key === 'autoDnd' && cfg.autoDnd && N) { const i = nativeInfo(); if (i && !i.dnd) N.askDnd(); } plan(); }

  /* ================= Chok LeYisrael ================= */
  const chMem = Object.assign({ done: {} }, store.get('chok', {})), chKey = () => CH.n + '@' + C.shabbatOf(Luach.todayNum());
  const chDone = () => chMem.done[chKey()] || [];
  const CH = { n: 0, day: 'yom1', names: [] }, CHDAYS = [['yom1', 'ראשון'], ['yom2', 'שני'], ['yom3', 'שלישי'], ['yom4', 'רביעי'], ['yom5', 'חמישי'], ['leil6', 'ליל שישי'], ['yom6', 'שישי']];
  const ALL = C.PARSHA.concat(['וזאת הברכה']);
  function openChok() {
    const week = String(Luach.weekly(Luach.todayNum()) || '').split(' - ').map(x => ALL.indexOf(x)).filter(i => i >= 0), wd = C.dow(Luach.todayNum());
    CH.names = week; CH.n = (week.length ? week[0] : 0) + 1; CH.day = wd >= 5 ? 'yom6' : 'yom' + (wd + 1);
    if (curView !== 'chok') nav('chok', { depth: depth() }); drawChok();
  }
  function drawChok() {
    $('#chokSel').innerHTML = ALL.slice(0, 54).map((p, i) => `<option value="${i + 1}">${esc(p)}</option>`).join(''); $('#chokSel').value = String(CH.n);
    const done = chDone();
    $('#chokDays').innerHTML = CHDAYS.map(([k, l]) => `<button data-day="${k}"${k === CH.day ? ' class="on"' : ''}>${l}${done.includes(k) ? ' ✓' : ''}</button>`).join('') + `<button data-day="intro"${CH.day === 'intro' ? ' class="on"' : ''}>הקדמות ותפילות</button>`;
    $('#chokSub').textContent = CH.day === 'intro' ? 'הקדמות הספר והתפילות שלפני הלימוד' : 'פרשת ' + ALL[CH.n - 1] + ' · ' + (CHDAYS.find(d => d[0] === CH.day) || ['', ''])[1];
    $('#chokDone').classList.toggle('hide', CH.day === 'intro'); $('#chokDone').textContent = done.includes(CH.day) ? 'ביטול הסימון של היום' : 'סיימתי את הלימוד של היום';
    if (CH.day === 'intro') return drawChokIntro();
    $('#chokBody').innerHTML = '<p class="empty">טוען...</p>'; const key = CH.n + '/' + CH.day;
    fetch('chok/' + key + '.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => {
      if (key !== CH.n + '/' + CH.day) return; const cred = {};
      let last = '';
      const head = p => { const h = (p.k !== last ? `<div class="cap2">${esc(p.k)}</div>` : '') + (p.s ? `<div class="chsub">${esc(p.s)}</div>` : ''); last = p.k; return h; };
      $('#chokBody').innerHTML = j.portions.map(p => {
        if (p.rows) {                                /* the book edition: its own order, with what it prints after each entry */
          const TANAKH = ['תורה', 'נביאים', 'כתובים', 'הפטרה']; let prev = -1;
          return head(p) + (p.h ? `<div class="csrc">${esc(p.h)}</div>` : '') + p.rows.map(([si, x]) => {
            const lab = si ? p.subs[si - 1] : '', label = si && si !== prev && !TANAKH.includes(p.k) ? `<div class="chsub">${esc(lab)}</div>` : ''; prev = si;
            return label + `<p class="ctx${si ? ' sub' + (lab.indexOf('תרגום') === 0 && TANAKH.includes(p.k) ? ' targ' : lab === 'כוונה' || lab === 'הערה' ? ' note' : '') : ''}">${x}</p>`;
          }).join('');
        }
        if (p.t) { if (p.v) cred[p.v + '|' + p.l] = 1; return head(p) + (p.h ? `<div class="csrc">${esc(p.h)}</div>` : '') + p.t.map(x => `<p class="ctx${p.s ? ' sub' : ''}">${x}</p>`).join(''); }
        return head(p) + (p.h ? `<div class="csrc">${esc(p.h)}</div>` : '') + `<p class="cnone">${esc(p.why)}</p>`;
      }).join('') + '<div class="ccr">' + (j.credit ? `<div>${esc(j.credit)}</div>` + (j.creditUrl ? `<div><a class="lnk" href="${esc(j.creditUrl)}">תנאי הרישיון</a></div>` : '') : '<div>סדר הלימוד לפי אוסף דפי המקורות "חק לישראל" שבספריא. הטקסטים, כל אחד במהדורה וברישיון שלו:</div>' + Object.keys(cred).map(c => `<div>${esc(c.split('|')[0])} · ${esc(c.split('|')[1])}</div>`).join('')) + '</div>';
    }).catch(() => { if (key === CH.n + '/' + CH.day) $('#chokBody').innerHTML = '<p class="empty">הקטע של היום הזה אינו בנתונים.</p>'; });
    const on = $('#chokDays .on'); if (on) { const st = $('#chokDays'); st.scrollLeft += on.getBoundingClientRect().left + on.offsetWidth / 2 - (st.getBoundingClientRect().left + st.clientWidth / 2); }
  }
  function drawChokIntro() {
    $('#chokBody').innerHTML = '<p class="empty">טוען...</p>';
    fetch('chok/intro.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => { if (CH.day !== 'intro') return;
      $('#chokBody').innerHTML = j.sections.map(x => `<div class="cap2">${esc(x.h)}</div>` + x.t.map(t => `<p class="ctx">${t}</p>`).join('')).join('') + `<div class="ccr"><div>${esc(j.credit)}</div><div><a class="lnk" href="${esc(j.creditUrl)}">תנאי הרישיון</a></div></div>`;
    }).catch(() => { if (CH.day === 'intro') $('#chokBody').innerHTML = '<p class="empty">ההקדמות אינן בנתונים.</p>'; });
  }
  /* "I finished today's portion": kept per week, shown on the day's tab and on the home page */
  $('#chokDone').onclick = () => { const key = chKey(), d = chDone().slice(), at = d.indexOf(CH.day), week = '@' + C.shabbatOf(Luach.todayNum());
    if (at >= 0) d.splice(at, 1); else d.push(CH.day);
    for (const k of Object.keys(chMem.done)) if (!k.endsWith(week)) delete chMem.done[k];
    chMem.done[key] = d; store.set('chok', chMem); drawChok(); };
  function chokToday() { try { const wd = C.dow(Luach.todayNum()), week = String(Luach.weekly(Luach.todayNum()) || '').split(' - ').map(x => ALL.indexOf(x)).filter(i => i >= 0);
    if (!week.length || wd === 6) return false; return (chMem.done[(week[0] + 1) + '@' + C.shabbatOf(Luach.todayNum())] || []).includes(wd >= 5 ? 'yom6' : 'yom' + (wd + 1)); } catch (e) { return false; } }
  $('#chokSel').onchange = e => { CH.n = +e.target.value; drawChok(); window.scrollTo(0, 0); };
  $('#chokDays').onclick = e => { const b = e.target.closest('button'); if (!b) return; CH.day = b.dataset.day; drawChok(); window.scrollTo(0, 0); };

  window.SidurExtras = { goTarget, openRem, drawRem, openChok, drawChok, openFind, onView, onSetting, plan, chokToday, addRems, hasRem, zmanNames, whenText, canNotify: () => !!(N || CAP) };
})();
