/* luach.js - the calendar with the general yahrzeit list, and the chumash reader (Shnayim Mikra), as screens of the siddur.
   One source for every fact:
   - the Hebrew date arithmetic is CalCore, checked day by day against the original engine (engine/verify-calendar.mjs);
   - times of day, "לוח תחנון" and the notes of the day are asked from the original engine, for the city of the settings;
   - the yahrzeit list is a general list of tzadikim. It is shown as a list and decides nothing (not tachanun either). */
'use strict';
(function () {
  const C = window.CalCore;
  const GMONTH = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const WEEKDAY = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'];
  const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const ORIG = { 'חשון': 'מרחשוון', 'סיון': 'סיוון', 'מנחם אב': 'אב' };            /* month names as the original siddur writes them */
  const SRC_NAMES = ['תשרי', 'מרחשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול'];
  const mName = m => ORIG[m.name] || m.name;
  const dayNum = dt => Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / C.DAY_MS);
  const dateOf = n => { const g = new Date(n * C.DAY_MS); return new Date(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate(), 12, 0, 0); };
  /* in a cell: the Gregorian day in small, with its month where a month begins */
  const gCell = (n, d) => { const g = new Date(n * C.DAY_MS); return g.getUTCDate() === 1 || d === 1 ? g.getUTCDate() + '.' + (g.getUTCMonth() + 1) : String(g.getUTCDate()); };
  const gShort = n => { const g = new Date(n * C.DAY_MS); return g.getUTCDate() + '.' + (g.getUTCMonth() + 1); };
  const isIL = () => !!place().isInIsrael;
  /* "today" as the siddur counts it: after sunset the next day has begun */
  function todayNum() { const now = NOW(); let n = dayNum(now); try { if (ENG && sync(now).sunset) n++; } catch (e) { } return n; }
  function weekly(n) {
    let sh = C.shabbatOf(n), p = ''; for (let k = 0; k < 6 && !p; k++, sh += 7) p = C.parshaOn(sh, isIL());
    const h = C.fromDays(n);
    if (p === 'בראשית' && C.months(h.y)[h.mi].src === 0 && h.d <= (isIL() ? 22 : 23)) return 'וזאת הברכה';
    return p;
  }

  /* ================= the general yahrzeit list ================= */
  let YZ = null, yzIndex = null;
  const yzReady = fetch('yahrzeits.json').then(r => r.json()).then(j => { YZ = j; return j; }).catch(() => null);
  const unpack = list => (list || []).map(e => ({ t: e[0], y: e[1] || 0, b: !!e[2] }));
  function entriesFor(y, mi, d) {
    if (!YZ) return { own: [], carried: [], note: '' };
    const ms = C.months(y), m = ms[mi], own = unpack(YZ[m.src][d]); let carried = [], note = '';
    if (m.src === 1 && m.len === 29 && d === 29) { carried = unpack(YZ[1][30]); note = "יארצייט בל' מרחשוון (השנה החודש חסר)"; }
    if (m.src === 3 && d === 1 && ms[mi - 1].len === 29) { carried = unpack(YZ[2][30]); note = "יארצייט בל' כסלו (השנה החודש חסר)"; }
    return { own, carried, note };
  }
  function entryHtml(e, year) {
    const ago = e.y && year > e.y ? `<span class="ago">${(year - e.y).toLocaleString('he-IL')} שנה</span>` : '';
    return `<li class="${e.b ? 'em' : ''}"><i></i><span>${esc(e.t)}${ago}</span></li>`;
  }
  /* how many of the general list fall today: shown next to the calendar row of the home page */
  function todayCount() { if (!YZ) return null; const h = C.fromDays(todayNum()), e = entriesFor(h.y, h.mi, h.d); return e.own.length + e.carried.length; }

  /* ================= calendar ================= */
  const S = { y: 0, mi: 0, d: 1 };
  const cur = () => C.toDays(S.y, S.mi, S.d);
  function setDay(n) { const h = C.fromDays(n); S.y = h.y; S.mi = h.mi; S.d = h.d; }
  function openCal() { setDay(todayNum()); nav('cal', { depth: depth() }); drawCal(); yzReady.then(() => { if (curView === 'cal') drawCal(); }); }
  function drawCal() {
    const ms = C.months(S.y); if (S.mi >= ms.length) S.mi = ms.length - 1; const m = ms[S.mi]; if (S.d > m.len) S.d = m.len;
    const first = C.toDays(S.y, S.mi, 1), last = first + m.len - 1, a = new Date(first * C.DAY_MS), b = new Date(last * C.DAY_MS), il = isIL();
    $('#calMonth').textContent = mName(m) + ' ' + C.heYear(S.y);
    $('#calGreg').textContent = (a.getUTCMonth() === b.getUTCMonth() ? '' : GMONTH[a.getUTCMonth()] + (a.getUTCFullYear() === b.getUTCFullYear() ? '' : ' ' + a.getUTCFullYear()) + ' - ') + GMONTH[b.getUTCMonth()] + ' ' + b.getUTCFullYear();
    $('#calMonths').innerHTML = ms.map((x, i) => `<button data-mi="${i}"${i === S.mi ? ' class="on"' : ''}>${esc(mName(x))}</button>`).join('');
    const td = todayNum(); let html = WD.map(w => `<span class="wd">${w}</span>`).join('');
    for (let i = 0; i < C.dow(first); i++) html += '<span class="cc blank"></span>';
    for (let d = 1; d <= m.len; d++) {
      const n = first + d - 1, f = C.dayInfo(n, il), e = entriesFor(S.y, S.mi, d), cnt = e.own.length + e.carried.length;
      const star = e.own.concat(e.carried).some(x => x.b), last1 = f.labels.length ? f.labels[f.labels.length - 1] : '';
      const lb = f.w === 6 ? (C.parshaOn(n, il) || last1) : last1;
      const label = C.heNum(d) + ' ' + mName(m) + ', ' + WEEKDAY[f.w] + (lb ? ', ' + lb : '') + (cnt ? ', ' + cnt + ' יארצייט' : '');
      html += `<button class="cc${f.w === 6 ? ' sh' : ''}${f.yt ? ' yt' : ''}${f.fast ? ' fast' : ''}${n === td ? ' today' : ''}" data-d="${d}" aria-pressed="${d === S.d}" aria-label="${esc(label)}">` +
        `<span class="hn">${C.heNum(d)}</span><span class="gd">${gCell(n, d)}</span>${lb ? `<span class="lb">${esc(lb)}</span>` : ''}${cnt ? `<span class="ct${star ? ' star' : ''}">${cnt}</span>` : ''}</button>`;
    }
    $('#calGrid').innerHTML = html;
    const mo = C.molad(S.y, S.mi), endN = Math.floor((mo.parts + 14 * 25920 + 18 * 1080 + 396) / 25920);
    $('#calInfo').innerHTML = `<b>מולד ${esc(mName(m))}:</b> ${WEEKDAY[C.dow(mo.n)]}${mo.hour >= 18 ? ' בערב (אור ל' + WEEKDAY[C.dow(mo.n + 1)] + ')' : ''}, ${mo.hour}:${String(mo.minute).padStart(2, '0')}${mo.chalakim ? ' ו-' + mo.chalakim + ' חלקים' : ''} (${gShort(mo.n)}) · <b>קידוש לבנה</b> עד ${WEEKDAY[C.dow(endN)]} ${gShort(endN)}<br>המספר בתחתית כל יום: כמה יארצייט ברשימה הכללית. מעוין זהב: יארצייט שמודגש ברשימה.`;
    const on = $('#calMonths .on'); if (on) { const st = $('#calMonths'); st.scrollLeft += on.getBoundingClientRect().left + on.offsetWidth / 2 - (st.getBoundingClientRect().left + st.clientWidth / 2); }
    drawDay();
  }
  function drawDay() {
    const n = cur(), il = isIL(), f = C.dayInfo(n, il), m = C.months(S.y)[S.mi], g = dateOf(n), e = entriesFor(S.y, S.mi, S.d), total = e.own.length + e.carried.length;
    $('#calDay').textContent = `${WEEKDAY[f.w]}, ${C.heNum(S.d)} ${mName(m)} · ${g.getDate()}.${g.getMonth() + 1}.${g.getFullYear()}`;
    const parsha = f.w === 6 ? C.parshaOn(n, il) : '';
    $('#calLabels').innerHTML = f.labels.concat(parsha ? ['פרשת ' + parsha] : []).map(x => `<span>${esc(x)}</span>`).join('');
    /* the day as the original siddur states it, for the city of the settings: its own yahrzeit line, tachanun, notes, times */
    let info = null; try { if (ENG) { info = dayInfo(sync(g), g); sync(NOW()); } } catch (err) { info = null; }
    $('#calOrig').innerHTML = info ? info.hilula.map(x => `<div class="hil">${esc(x)}</div>`).join('') + `<div>לוח תחנון: <b>${esc(info.tachanun)}</b></div>` + info.notes.map(x => `<div>${esc(x)}</div>`).join('') + (info.daf ? `<div>דף יומי: ${esc(info.daf)}</div>` : '') : '';
    $('#calZm').innerHTML = info ? info.times.map(z => `<div class="lurow"><span class="nm">${esc(z.name)}</span><i class="ld"></i><span class="tm">${z.text}</span></div>`).join('') : '';
    $('#calZmCity').textContent = place().name || '';
    $('#calYz').innerHTML = !YZ ? '<li class="none">טוען את הרשימה...</li>' : total
      ? e.own.map(x => entryHtml(x, S.y)).join('') + (e.carried.length ? `<li class="carry">${esc(e.note)}</li>` + e.carried.map(x => entryHtml(x, S.y)).join('') : '')
      : '<li class="none">ברשימה הכללית אין יארצייט ביום הזה.</li>';
    $('#calYzCount').textContent = total ? ' · ' + total : '';
    $('#calCopy').classList.toggle('hide', !total); $('#calCopy').textContent = 'העתקת הרשימה';
    copyText = total ? 'יארצייט צדיקים, ' + C.heNum(S.d) + ' ' + mName(m) + ':' + NL + e.own.concat(e.carried).map(x => (x.b ? '✦ ' : '• ') + x.t).join(NL) + NL + (total === 1 ? 'זכותו יגן' : 'זכותם יגן') + ' עלינו ועל כל ישראל אמן' : '';
    document.querySelectorAll('#calGrid .cc[data-d]').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.d === S.d)));
  }
  /* the day's list as plain text, for sending on */
  let copyText = ''; const NL = String.fromCharCode(10);
  $('#calCopy').onclick = () => {
    const done = ok => { $('#calCopy').textContent = ok ? 'הועתק' : 'ההעתקה לא הצליחה'; };
    const fallback = () => { const ta = document.createElement('textarea'); ta.value = copyText; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (err) { } ta.remove(); done(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyText).then(() => done(true), fallback); else fallback();
  };
  function shift(months) { let mi = S.mi + months, y = S.y; while (mi < 0) { y--; mi += C.months(y).length; } while (mi >= C.months(y).length) { mi -= C.months(y).length; y++; } S.y = y; S.mi = mi; drawCal(); }
  $('#calGrid').onclick = e => { const c = e.target.closest('.cc[data-d]'); if (!c) return; S.d = +c.dataset.d; drawDay(); };
  $('#calMonths').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.mi = +b.dataset.mi; drawCal(); };
  $('#calPrev').onclick = () => shift(-1); $('#calNext').onclick = () => shift(1);
  $('#calToday').onclick = () => { setDay(todayNum()); drawCal(); };
  $('#calPrevY').onclick = () => { S.y--; drawCal(); }; $('#calNextY').onclick = () => { S.y++; drawCal(); };
  $('#calPrayers').onclick = () => go('menu:showTfilaMenu');
  $('#calOrigList').onclick = () => go('page:yortzait', 'לוח יארצייט');

  /* search in the general list */
  const normalize = s => s.replace(/["'׳״`*()\[\],.:;-]/g, '').replace(/\s+/g, ' ').trim();
  function runSearch(q) {
    const terms = normalize(q).split(' ').filter(Boolean), box = $('#calRes');
    $('#calFindNote').classList.toggle('hide', terms.length > 0);
    if (!YZ || !terms.length || normalize(q).length < 2) { box.innerHTML = ''; return; }
    if (!yzIndex) { yzIndex = []; for (let m = 0; m < 12; m++) for (let d = 1; d <= 30; d++) for (const x of (YZ[m][d] || [])) yzIndex.push({ m, d, t: x[0], b: !!x[2], n: normalize(x[0]) }); }
    const hits = yzIndex.filter(x => terms.every(t => x.n.indexOf(t) !== -1)), MAX = 60;
    box.innerHTML = `<p class="rescount">${hits.length === 0 ? 'לא נמצא. אפשר לנסות כתיב אחר או מילה אחת בלבד.' : hits.length > MAX ? hits.length + ' רשומות, מוצגות ' + MAX + ' הראשונות לפי סדר השנה.' : hits.length === 1 ? 'רשומה אחת' : hits.length + ' רשומות לפי סדר השנה'}</p>` +
      '<ol class="yzres">' + hits.slice(0, MAX).map(x => `<li><button data-m="${x.m}" data-day="${x.d}"><span class="x">${C.heNum(x.d)} ${SRC_NAMES[x.m]}</span><span class="t${x.b ? ' em' : ''}">${esc(x.t)}</span></button></li>`).join('') + '</ol>';
  }
  $('#calQ').oninput = e => runSearch(e.target.value);
  const openYz = () => { $('#calQ').value = ''; $('#calRes').innerHTML = ''; openSheet('Yz'); };
  $('#calFind').onclick = openYz; $('#calFind2').onclick = openYz;
  $('#scrimYz').onclick = () => closeSheet('Yz'); $('#calFindClose').onclick = () => closeSheet('Yz');
  $('#calRes').onclick = e => { const b = e.target.closest('button[data-m]'); if (!b) return;
    S.mi = C.monthIndex(S.y, +b.dataset.m, true); S.d = Math.min(+b.dataset.day, C.months(S.y)[S.mi].len);
    $('#calQ').blur(); closeSheet('Yz'); drawCal(); $('#calDay').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); };

  /* ================= chumash: Shnayim Mikra with Rashi and the commentaries on Rashi ================= */
  const ALL = C.PARSHA.concat(['וזאת הברכה']), ALIYA = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי'], BOOK_HE = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'];
  const SUP = { s: 'שפתי חכמים', g: 'גור אריה', m: 'מזרחי', b: 'ברטנורא', d: 'משכיל לדוד' };
  const R = { idx: -1, al: 0, data: null, open: {}, allOpen: false, hit: null }, pCache = {}, supCache = {}, supState = {};
  const mem = Object.assign({ mark: null, done: {}, scroll: 4 }, store.get('smv', {})), saveMem = () => store.set('smv', mem);
  const two = i => (i < 9 ? '0' : '') + (i + 1);
  const getJ = u => fetch(u).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  const loadParsha = i => pCache[i] ? Promise.resolve(pCache[i]) : getJ('smv/p' + two(i) + '.json').then(j => (pCache[i] = j));
  const thisWeek = () => String(weekly(todayNum()) || '').split(' - ').map(x => ALL.indexOf(x)).filter(i => i >= 0);
  const weekKey = i => i + '@' + C.shabbatOf(todayNum()), doneList = i => mem.done[weekKey(i)] || [];
  function aliyahOf(data, c, v) { let a = 0; for (let i = 0; i < data.al.length; i++) if (c > data.al[i][0] || (c === data.al[i][0] && v >= data.al[i][1])) a = i; return a + 1; }
  function openSmv(idx) {
    const wk = thisWeek();
    if (idx === undefined || idx < 0) idx = mem.mark && wk.indexOf(mem.mark.idx) !== -1 ? mem.mark.idx : (wk.length ? wk[0] : 0);
    if (curView !== 'smv') nav('smv', { depth: depth() });
    pickParsha(idx, 0);
  }
  function pickParsha(idx, al) {
    R.idx = idx; R.open = {}; R.allOpen = false; R.hit = null; R.data = null; R.al = al || 0; asStop();
    $('#smvSel').innerHTML = ALL.map((p, i) => `<option value="${i}">${esc(p)}</option>`).join(''); $('#smvSel').value = String(idx);
    $('#smvTitle').textContent = 'פרשת ' + ALL[idx]; $('#smvSub').textContent = ''; $('#smvAl').innerHTML = ''; $('#smvFoot').classList.add('hide'); $('#smvResume').classList.add('hide');
    $('#smvBody').innerHTML = '<p class="empty">טוען את הפרשה...</p>';
    loadParsha(idx).then(data => {
      if (R.idx !== idx) return; R.data = data; const wk = thisWeek();
      if (!al) R.al = mem.mark && mem.mark.idx === idx ? aliyahOf(data, mem.mark.c, mem.mark.v) : wk.indexOf(idx) !== -1 ? Math.min(7, C.dow(todayNum()) + 1) : 1;   /* Sunday the first aliyah ... Shabbat the seventh */
      drawSmv(); window.scrollTo(0, 0);
    }, () => { if (R.idx === idx) $('#smvBody').innerHTML = '<p class="empty">הפרשה לא נטענה.</p><p class="empty"><button class="pbtn" id="smvRetry">ניסיון נוסף</button></p>'; });
  }
  const stripTaamim = t => t.replace(/[֑-ֽ֯]/g, '');
  const supKey = (k, ri, w) => R.idx + '|' + k + '|' + ri + '|' + w;
  function supHtml(k, ri, flags) {
    if (!flags) return ''; let chips = '', boxes = '';
    for (const w of flags) {
      if (!SUP[w]) continue; const on = !!supState[supKey(k, ri, w)];
      chips += `<button class="c" data-w="${w}" data-ri="${ri}" aria-expanded="${on}">${SUP[w]}</button>`;
      if (!on) continue; const file = supCache[w + '|' + R.idx];
      boxes += !file ? `<div class="supbox"><span class="cnone">${file === null ? 'הפירוש לא נטען. לחצו שוב.' : 'טוען את ' + SUP[w] + '...'}</span></div>`
        : `<div class="supbox"><div class="csrc">${SUP[w]}</div>` + (file[k] || []).filter(x => x[0] === ri).map(x => `<div class="supnote">${x[1] ? '<b>' + esc(x[1]) + '</b> ' : ''}${x[2]}</div>`).join('') + '</div>';
    }
    return `<div class="com sup"><span class="lb">על רש"י:</span>${chips}</div>` + boxes;
  }
  function verseHtml(V, mark) {
    const k = V[0] + ':' + V[1], rs = V[5] || [], link = {}, open = R.allOpen || R.open[k];
    rs.forEach((r, ri) => { if (r[2] >= 0) for (let w = r[2]; w <= r[3]; w++) if (link[w] === undefined) link[w] = ri; });
    const words = V[2].split(' ').map((t, wi) => {
      if (!cfg.smvTaamim) { if (t === '׀') return ''; t = stripTaamim(t); }
      return link[wi] !== undefined ? `<span class="rw${R.hit === k + '#' + link[wi] ? ' on' : ''}" data-r="${link[wi]}">${esc(t)}</span>` : esc(t);
    }).filter(Boolean).join(' ');
    const mikra = `<p class="mikra">${words}${V[4] ? ` <span class="pm">(${V[4]})</span>` : ''}</p>`;
    let h = `<article class="pv${k === mark ? ' marked' : ''}" data-k="${k}"><div class="pn">${C.heNum(V[1]).replace(/["']/g, '')}</div><div class="pb">${mikra}` +
      (cfg.smvTwice ? mikra.replace('class="mikra"', 'class="mikra again"') : '') + (cfg.smvTargum && V[3] ? `<p class="targum">${esc(V[3])}</p>` : '') +
      `<div class="pact">${rs.length ? `<button class="rbtn" aria-expanded="${!!open}">רש"י${rs.length > 1 ? ' · ' + rs.length : ''}</button>` : ''}<button class="mbtn">${k === mark ? 'הסימנייה כאן' : 'עצרתי כאן'}</button></div>`;
    if (rs.length) h += `<div class="rashi"${open ? '' : ' hidden'}>` + rs.map((r, ri) => `<div class="rc${R.hit === k + '#' + ri ? ' hit' : ''}" data-i="${ri}">${r[0] ? '<b>' + esc(r[0]) + '</b> ' : ''}${r[1]}${supHtml(k, ri, r[4])}</div>`).join('') +
      (V[6] ? `<div class="rc more">${supHtml(k, -1, V[6])}</div>` : '') + '</div>';
    return h + '</div></article>';
  }
  function drawSmv() {
    const data = R.data, idx = R.idx; if (!data) return;
    $('#smv').classList.toggle('rashiscript', !!cfg.smvRashiFont);
    $('#smvSub').textContent = `${BOOK_HE[data.b]} ${C.heNum(data.ref[0])}, ${C.heNum(data.ref[1])} - ${C.heNum(data.ref[2])}, ${C.heNum(data.ref[3])} · ${data.v.length} פסוקים`;
    const wk = thisWeek(), other = wk.length > 1 && wk.indexOf(idx) !== -1 ? (wk[0] === idx ? wk[1] : wk[0]) : -1;
    $('#smvWeek').classList.toggle('hide', other < 0);
    if (other >= 0) $('#smvWeek').innerHTML = `השבוע קוראים ${esc(weekly(todayNum()))}. <button class="lnk" data-go="${other}">לפרשת ${esc(ALL[other])}</button>`;
    const done = doneList(idx);
    $('#smvAl').innerHTML = `<button data-al="0"${R.al === 0 ? ' class="on"' : ''}>כל הפרשה</button>` + ALIYA.map((a, i) => `<button data-al="${i + 1}"${R.al === i + 1 ? ' class="on"' : ''}>${a}${done[i] ? ' ✓' : ''}</button>`).join('');
    const mark = mem.mark && mem.mark.idx === idx ? mem.mark.c + ':' + mem.mark.v : '';
    $('#smvResume').classList.toggle('hide', !mark);
    if (mark) $('#smvResume').textContent = `המשך מהמקום שעצרת: ${ALIYA[aliyahOf(data, mem.mark.c, mem.mark.v) - 1]}, פרק ${C.heNum(mem.mark.c)} פסוק ${C.heNum(mem.mark.v)}`;
    let html = '', lastC = -1, lastA = 0;
    for (const V of data.v) {
      const va = aliyahOf(data, V[0], V[1]); if (R.al && va !== R.al) continue;
      if (!R.al && va !== lastA) { html += `<div class="cap2">${ALIYA[va - 1]}</div>`; lastA = va; }
      if (V[0] !== lastC) { html += `<p class="chap">פרק ${C.heNum(V[0])}</p>`; lastC = V[0]; }
      html += verseHtml(V, mark);
    }
    $('#smvBody').innerHTML = html;
    $('#smvFoot').classList.toggle('hide', !R.al);
    if (R.al) { $('#smvDone').textContent = done[R.al - 1] ? 'ביטול הסימון של ' + ALIYA[R.al - 1] : 'סיימתי את ' + ALIYA[R.al - 1]; $('#smvNext').classList.toggle('hide', R.al >= 7); if (R.al < 7) $('#smvNext').textContent = 'ל' + ALIYA[R.al]; }
    $('#smvAll').setAttribute('aria-pressed', String(R.allOpen));
    const on = $('#smvAl .on'); if (on) { const st = $('#smvAl'); st.scrollLeft += on.getBoundingClientRect().left + on.offsetWidth / 2 - (st.getBoundingClientRect().left + st.clientWidth / 2); }
  }
  function keepPlace(fn) { const top = window.scrollY; fn(); window.scrollTo(0, top); }
  function toggleSup(k, ri, w) {
    const sk = supKey(k, ri, w), idx = R.idx, ck = w + '|' + idx;
    if (supState[sk]) { delete supState[sk]; return keepPlace(drawSmv); }
    supState[sk] = true; R.open[k] = true; if (supCache[ck]) return keepPlace(drawSmv);
    delete supCache[ck]; keepPlace(drawSmv);
    getJ('smv/' + w + two(idx) + '.json').then(j => { supCache[ck] = j; }, () => { supCache[ck] = null; }).then(() => { if (R.idx === idx) keepPlace(drawSmv); });
  }
  function showRashi(art, k, ri) {
    const box = art.querySelector('.rashi'), btn = art.querySelector('.rbtn'); if (!box) return;
    if (AS.on && !AS.paused) asPause(true);                                  /* stopping to study Rashi */
    box.hidden = false; btn.setAttribute('aria-expanded', 'true'); R.open[k] = true; let target = null;
    box.querySelectorAll('.rc').forEach((c, i) => { c.classList.toggle('hit', i === ri); if (i === ri) target = c; });
    art.querySelectorAll('.rw').forEach(w => w.classList.toggle('on', ri >= 0 && +w.dataset.r === ri));
    R.hit = ri >= 0 ? k + '#' + ri : null; (target || box).scrollIntoView({ block: 'nearest' });
  }
  $('#smvBody').onclick = e => {
    const t = e.target; if (t.id === 'smvRetry') return pickParsha(R.idx, R.al);
    const art = t.closest('.pv'); if (!art) return; const k = art.dataset.k;
    const sup = t.closest('.sup .c'); if (sup) return toggleSup(k, +sup.dataset.ri, sup.dataset.w);
    const rw = t.closest('.rw'); if (rw) return showRashi(art, k, +rw.dataset.r);
    if (t.closest('.rbtn')) { const box = art.querySelector('.rashi'); if (box.hidden) return showRashi(art, k, -1); box.hidden = true; t.closest('.rbtn').setAttribute('aria-expanded', 'false'); delete R.open[k]; return; }
    if (t.closest('.mbtn')) { const [c, v] = k.split(':').map(Number); mem.mark = mem.mark && mem.mark.idx === R.idx && mem.mark.c === c && mem.mark.v === v ? null : { idx: R.idx, c, v }; saveMem(); keepPlace(drawSmv); }
  };
  $('#smvAl').onclick = e => { const b = e.target.closest('button'); if (!b) return; R.al = +b.dataset.al; drawSmv(); window.scrollTo(0, 0); };
  $('#smvSel').onchange = e => pickParsha(+e.target.value, 0);
  $('#smvWeek').onclick = e => { const b = e.target.closest('[data-go]'); if (b) pickParsha(+b.dataset.go, 0); };
  $('#smvResume').onclick = () => { if (!mem.mark || !R.data) return; R.al = aliyahOf(R.data, mem.mark.c, mem.mark.v); drawSmv(); const a = $('#smvBody .marked'); if (a) { a.scrollIntoView({ block: 'start' }); window.scrollBy(0, -110); } };
  $('#smvAll').onclick = () => { R.allOpen = !R.allOpen; if (!R.allOpen) R.open = {}; drawSmv(); };
  $('#smvDone').onclick = () => { const key = weekKey(R.idx), d = doneList(R.idx).slice(), week = '@' + C.shabbatOf(todayNum()); d[R.al - 1] = !d[R.al - 1];
    for (const k of Object.keys(mem.done)) if (!k.endsWith(week)) delete mem.done[k];        /* progress is per week */
    mem.done[key] = d; saveMem(); drawSmv(); };
  $('#smvNext').onclick = () => { if (R.al < 7) { R.al++; drawSmv(); window.scrollTo(0, 0); } };

  /* automatic scrolling, and study mode (only the text, screen kept awake) */
  const AS = { on: false, paused: false, last: 0, carry: 0, speed: 4, raf: 0 }, RATES = [0, 8, 12, 17, 23, 30, 38, 48, 60, 75, 95];
  let wake = null;
  function syncAwake() { const want = (AS.on && !AS.paused) || $('#smv').classList.contains('study');
    if (want && !wake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => { });
    if (!want && wake) { wake.release().catch(() => { }); wake = null; } }
  function asPaint() { $('#asBar').classList.toggle('hide', !AS.on); $('#asPause').textContent = AS.paused ? 'המשך' : 'עצירה'; $('#asSpeed').textContent = 'מהירות ' + AS.speed; $('#smvAuto').setAttribute('aria-pressed', String(AS.on)); }
  function asFrame(ts) {
    if (!AS.on) return;
    if (!AS.paused) { const dt = AS.last ? Math.min(120, ts - AS.last) : 16; AS.carry += RATES[AS.speed] * dt / 1000; const px = Math.floor(AS.carry);
      if (px >= 1) { AS.carry -= px; const se = document.scrollingElement || document.documentElement, before = se.scrollTop; se.scrollTop = before + px; if (se.scrollTop === before) { AS.paused = true; asPaint(); syncAwake(); } } }
    AS.last = AS.paused ? 0 : ts; AS.raf = requestAnimationFrame(asFrame);
  }
  function asStart() { if (AS.on) return; AS.on = true; AS.paused = false; AS.last = 0; AS.carry = 0; AS.speed = Math.max(1, Math.min(10, +mem.scroll || 4)); asPaint(); syncAwake(); AS.raf = requestAnimationFrame(asFrame); }
  function asStop() { AS.on = false; AS.paused = false; if (AS.raf) cancelAnimationFrame(AS.raf); AS.raf = 0; asPaint(); syncAwake(); }
  function asPause(p) { if (!AS.on) return; AS.paused = p === undefined ? !AS.paused : p; AS.last = 0; asPaint(); syncAwake(); }
  $('#smvAuto').onclick = () => AS.on ? asStop() : asStart();
  $('#asPause').onclick = () => asPause(); $('#asStop').onclick = asStop;
  $('#asSlow').onclick = () => { AS.speed = Math.max(1, AS.speed - 1); mem.scroll = AS.speed; saveMem(); asPaint(); };
  $('#asFast').onclick = () => { AS.speed = Math.min(10, AS.speed + 1); mem.scroll = AS.speed; saveMem(); asPaint(); };
  $('#smvStudy').onclick = () => { const on = $('#smv').classList.toggle('study'); $('#smvStudy').setAttribute('aria-pressed', String(on)); syncAwake(); };

  window.Luach = { openCal, drawCal, openSmv, drawSmv, todayCount, weekly, todayNum, leave() { asStop(); $('#smv').classList.remove('study'); $('#smvStudy').setAttribute('aria-pressed', 'false'); syncAwake(); }, yzReady };
})();
