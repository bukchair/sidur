/* app.js - screens of the siddur. WHAT is shown (menus by date, the "which day" question, every page,
   zmanim) comes from the original app's own logic through SidurEngine; this file only draws it. */
'use strict';
const $ = s => document.querySelector(s), root = document.documentElement;
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('sd_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('sd_' + k, JSON.stringify(v)); } catch (e) { } }
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- settings (the original's own, plus display) ---------------- */
const cfg = Object.assign({
  city: 34, censor: 1, vaanenu: 0, doctor: 0, doctorNames: '', purimDay: 1, dst: 'auto', specialText: 'red', koteretText: 'blue',
  theme: 'light', font: 'Ezra', size: 22, align: 'justify', com: 0, autoDnd: 0, autoHide: 1, smvTaamim: 1, smvTargum: 1, smvTwice: 0, smvRashiFont: 0, splashOn: 1, splashMs: 1500, autoLoc: 0
}, store.get('cfg', {}));
if (cfg.com === 'on' || cfg.com === 'off') cfg.com = cfg.com === 'on' ? 1 : 0;
if (!store.get('printLook', 0)) { cfg.font = 'Frank'; store.set('printLook', 1); }
let ENG = null, CITIES = [];
/* the clock; tests and demos can pin it with window.__sidurNow = '2026-12-06T18:30:00' */
const NOW = () => window.__sidurNow ? new Date(window.__sidurNow) : new Date();
const deviceInDst = d => { const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset(), jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset(); return jan !== jul && d.getTimezoneOffset() < Math.max(jan, jul); };
const engineSettings = now => ({
  city: cityIndex(), purimDay: cfg.purimDay, censor: cfg.censor ? 1 : 0, vaanenu: cfg.vaanenu ? 1 : 0, doctor: cfg.doctor ? 1 : 0, doctorNames: cfg.doctorNames,
  summerTime: cfg.dst === 'on' || (cfg.dst === 'auto' && deviceInDst(now)) ? 1 : 0, specialText: cfg.specialText, koteretText: cfg.koteretText, night: cfg.theme === 'dark' ? 1 : 0
});
/* ---------------- the place: the city chosen in the settings, or the device's own location ----------------
   With "by my location" on, the device says where it is. Within 3 km of a city of the list, that city is simply chosen.
   Farther, the times are calculated for the exact spot by the original's own calculation; what a spot does not tell
   (time zone, Israel or abroad, height, minutes of candle lighting) is taken from the listed city nearby (up to 40 km),
   or from the device's clock and the original's defaults when no listed city is near. The location never leaves the device. */
let LIVE = store.get('loc', null), liveSel = null, locErr = 0, locAsked = 0;
const toDeg = a => (a[0] + a[1] / 60 + a[2] / 3600) * (a[3] ? -1 : 1);
const toDms = v => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60); return [d, m, Math.min(s, 59), v < 0 ? 1 : 0]; };
const kmApart = (la, lo, lb, lob) => { const r = Math.PI / 180, x = (lob - lo) * r * Math.cos((la + lb) / 2 * r), y = (lb - la) * r; return Math.sqrt(x * x + y * y) * 6371; };
const cityIndex = () => (liveSel ? liveSel.idx : cfg.city);
const place = () => (liveSel ? liveSel.city : CITIES[cfg.city]) || {};
function applyLive() {
  liveSel = null; if (!cfg.autoLoc || !LIVE || !ENG || !CITIES.length) return;
  let best = 0, bd = Infinity;
  CITIES.forEach((c, i) => { const d = kmApart(LIVE.lat, LIVE.lon, toDeg(c.latitude), toDeg(c.longitude)); if (d < bd) { bd = d; best = i; } });
  const n = CITIES[best];
  if (bd <= 3) { liveSel = { idx: best, city: n, near: n, km: bd, exact: false, close: true }; return; }
  const close = bd <= 40, inIL = LIVE.lat > 29.4 && LIVE.lat < 33.4 && LIVE.lon > 34.2 && LIVE.lon < 35.95, y = NOW().getFullYear();
  const std = -Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset()) / 60;      /* the device's zone without summer time */
  const city = { innerId: close ? n.innerId : 0, name: close ? 'ליד ' + n.name : 'המיקום שלך', latitude: toDms(LIVE.lat), longitude: toDms(LIVE.lon),
    gmtOffset: close ? n.gmtOffset : std, isInIsrael: close ? n.isInIsrael : (inIL ? 1 : 0), elevation: close ? n.elevation : 0, shabbatTime: close ? n.shabbatTime : (inIL ? 21 : 18) };
  ENG.setCity(CITIES.length, city); liveSel = { idx: CITIES.length, city, near: n, km: bd, exact: true, close };
}
function drawLocNote() {
  const t = !cfg.autoLoc ? 'העיר קובעת את זמני היום, את הלוח ואת מנהג ארץ ישראל או חוץ לארץ, בכל המסכים.'
    : !liveSel ? (locErr === 1 ? 'אין אישור לגשת למיקום, ולכן הזמנים לפי העיר שנבחרה. אפשר לאשר בהגדרות המכשיר.' : locErr ? 'המכשיר לא מסר מיקום. הזמנים לפי העיר שנבחרה.' : 'מחפש את המיקום. בינתיים הזמנים לפי העיר שנבחרה.')
    : !liveSel.exact ? `המיקום זוהה: ${liveSel.near.name}.`
    : liveSel.close ? `המיקום זוהה: כ-${Math.round(liveSel.km)} ק"מ מ${liveSel.near.name}. הזמנים מחושבים למקום שלך, והדלקת הנרות והמנהג לפי ${liveSel.near.name.split(',')[0]}.`
    : 'המיקום זוהה, ואין ברשימה עיר קרובה אליו. הזמנים מחושבים למקום שלך, לפי שעון המכשיר.';
  document.querySelectorAll('.locnote').forEach(el => { el.textContent = t; });
}
/* asks the device, at most once in ten minutes; a move of more than a kilometre recalculates everything */
function locate(force) {
  if (!cfg.autoLoc || !navigator.geolocation || (!force && Date.now() - locAsked < 600000)) return;
  locAsked = Date.now();
  navigator.geolocation.getCurrentPosition(p => {
    const lat = p.coords.latitude, lon = p.coords.longitude, moved = !LIVE || kmApart(LIVE.lat, LIVE.lon, lat, lon) > 1;
    locErr = 0; if (moved) { LIVE = { lat, lon, at: Date.now() }; store.set('loc', LIVE); }
    if (moved || !liveSel) { applyLive(); if (ENG) redraw(); if (window.SidurExtras) SidurExtras.plan(); }
    drawLocNote();
  }, e => { locErr = (e && e.code) || 2; drawLocNote(); }, { maximumAge: 600000, timeout: 20000 });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) locate(); });
/* re-evaluate the day exactly as the original does whenever a screen opens */
function sync(at) { const now = at || NOW(); ENG.configure(engineSettings(now)); ENG.setNow(now); return ENG.refresh(); }

/* One binding for every control of the settings sheet: <select data-cfg>, <button role="switch" data-cfg>, <input data-cfg>.
   A setting is stored once and every screen reads it from here. */
const NUMERIC = { city: 1, purimDay: 1, size: 1 };
function applyCfg() {
  root.dataset.theme = cfg.theme; root.dataset.align = cfg.align; root.dataset.loc = cfg.autoLoc ? 'on' : 'off'; root.dataset.font = cfg.font; root.dataset.com = cfg.com ? 'on' : 'off';
  root.style.setProperty('--body', `'${cfg.font}'`);
  root.style.setProperty('--fs', cfg.size + 'px');
  $('#comBtn').setAttribute('aria-pressed', String(!!cfg.com));
  const tc = getComputedStyle(root).getPropertyValue('--velvet').trim();
  document.querySelector('meta[name=theme-color]').content = tc || '#111c6e';
  document.querySelectorAll('[data-cfg]').forEach(el => {
    const k = el.dataset.cfg, v = cfg[k];
    if (el.getAttribute('role') === 'switch') return el.setAttribute('aria-checked', String(!!v));
    if (el.classList.contains('segc')) return el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
    if (el.tagName !== 'SELECT') { if (el.value !== String(v == null ? '' : v)) el.value = v == null ? '' : v; return; }
    if (!el.options.length) return; el.value = String(v);
    if (el.value !== String(v)) {                      /* a letter size set with the two "א" buttons, between the named sizes */
      let o = el.querySelector('option[data-custom]'); if (!o) { o = document.createElement('option'); o.dataset.custom = '1'; el.appendChild(o); }
      o.value = String(v); o.textContent = 'מותאם (' + v + ')'; el.value = String(v);
    }
  });
  $('#rowDoctor').classList.toggle('hide', !cfg.doctor);
  /* the sample on top of the settings: a line of instruction, a blessing, a special word, in the chosen colours */
  const tone = { red: 'var(--add)', blue: 'var(--ins)', green: 'var(--c-green)', purple: 'var(--c-purple)' };
  const sample = `<span class="pv-i" style="color:${tone[cfg.koteretText] || 'var(--ins)'}">ברכה ראשונה</span><span>בָּרוּךְ אַתָּה ${cfg.censor ? 'י‑הוה' : 'יהוה'} אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם</span><span class="pv-i" style="color:${tone[cfg.specialText] || 'var(--add)'}">מַשִּׁיב הָרוּחַ וּמוֹרִיד הַגֶּשֶׁם</span>`;
  document.querySelectorAll('.previewbox').forEach(b => { b.innerHTML = sample; });
  store.set('cfg', cfg);
}
document.addEventListener('click', e => {
  if (!e.target.closest('[data-night]')) return;
  if (cfg.theme === 'dark') cfg.theme = cfg.dayTheme || 'light'; else { cfg.dayTheme = cfg.theme; cfg.theme = 'dark'; }
  changed();
});
function changed() { applyCfg(); applyLive(); drawLocNote(); if (ENG) redraw(); }
/* the settings sheet, and the new user's kit, which holds a few of the same controls */
[$('#sheet'), $('#sheetKit')].forEach(sh => {
  sh.addEventListener('change', e => {
    const el = e.target.closest('select[data-cfg],input[data-cfg]'); if (!el) return; const k = el.dataset.cfg;
    cfg[k] = NUMERIC[k] ? +el.value : el.value.trim(); changed(); if (window.SidurExtras) SidurExtras.onSetting(k);
  });
  sh.addEventListener('input', e => { const el = e.target.closest('input[type="range"][data-cfg]'); if (el) { cfg[el.dataset.cfg] = +el.value; applyCfg(); } });
  sh.addEventListener('click', e => {
    const sb = e.target.closest('.segc[data-cfg] button'); if (sb) { const k = sb.parentNode.dataset.cfg; cfg[k] = NUMERIC[k] ? +sb.dataset.v : sb.dataset.v; changed(); if (window.SidurExtras) SidurExtras.onSetting(k); return; }
    const el = e.target.closest('[role="switch"][data-cfg]'); if (!el) return; cfg[el.dataset.cfg] = cfg[el.dataset.cfg] ? 0 : 1; changed(); if (window.SidurExtras) SidurExtras.onSetting(el.dataset.cfg);
    if (el.dataset.cfg === 'autoLoc') locate(true); });
});
/* An open sheet is one step of the history, so the device's back key closes the sheet and stays in the app.
     Closing it any other way takes that step back out, unless the same action went on to another screen
     (nav() then takes the sheet's place in the history). */
let _skipPop = 0;
const hideSheet = id => { $('#scrim' + id).classList.remove('show'); $('#sheet' + id).classList.remove('show'); };
const openSheet = id => {
  const sh = $('#sheet' + id); if (sh.classList.contains('show')) return;
  $('#scrim' + id).classList.add('show'); sh.classList.add('show');
  const st = Object.assign({ view: curView }, history.state, { sheet: id });
  if (history.state && history.state.sheet !== undefined) history.replaceState(st, ''); else history.pushState(st, '');
};
const closeSheet = id => {
  if (!$('#sheet' + id).classList.contains('show')) return; hideSheet(id);
  setTimeout(() => { if (history.state && history.state.sheet === id && !document.querySelector('.sheet.show')) { _skipPop++; history.back(); } }, 0);
};
$('#scrim').onclick = () => closeSheet('');
$('#setDone').onclick = () => closeSheet('');
/* A sheet can be pulled down by its head. It follows the finger one to one; on release it leaves or returns
   according to where the movement was heading (the release speed is projected forward), not only where it stopped. */
(function () {
  let sh = null, y0 = 0, dy = 0, hist = [];
  const closeOf = el => el.id === 'sheetCom' ? $('#comClose').click() : closeSheet(el.id.slice(5));
  document.addEventListener('pointerdown', e => {
    const head = e.target.closest('.sheethd,.findbar,.comhd'); if (!head || e.target.closest('button,input,select')) return;
    const el = head.closest('.sheet.show'); if (!el) return;
    sh = el; y0 = e.clientY; dy = 0; hist = [[e.timeStamp, 0]]; el.style.transition = 'none';
  });
  document.addEventListener('pointermove', e => {
    if (!sh) return; dy = e.clientY - y0;
    sh.style.transform = 'translateY(' + (dy > 0 ? dy : dy * 0.2) + 'px)';              /* upward it only gives a little */
    hist.push([e.timeStamp, dy]); if (hist.length > 6) hist.shift();
  });
  const end = () => {
    if (!sh) return; const el = sh; sh = null;
    const a = hist[0], b = hist[hist.length - 1], v = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) * 1000 : 0;   /* px per second */
    const heading = dy + v * 0.499;                                                    /* (v/1000) * d / (1 - d), d = 0.998 */
    el.style.transition = ''; el.style.transform = '';
    if (dy > 12 && heading > el.offsetHeight * 0.45) closeOf(el);
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
})();

/* ---------------- view routing ---------------- */
const VIEWS = ['home', 'listview', 'reader', 'luach', 'cal', 'smv', 'chok', 'rem', 'about', 'guide', 'compass', 'library', 'libread', 'libsave'];
let curView = 'home';
function show(view) {
  if (curView === 'smv' && view !== 'smv' && window.Luach) Luach.leave();      /* stops the automatic scrolling of the chumash */
  if (window.SidurExtras) SidurExtras.onView(curView, view);            /* the original's "do not disturb me while praying" */
  curView = view; document.body.classList.remove('hdoff'); _lastY = 0;
  VIEWS.forEach(v => $('#' + v).classList.toggle('show', v === view));
  const deep = ((history.state && history.state.depth) || 0) > 1;      /* the shortcut home appears from the second level down */
  document.querySelectorAll('[data-home]').forEach(b => b.classList.toggle('hide', !deep));
  window.scrollTo(0, 0);
}
function nav(view, state) {
  const st = Object.assign({ view }, state || {});
  if (history.state && history.state.sheet !== undefined) history.replaceState(st, ''); else history.pushState(st, '');
  show(view);
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) return history.back();
  if (e.target.closest('[data-settings]')) return openSheet('');
  const fsb = e.target.closest('[data-fs]'); if (fsb) { cfg.size = Math.max(14, Math.min(52, cfg.size + +fsb.dataset.fs)); return applyCfg(); }
  if (e.target.closest('[data-home]')) { const n = (history.state && history.state.depth) || 0; if (n > 0) history.go(-n); else { show('home'); renderHome(); } }
});
window.onpopstate = e => {
  if (_skipPop) { _skipPop--; return; }                       /* a sheet was closed on the screen: nothing else moves */
  const open = [...document.querySelectorAll('.sheet.show')];
  open.forEach(el => hideSheet(el.id.slice(5)));
  if (e.state && e.state.sheet !== undefined) return history.back();   /* a step left behind by a sheet that is gone */
  if (open.length) return;                                    /* the back key with a sheet open: the sheet closes, the screen stays */
  const st = e.state || { view: 'home' };
  if (st.view === 'listview') { menus.length = (st.mi | 0) + 1; renderMenu(); }
  if ((st.view === 'home' || !st.view) && ENG) renderHome();
  if (st.view === 'cal' && window.Luach) Luach.drawCal();
  if (st.view === 'smv' && window.Luach) Luach.drawSmv();
  if (st.view === 'chok' && window.SidurExtras) SidurExtras.drawChok();
  if (st.view === 'rem' && window.SidurExtras) SidurExtras.drawRem();
  if (st.view === 'compass' && window.SidurCompass) return SidurCompass.open(true);
  if (st.view === 'library' && window.SidurLib) return SidurLib.open(true);
  show(st.view || 'home');
};
/* The device's back key, asked by the Android shell: the page itself knows whether there is a step to go back.
   True = the app went a step back (a sheet closed, or the screen before); false = this is the home page, and the shell
   puts the app aside. A sheet that is open without a step of its own in the history is simply closed. */
window.SidurBack = () => {
  /* the two small dialogs (the synagogue, the question near sunset) are not steps of their own: back closes them */
  if ($('#shulbox').classList.contains('show')) { closeShul(); return true; }
  if ($('#askbox').classList.contains('show')) { $('#scrimAsk').classList.remove('show'); $('#askbox').classList.remove('show'); return true; }
  if (window.SidurLib && SidurLib.back()) return true;   /* inside the bookcase: the tray, the volume, the shelf, one at a time */
  const st = history.state || {}, open = [...document.querySelectorAll('.sheet.show')];
  if (open.length && st.sheet === undefined) { open.forEach(el => hideSheet(el.id.slice(5))); return true; }
  if (open.length || st.sheet !== undefined || st.depth || curView !== 'home') { history.back(); return true; }
  return false;
};
const depth = () => ((history.state && history.state.depth) || 0) + 1;

/* ---------------- the day, as the original states it ---------------- */
const DATE_LINE = /^(אור ל)?[א-ל]["'׳״]?[א-ט]?["'׳״]? ב[א-ת]/;          /* "ב' במרחשוון"; after sunset the original writes "אור לג' במרחשוון" */
function dayInfo(st) {
  const text = st.zmanimHtml.replace(/<\/h\d>|<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const ti = lines.findIndex(l => l.startsWith('לוח תחנון:'));
  /* on a hilula of the rebbes the original prints its own line between the date and "לוח תחנון" */
  let di = ti - 1; while (di > 0 && !DATE_LINE.test(lines[di])) di--;
  const info = { date: ti > 0 ? lines[di] : '', hilula: ti > 0 ? lines.slice(di + 1, ti) : [], tachanun: ti >= 0 ? lines[ti].slice(10).trim() : '',
    daf: '', notes: [], times: [], warn: di > 1 ? lines.slice(1, di) : [], title: lines[0] || '' };
  for (const l of lines.slice(ti + 1)) { const m = l.match(/^(.+): (\d{1,2}):(\d\d)$/);
    if (m) info.times.push({ name: m[1], min: +m[2] * 60 + +m[3], text: m[2] + ':' + m[3] });
    else if (l.startsWith('דף יומי:')) info.daf = l.slice(8).trim();
    else if (!info.times.length) info.notes.push(l); }
  return info;
}
/* the times still ahead today, in the order of the clock. On Friday the original's list also carries the end of
   Shabbat, which belongs to tomorrow night. */
function upcoming(info, at) {
  const nowMin = at.getHours() * 60 + at.getMinutes(), fri = at.getDay() === 5;
  return info.times.filter(z => z.min >= nowMin && !(fri && z.name.startsWith('מוצ'))).sort((a, b) => a.min - b.min);
}
const DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת קודש'];
function hebYear(d) { try { return HebCal.fromGregorian(d.getFullYear(), d.getMonth() + 1, d.getDate()).full.split(' ').pop(); } catch (e) { return ''; } }
function relTime(min, now) {
  const d = min - (now.getHours() * 60 + now.getMinutes());
  if (d < 0) return ''; if (d < 1) return 'עכשיו';
  const h = Math.floor(d / 60), m = Math.round(d % 60);
  return 'בעוד ' + (h ? h + " שע' " : '') + (m ? m + " דק'" : '');
}
/* the weekly reading: one table for the whole app (CalCore), the same one the calendar and the chumash use */
/* The coming Shabbat, in the times the original gives for its Friday: candle lighting and the end of Shabbat.
   On Shabbat itself it is the Shabbat we are in, until it is out. */
function shabbatTimes(now) {
  const at = k => new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, 12), wd = now.getDay();
  let res = null;
  try {
    let fri = dayInfo(sync(at(wd === 6 ? -1 : (5 - wd + 7) % 7)));
    const t = (i, n) => i.times.find(z => z.name === n);
    if (wd === 6) { const out = t(fri, 'מוצ"ש'); if (!out || now.getHours() * 60 + now.getMinutes() > out.min) fri = dayInfo(sync(at(6))); }
    const light = t(fri, 'הדלקת נרות'), out = t(fri, 'מוצ"ש'), rt = t(fri, 'מוצ"ש (רבינו תם)');
    if (light && out) res = { light: light.text, out: out.text, rt: rt ? rt.text : '' };
  } catch (e) { }
  sync(now);
  return res;
}
function parshaName(d) {
  const C = window.CalCore; if (!C) return '';
  const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / C.DAY_MS);
  const p = C.parshaOn(C.shabbatOf(n), !!place().isInIsrael);
  return p ? 'פרשת ' + p : 'שבת מועד';
}

/* ---------------- home ---------------- */
const TOC = [
  ['תפריט תפילות', 'menu:showTfilaMenu', 'tfila'], ['ספר תהילים', 'menu:showTehilimTypeMenu', 'teh'],
  ['חומש - שניים מקרא', '#smv', 'chumash'], ['חוק לישראל', '#chok', 'chok']
];                                                    /* the books; the tools are the buttons under the day panel */
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
function renderToc(x) {
  x = x || {};
  $('#mainlist').innerHTML = TOC.map(([label, target, k], i) =>
    `<li><button class="row${i ? '' : ' first'}" data-go="${target}" data-label="${esc(label)}"><span class="t">${esc(label)}</span><i class="ld"></i><span class="x">${esc(x[k] || '')}</span><i class="go"></i></button></li>`).join('');
}
$('#mainlist').onclick = e => { const t = e.target.closest('.row'); if (t) go(t.dataset.go, t.dataset.label); };
$('#colophon').onclick = $('#tiles').onclick = e => { const t = e.target.closest('button'); if (t) go(t.dataset.go, t.dataset.label); };
$('#plate').onclick = e => { if (e.target.closest('[data-night]')) return; if (e.target.closest('#dLoc')) return openSheet(''); if (ENG) openLuach(); };
/* "said now": only a pointer by the hour of the day. The buttons themselves, and what opens, are the original's. */
function nowPair(info, nowMin) {
  const t = n => { const z = info.times.find(z => z.name.startsWith(n)); return z ? z.min : null; };
  const alot = t('עלות'), netz = t('הנץ'), hatzot = t('חצות'), shkia = t('שקיעה'), tzet = t('צאה');
  if ([alot, netz, hatzot, shkia, tzet].some(v => v === null)) return [];
  if (nowMin < alot) return ['קריאת שמע שעל המיטה', 'ערבית'];
  if (nowMin < netz) return ['השכמת הבוקר', 'שחרית'];
  if (nowMin < hatzot) return ['שחרית', 'השכמת הבוקר'];
  if (nowMin < shkia) return ['מנחה', 'ברכת המזון'];
  if (nowMin < tzet) return ['ערבית', 'מנחה'];
  return ['ערבית', 'קריאת שמע שעל המיטה'];
}
const tfilaButton = (menu, name) => menu.buttons.find(b => b.visible && b.text && b.text.startsWith(name));
function clickButton(b) {
  const r = ENG.click(b);
  if (r.menu) return pushMenu(r.menu);
  if (r.dialog) return ask(r.dialog);
  if (r.pages.length) return openPage(r.pages[0]);
}
$('#nowBox').onclick = e => {
  const t = e.target.closest('.nbtn'); if (!t) return; sync();
  const b = tfilaButton(ENG.menu('showTfilaMenu'), t.dataset.name); if (b) clickButton(b);
};
const WIDE = matchMedia('(min-width:900px)');
function renderHome() {
  const now = NOW(); const st = sync(now), info = dayInfo(st);
  const eff = new Date(now); if (st.sunset) eff.setDate(eff.getDate() + 1);
  $('#dHeb').textContent = (st.sunset ? 'ליל ' : 'יום ') + DOW[eff.getDay()] + ', ' + info.date + ' ' + hebYear(eff);
  $('#dLoc').textContent = (place().name || '').split(',')[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pair = nowPair(info, nowMin), menu = ENG.menu('showTfilaMenu');
  const said = pair.map(n => tfilaButton(menu, n)).filter(Boolean);
  /* the two stand in the order of the day, from right to left; the one of this hour is the filled one */
  const seq = n => { const k = DAYSEQ.indexOf(n); return k < 0 ? DAYSEQ.length : k; };
  const two = said.map((b, i) => ({ b, pri: !i, name: pair.find(n => b.text.startsWith(n)) })).sort((a, b) => seq(a.name) - seq(b.name));
  $('#nowBox').classList.toggle('hide', !said.length);
  $('#nowBox').innerHTML = '<span class="cap">עכשיו אומרים</span>' + two.map(x =>
    `<button class="nbtn${x.pri ? ' pri' : ''}${x.b.text.length > 13 ? ' long' : ''}" data-name="${esc(x.name)}">${esc(x.b.text)}</button>`).join('');
  const nUp = WIDE.matches ? 8 : 3;                    /* a wide screen has room for more of the day's times */
  let up = upcoming(info, now).slice(0, nUp);
  if (up.length < 3) { const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1); const ti = dayInfo(sync(t)); up = up.concat(upcoming(ti, t).slice(0, 3 - up.length).map(z => Object.assign({ tomorrow: true }, z))); sync(now); }
  const n0 = up[0], greg = now.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#hlLine').textContent = n0 ? n0.name + ' ' + n0.text : 'סידור וחומש';
  $('#tmLine').textContent = greg + (n0 ? ' · ' + (n0.tomorrow ? 'מחר' : relTime(n0.min, now)) : '');
  const parsha = parshaName(eff), noYor = info.tachanun === 'אין יארצייט';
  const P = window.Luach ? Luach.todayPanel() : null;        /* the calendar's own facts of the day */
  /* The nearest time is said once, on top. Under the books, the small screen of the day: each card tells one thing in the
     original's own words or the calendar's, and a touch opens its full screen. A wide screen has room for more times. */
  const row = (a, b, o) => { o = o || {}; const tag = o.go ? 'button' : 'div';
    return `<${tag} class="r${o.big ? ' big' : ''}"${o.go ? ` data-go="${o.go}"` : ''}><span>${a}</span>${o.note ? `<small>${esc(o.note)}</small>` : ''}${b ? `<i class="ld"></i><b>${esc(b)}</b>` : ''}</${tag}>`; };
  const dayName = 'יום ' + DOW[eff.getDay()].replace(' קודש', ''), chokDone = window.SidurExtras && SidurExtras.chokToday();
  const cards = [{ k: 'cal', cap: 'היום · ' + info.date, go: '#cal', rows: info.hilula.map(h => row(`<em>${esc(h)}</em>`)).join('')
    + row('לוח תחנון: ' + (noYor ? esc(info.tachanun) : `<em>${esc(info.tachanun)}</em>`), '', { big: 1 })
    + (info.notes.length ? row(info.notes.map(esc).join(' · ')) : '')
    + (P ? row(`תהילים ליום ${esc(P.dayHe)} בחודש: ${esc(P.tehillim)}`, '', { go: 'menu:showTehilimTypeMenu' }) : '') }];
  if (up.length) cards.push({ k: 'sun', cap: 'הזמנים הקרובים', go: '#luach', rows: up.map((z, i) =>
    row(esc(z.name) + (z.tomorrow ? ' (מחר)' : ''), z.text, { big: !i, note: !i && !z.tomorrow ? relTime(z.min, now) : '' })).join('') });
  const sh = shabbatTimes(now);
  if (sh) cards.push({ k: 'flame', cap: 'שבת קודש · ' + parsha, go: '#cal', rows: row('הדלקת נרות', sh.light, { big: 1 }) + row('מוצאי שבת', sh.out) + (sh.rt ? row('רבינו תם', sh.rt) : '') });
  cards.push({ k: 'book', cap: 'הלימוד של היום', rows: row('דף יומי', info.daf) + row('חוק לישראל', dayName + (chokDone ? ' ✓' : ''), { go: '#chok' }) + row('שניים מקרא', parsha, { go: '#smv' }) });
  if (P && P.yzCount) cards.push({ k: 'star', cap: `יארצייט היום · ${P.yzCount} ברשימה הכללית`, go: '#cal', rows: P.yz.map(t => row(esc(t))).join('') });
  if (P) cards.push({ k: 'moon', cap: 'חודש ' + P.month, go: '#cal', rows: row('מולד', P.molad) + row('קידוש לבנה', P.kl) + row(esc(P.rc.label), P.rc.text, { note: inDays(P.rc.in) }) });
  drawRot(cards);
  renderToc({ tfila: 'לפי סדר היום', teh: 'ק"נ מזמורים', chumash: parsha, chok: dayName + (chokDone ? ' ✓' : '') });
  $('#infoBar').innerHTML = '';
}
const inDays = n => n <= 0 ? 'היום' : n === 1 ? 'מחר' : n <= 10 ? `בעוד ${n} ימים` : `בעוד ${n} יום`;

/* ---------------- the small screen of the day ---------------- */
const ROT_ICON = {
  cal: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  sun: '<path d="M3 18.5h18M6.5 18.5a5.5 5.5 0 0 1 11 0M12 6.5V9M5.3 9.7 7 11.4M18.7 9.7 17 11.4"/>',
  flame: '<path d="M12 3.5c.6 3-3.5 4.6-3.5 8.6a3.5 3.5 0 0 0 7 0c0-1.6-.8-2.5-1.4-3.6M8 20.5h8"/>',
  book: '<path d="M12 6.5C10 5.2 7.5 4.8 4.5 5v12.5c3-.2 5.5.2 7.5 1.5 2-1.3 4.5-1.7 7.5-1.5V5c-3-.2-5.5.2-7.5 1.5zM12 6.5V19"/>',
  star: '<path d="m12 4 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'
};
let rotAt = 0, rotHold = 0;
function drawRot(cards) {
  const el = $('#rot'); el.classList.toggle('hide', !cards.length); if (rotAt >= cards.length) rotAt = 0;
  el.innerHTML = cards.map((c, i) => `<div class="c${i === rotAt ? ' on' : ''}"${c.go ? ` data-go="${c.go}"` : ''}><span class="cap"><svg viewBox="0 0 24 24" aria-hidden="true">${ROT_ICON[c.k]}</svg>${esc(c.cap)}</span>${c.rows}</div>`).join('')
    + (cards.length > 1 ? `<span class="dots" role="button" tabindex="0" aria-label="הכרטיס הבא">${cards.map((c, i) => `<i class="${i === rotAt ? 'on' : ''}"></i>`).join('')}</span>` : '');
}
function rotShow(k) {
  const cs = document.querySelectorAll('#rot .c'), ds = document.querySelectorAll('#rot .dots i'); if (!cs.length) return;
  rotAt = ((k % cs.length) + cs.length) % cs.length;
  cs.forEach((c, i) => c.classList.toggle('on', i === rotAt)); ds.forEach((d, i) => d.classList.toggle('on', i === rotAt));
}
{ const el = $('#rot'); let x0 = null, swiped = false;
  el.addEventListener('pointerdown', e => { x0 = e.clientX; swiped = false; });
  el.addEventListener('pointercancel', () => { x0 = null; });
  /* the cards follow one another from right to left, so a pull to the right brings the next one */
  el.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) < 36) return; swiped = true; rotHold = 3; rotShow(rotAt + (dx > 0 ? 1 : -1)); });
  el.addEventListener('click', e => { if (swiped) { swiped = false; return; } rotHold = 3;
    if (e.target.closest('.dots')) return rotShow(rotAt + 1);
    const t = e.target.closest('[data-go]'); if (t) go(t.dataset.go); });
  el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.dots')) { e.preventDefault(); rotHold = 3; rotShow(rotAt + 1); } });
  /* It changes also on a device set to "remove animations" (the owner's phone is): the change of card is the point of the
     panel, and there the cards simply replace one another without the fade. */
  setInterval(() => { if (rotHold) return void rotHold--; if (!ENG || curView !== 'home' || document.hidden || document.querySelector('.sheet.show')) return; rotShow(rotAt + 1); }, 6500);
}

/* ---------------- sharing the siddur ---------------- */
const SHARE_URL = 'https://bukchair.github.io/sidur/', SHARE_NAME = 'סידור וחומש בית אהרן וישראל';
const SHARE_TEXT = SHARE_NAME + ', נוסח קרלין סטולין. חינם, בלי פרסומות, לכל מכשיר:';
function openShare() {
  $('#shareMsg').innerHTML = esc(SHARE_TEXT) + `<b>${esc(SHARE_URL.replace(/^https:\/\//, ''))}</b>`;
  $('#shareCopy span').textContent = 'העתקת הקישור'; openSheet('Share');
}
async function copyShare() {
  let ok = false;
  try { if (window.SidurNative && SidurNative.copy) { SidurNative.copy(SHARE_URL); ok = true; } else { await navigator.clipboard.writeText(SHARE_URL); ok = true; } }
  catch (e) { try { const t = document.createElement('textarea'); t.value = SHARE_URL; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e2) { } }
  $('#shareCopy span').textContent = ok ? 'הקישור הועתק' : 'לא הצלחתי להעתיק';
}
$('#shareCopy').onclick = copyShare;
/* the device's own "share" where there is one (the app, phones' browsers); elsewhere the link is copied */
$('#shareSend').onclick = async () => {
  try {
    if (window.SidurNative && SidurNative.share) return void SidurNative.share(SHARE_TEXT + '\n' + SHARE_URL);
    if (navigator.share) return void await navigator.share({ title: SHARE_NAME, text: SHARE_TEXT, url: SHARE_URL });
  } catch (e) { if (e && e.name === 'AbortError') return; }
  copyShare();
};
$('#scrimShare').onclick = $('#shareClose').onclick = () => closeSheet('Share');

const MORE_CREDITS = '<h4>חומש ולוח</h4><ul><li>מקרא עם טעמים ותרגום אונקלוס: נחלת הכלל (Public Domain), מתוך ספריא.</li>'
  + '<li>רש"י על התורה ושפתי חכמים: Metsudah Publications, 2009. רישיון CC-BY, מתוך ספריא.</li>'
  + '<li>גור אריה, מזרחי, ברטנורא על התורה, משכיל לדוד: נחלת הכלל, מתוך ספריא.</li>'
  + `<li>חק לישראל, מהדורת "תורת אמת" (www.toratemetfreeware.com). כל הזכויות שמורות לר' פנחס ראובן, לר' שגיב מחפוד ול-J. Alan Groves Center, בכפוף לתנאי רישיון CC BY-NC-SA 2.5 - אסור בשימוש מסחרי.</li>`
  + '<li>פרשת המן: הפסוקים והתפילות מנוסח הסידור; תרגום יונתן בן עוזיאל על התורה: מהדורת תורת אמת, נחלת הכלל (Public Domain), מתוך ספריא.</li>'
  + '<li>הספרייה (תנ"ך, תלמוד, משנה, מדרש, הלכה, חסידות, מוסר וקבלה): הטקסטים מתוך ספריא (Sefaria). לכל ספר המהדורה והרישיון שלו, והם מופיעים בתחתית כל דף בספרייה. ספרים ברישיון שאינו מסחרי מוצגים כאן כי הסידור ניתן בחינם.</li>'
  + '<li>צורת הדף בתלמוד: הספרייה daf-renderer, ברישיון MIT.</li>'
  + '<li>ציור ארון הספרים, כריכות העור וחוגת המצפן: נוצרו בעזרת Gemini של גוגל, בלי כיתוב ובלי סמלים.</li>'
  + '<li>אותיות הכותרות והתפריטים: Frank Ruhl Libre ו-Heebo, ברישיון SIL Open Font License 1.1.</li>'
  + '<li>רשימת יארצייט הצדיקים: רשימה כללית שנאספה מלוח יארצייט יומי. היא מוצגת לידיעה ואינה קובעת את נוסח התפילה.</li></ul>';
/* ---------------- menus: buttons and targets are the original's ---------------- */
const menus = [];
function go(target, label) {
  if (target === '#luach') return openLuach();
  if (target === '#settings') return openSheet('');
  if (target === '#shul') return openShul();
  if (target === '#cal') return Luach.openCal();
  if (target === '#smv') return Luach.openSmv();
  if (target === '#chok') return SidurExtras.openChok();
  if (target === '#rem') return SidurExtras.openRem();
  if (target === '#compass') return SidurCompass.open();
  if (target === '#library') return SidurLib.open();
  if (target === '#libsave') return SidurLib.openSave();
  if (target === '#find') return SidurExtras.openFind();
  if (target === '#share') return openShare();
  if (target === '#guide') return nav('guide', { depth: depth() });
  if (target === '#haman') return openHaman();
  if (target === '#about') { if (window.SidurCom) SidurCom.ready.then(() => { $('#abCredits').innerHTML = SidurCom.credits() + MORE_CREDITS; }); return nav('about', { depth: depth() }); }
  if (target.startsWith('url:')) { location.href = target.slice(4); return; }
  sync();
  if (target.startsWith('menu:')) return pushMenu(ENG.menu(target.slice(5)), target === 'menu:showTfilaMenu' ? 'tfila' : '');
  if (target.startsWith('page:')) return openPage({ file: target.slice(5), title: label, forceDay: 0 });
}
function pushMenu(menu, kind) { menus.push({ menu, kind: kind || '' }); nav('listview', { mi: menus.length - 1, depth: depth() }); renderMenu(); }
/* Every button the original shows is shown. In the prayers menu they are only arranged in two groups:
   the prayers of the day (and whatever the date adds), then the ones said at any hour. */
const ANYTIME = ['ברכת המזון', 'מעין שלוש', 'שבע ברכות', 'סדר ברית מילה', 'ברכות הנהנין', 'אשר יצר', 'תפילת הדרך', 'תפילות והוספות'];
const DAYSEQ = ['השכמת הבוקר', 'שחרית', 'מנחה', 'ערבית', 'קריאת שמע שעל המיטה'];
function renderMenu() {
  const e = menus[menus.length - 1]; if (!e) return; const m = e.menu;
  $('#listTitle').textContent = m.title;
  const items = m.buttons.map((b, i) => ({ b, i })).filter(x => x.b.visible && x.b.text);
  const row = (x, cls, note, n) => `<li class="${cls}"><button data-i="${x.i}">${n ? `<span class="n">${n}</span>` : ''}<span class="t">${esc(x.b.text)}</span>${note ? `<i class="ld"></i><span class="x">${note}</span>` : ''}<i class="go"></i></button></li>`;
  $('#listSub').classList.toggle('hide', e.kind !== 'tfila');
  if (!items.length) { $('#list').innerHTML = '<div class="empty">אין פריטים</div>'; return; }
  if (e.kind === 'tfila') {
    const now = NOW(), info = dayInfo(sync(now)), nowName = nowPair(info, now.getHours() * 60 + now.getMinutes())[0];
    $('#listSub').textContent = 'לפי סדר היום · ' + info.date;
    const any = items.filter(x => ANYTIME.includes(x.b.text)), day = items.filter(x => !ANYTIME.includes(x.b.text));
    $('#list').innerHTML = '<div class="mcap">לאורך היום</div><ol class="tl">' + day.map(x => {
      const isNow = nowName && x.b.text.startsWith(nowName), isDay = DAYSEQ.some(n => x.b.text.startsWith(n));
      return row(x, isNow ? 'is-now' : isDay ? '' : 'is-sp', isNow ? 'עכשיו' : isDay ? '' : 'לפי התאריך');
    }).join('') + '</ol>' + (any.length ? '<div class="mcap">בכל שעה</div><ol class="idx">' + any.map(x => row(x, '', '')).join('') + '</ol>' : '')
      + '<div class="mcap">מקרא ותרגום</div><ol class="tl one"><li><button data-go="#haman"><span class="t">פרשת המן</span><i class="ld"></i><span class="x">שניים מקרא ואחד תרגום</span><i class="go"></i></button></li></ol>';
    return;
  }
  const two = items.length > 8 && items.every(x => x.b.text.length <= 14);
  $('#list').innerHTML = `<ol class="tl${two ? ' two' : ''}">` + items.map(x => row(x, '', '')).join('') + '</ol>';
}
$('#list').onclick = e => {
  const g = e.target.closest('button[data-go]'); if (g) return go(g.dataset.go);
  const c = e.target.closest('button[data-i]'); if (!c) return; const m = menus[menus.length - 1].menu, b = m.buttons[+c.dataset.i];
  sync(); clickButton(b);
};
/* the original's question near sunset: "the day that passed or the day that entered?" */
function ask(n) {
  const d = ENG.dialog(n); $('#askText').textContent = d.text;
  $('#askBtns').innerHTML = d.buttons.map((t, i) => `<button data-a="${i}" class="${i ? 'main' : ''}">${esc(t)}</button>`).join('');
  $('#scrimAsk').classList.add('show'); $('#askbox').classList.add('show');
  const close = () => { $('#scrimAsk').classList.remove('show'); $('#askbox').classList.remove('show'); };
  $('#scrimAsk').onclick = close;
  $('#askBtns').onclick = e => { const a = e.target.dataset.a; if (a === undefined) return; close(); if (a === '0') return;
    const pages = ENG.answer(n, a === '1' ? 'next' : 'prev'); if (pages.length) openPage(pages[0]); };
}

/* ---------------- reader ---------------- */
let curPage = null;
/* the original hands this markup to an Android text view; these are the same rules that view applies */
function toWeb(h) {
  return h.split('<g<br>').join('')
    .replace(/<skip>\|\|(\d+)<\/skip>/g, '<a class="sk" id="sk$1"></a>')
    .replace(/<font color='#([0-9a-fA-F]+)'>/g, (m, x) => { const c = (parseInt(x, 16) & 0xffffff).toString(16).padStart(6, '0'); return `<span class="fc" data-c="${c}" style="--fc:#${c}">`; })
    .replace(/<\/font>/g, '</span>');
}
/* ---------------- the page, laid out as the printed siddur lays it out ----------------
   Works on the page as it already stands (after the commentary marked its phrases), and only moves nodes into boxes:
   no letter is added to the text or taken from it. A blank line ends a part; inside a part every line keeps its place. */
const bareHeb = s => s.replace(/[\u0591-\u05C7]/g, '');
const ACRONYM = /\s*\(([א-ת"]{3,5} [א-ת"]{3,5})\)\.?\s*$/;
function firstWord(box) {
  if (box.querySelector('.tg')) return;
  const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.parentNode.closest('.vs,.nt,small')) continue;
    const m = n.nodeValue.match(/^(\s*)(\S+)/); if (!m) continue;
    if (!/[\u05D0-\u05EA]/.test(m[2])) return;                 /* a part that opens with a bracket or a sign has no opening word */
    n.splitText(m[1].length + m[2].length); const word = m[1].length ? n.splitText(m[1].length) : n;
    const b = document.createElement('b'); b.className = 'iw'; word.parentNode.insertBefore(b, word); b.appendChild(word); return;
  }
}
/* a short note in brackets inside the text ("לנקבה: ...") is set small, as in print */
function smallNotes(box) {
  const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), list = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentNode.closest('.vs,small,.ins') && n.nodeValue.indexOf('(') >= 0) list.push(n);
  for (let n of list) for (;;) {
    const m = n.nodeValue.match(/\([^()]{2,58}[ :][^()]{1,58}\)/); if (!m) break;
    const mid = n.splitText(m.index), rest = mid.splitText(m[0].length);
    const s = document.createElement('span'); s.className = 'nt'; mid.parentNode.insertBefore(s, mid); s.appendChild(mid); n = rest;
  }
}
/* the print's three sizes of letter, from the hand-marked list (sizes.js); a run of "אנא בכח" lines takes the size of its first */
const letters = s => s.replace(/[^א-ת]/g, '');
function markSizes(boxes, file) {
  const R = window.SidurSizes && SidurSizes[file]; if (!R) return;
  const rules = R.map(r => { const [key, cond] = r.slice(2).split('@'); return { sz: r[0], key, cond }; });
  const fits = (r, head, above) => (r.key === '*' || (r.key[0] === '^' ? head.startsWith(r.key.slice(1)) : head.includes(r.key))) && (!r.cond || above.includes(r.cond));
  let carry = '', above = '';
  for (const el of boxes) {
    if (el.className === 'ins' || el.className === 'hd2') { above = letters(el.textContent); carry = ''; continue; }
    if (!/^(par|brk|acr|chap)$/.test(el.className)) { carry = ''; continue; }
    if (carry && el.className === 'acr') { if (carry !== 'l') el.classList.add('sz-' + carry); continue; }
    const head = letters(el.textContent).slice(0, 90), r = rules.find(r => fits(r, head, above)), sz = r ? r.sz : '';
    if (sz && sz !== 'l') el.classList.add('sz-' + sz);
    carry = el.classList.contains('acr') ? sz : '';
  }
}
const pointed = t => (t.match(/[\u05B0-\u05BC\u05C1\u05C2\u05C7]/g) || []).length > letters(t).length * 0.3;
function layPrinted(body, skips, file) {
  const titles = new Set((skips || []).map(s => bareHeb(s.title).replace(/\s*:\s*$/, '').trim()));
  const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const out = document.createDocumentFragment(); let lines = [[]], brs = 0;
  const flush = () => {
    const ls = lines.filter(l => l.length); lines = [[]]; if (!ls.length) return;
    let run = [], inAcr = false;
    const emit = () => { if (!run.length) return;
      if (!run.some(l => l.some(n => n.textContent.trim()))) { run.forEach(l => l.forEach(n => out.appendChild(n))); run = []; return; }   /* nothing to read: no box */
      const p = mk('p', 'par');
      run.forEach((l, i) => { if (i) p.appendChild(mk('br')); l.forEach(n => p.appendChild(n)); }); smallNotes(p); firstWord(p); out.appendChild(p); run = []; };
    for (const l of ls) {
      const text = l.map(n => n.textContent).join(''), b = bareHeb(text).trim(), last = l[l.length - 1];
      const a = last.nodeType === 3 ? last.nodeValue.match(ACRONYM) : null;
      if (a) { emit(); const p = mk('p', 'acr'), sp = mk('span'), sm = mk('small');
        const tail = last.splitText(a.index); l.forEach(n => sp.appendChild(n)); sm.appendChild(tail);
        if (!inAcr) firstWord(sp); p.appendChild(sp); p.appendChild(sm); out.appendChild(p); inAcr = true; continue; }
      inAcr = false;
      if (/^(פרק|מזמור) [א-ת"'׳״]{1,6}$/.test(b)) { emit(); const p = mk('p', 'chap'); l.forEach(n => p.appendChild(n)); out.appendChild(p); continue; }
      if (b.startsWith('ברוך אתה') && b.length < 105) { emit(); const p = mk('p', 'brk'); l.forEach(n => p.appendChild(n)); smallNotes(p); firstWord(p); out.appendChild(p); continue; }
      run.push(l);
    }
    emit();
  };
  for (const n of [...body.childNodes]) {
    const el = n.nodeType === 1 ? n : null;
    if (el && el.tagName === 'BR') { brs++; continue; }
    if (el && (el.classList.contains('sk') || el.classList.contains('com'))) { flush(); brs = 0; out.appendChild(el); continue; }
    /* an instruction of its own line(s): the original closes it with a line break inside its colour */
    /* (a coloured line that carries points is prayer text the original colours by the season, "ברכנו" in summer: it stays text) */
    if (el && el.classList.contains('fc') && el.lastChild && el.lastChild.nodeName === 'BR' && !pointed(el.textContent)) {
      flush(); brs = 0; el.removeChild(el.lastChild);
      const name = bareHeb(el.textContent).replace(/\s*:\s*$/, '').trim(), box = mk('div', titles.has(name) ? 'hd2' : 'ins');
      while (el.firstChild) box.appendChild(el.firstChild); out.appendChild(box); continue;
    }
    if (n.nodeType === 3 && !n.nodeValue.trim() && !lines[lines.length - 1].length) continue;
    if (brs >= 2) flush(); else if (brs === 1 && lines[lines.length - 1].length) lines.push([]);
    brs = 0; lines[lines.length - 1].push(n);
  }
  flush(); markSizes([...out.children], file); body.replaceChildren(out);
}
/* פרשת המן, שניים מקרא ואחד תרגום: the verses and the prayers before and after are the siddur's own ("תפילות והוספות"),
   the Targum is Targum Jonathan (haman.json, built by haman/build.mjs). Each verse twice, then its Targum. */
function openHaman() {
  const put = j => {
    const head = t => `<font color='#00000ff'>${esc(t)}<br></font><br>`;
    const html = '<skip>||1</skip>' + head('פרשת המן') + head('שניים מקרא ואחד תרגום') + esc(j.before) + '<br><br>'
      + '<skip>||2</skip>' + j.verses.map(v => `<small class="vn">${v.n}</small> ${esc(v.he)}<br>${esc(v.he)}<br><span class="tg">${esc(v.tg)}</span><br><br>`).join('')
      + '<skip>||3</skip>' + j.after.map(t => esc(t) + '<br><br>').join('');
    openPage({ file: 'haman', title: 'פרשת המן', html, skips: [{ title: 'פרשת המן', line: 1 }, { title: 'הפסוקים', line: 2 }, { title: 'אחרי הפרשה', line: 3 }] });
  };
  if (openHaman.j) return put(openHaman.j);
  fetch('haman.json').then(r => r.json()).then(j => { openHaman.j = j; put(j); }).catch(() => {});
}
function openPage(p) { curPage = p; nav('reader', { depth: depth() }); drawPage(); }
function drawPage() {
  if (!curPage) return; const pg = curPage.html ? { html: curPage.html, skips: curPage.skips || [] } : ENG.page(curPage.file, curPage.forceDay);
  $('#rtitle').textContent = curPage.title;
  const Com = window.SidurCom;
  $('#rbody').innerHTML = Com ? Com.markVerses(toWeb(pg.html)) : toWeb(pg.html);
  /* books that comment on this page: marked in the text, shown only when the reader turns "פירושים" on */
  $('#comBar').classList.toggle('hide', !(Com && Com.decorate($('#rbody'), curPage.file, pg.skips)));
  layPrinted($('#rbody'), pg.skips, curPage.file);
  drawComBar();
  if (Com && !Com.loaded && !drawPage.waiting) { drawPage.waiting = true; Com.ready.then(j => { if (j && curView === 'reader') drawPage(); }); }
  /* the original's jump list, as a strip that follows the reading */
  $('#steps').classList.toggle('hide', !pg.skips.length);
  /* the direction of prayer is a touch away while the page holds the Amidah */
  $('#rCompass').classList.toggle('hide', !pg.skips.some(s => /שמונה עשרה|עמידה|תפלת העמידה/.test(s.title)));
  $('#steps').innerHTML = '<div class="sr"><button data-sk="top" class="on">התחלה</button>' + pg.skips.map(s => `<button data-sk="${s.line}">${esc(s.title)}</button>`).join('') + '</div>';
}
$('#rCompass').onclick = () => go('#compass');
$('#comBtn').onclick = () => { cfg.com = cfg.com ? 0 : 1; applyCfg(); };
/* the strip beside the switch: the books that speak on this page. Choosing one leaves only its marks in the text,
   and "the next place" walks down the page from one of its comments to the next. */
function drawComBar() {
  const Com = window.SidurCom, list = Com ? Com.books() : [], sel = Com ? Com.sel : '';
  $('#comStrip').innerHTML = !list.length ? '' : `<button data-book="" aria-pressed="${!sel}">הכול</button>` + list.map(b =>
    `<button data-book="${b.id}" aria-pressed="${sel === b.id}">${esc(b.he)}${b.n ? `<small>${b.n}</small>` : ''}</button>` +
    (sel === b.id && b.n ? '<button class="nx" data-next="1">המקום הבא<i class="go"></i></button>' : '')).join('');
  const on = $('#comStrip [data-book][aria-pressed="true"]'), st = $('#comStrip');
  if (on && sel) st.scrollLeft += on.getBoundingClientRect().left + on.offsetWidth / 2 - (st.getBoundingClientRect().left + st.clientWidth / 2);
}
$('#comStrip').onclick = e => {
  const Com = window.SidurCom; if (e.target.closest('[data-next]')) return void Com.next();
  const b = e.target.closest('[data-book]'); if (!b) return;
  Com.select(Com.sel === b.dataset.book ? '' : b.dataset.book); drawComBar();
};
$('#steps').onclick = e => { const k = e.target.dataset.sk; if (k === undefined) return;
  if (k === 'top') return window.scrollTo({ top: 0 }); const a = document.getElementById('sk' + k); if (a) a.scrollIntoView({ block: 'start' }); };
let _spy = false;
function markStep() {
  _spy = false; if (curView !== 'reader' || $('#steps').classList.contains('hide')) return;
  const line = $('#steps').getBoundingClientRect().bottom + 12; let cur = 'top';
  for (const a of document.querySelectorAll('#rbody a.sk')) { if (a.getBoundingClientRect().top <= line) cur = a.id.slice(2); else break; }
  const on = $('#steps .on'); if (on && on.dataset.sk === cur) return; if (on) on.classList.remove('on');
  const b = $(`#steps [data-sk="${cur}"]`); if (b) { b.classList.add('on'); const st = $('#steps .sr'); st.scrollLeft += b.getBoundingClientRect().left + b.offsetWidth / 2 - (st.getBoundingClientRect().left + st.clientWidth / 2); }
}
window.addEventListener('scroll', () => { if (!_spy) { _spy = true; requestAnimationFrame(markStep); } }, { passive: true });
/* the original's setting: hide the bar while the prayer is scrolled down, bring it back on the way up */
let _lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY, d = y - _lastY; if (Math.abs(d) < 8) return; _lastY = y;
  const reading = curView === 'reader' || curView === 'smv' || curView === 'chok';
  document.body.classList.toggle('hdoff', !!cfg.autoHide && reading && d > 0 && y > 140);
}, { passive: true });

/* ---------------- zmanim ---------------- */
function openLuach() { nav('luach', { depth: depth() }); drawLuach(); }
function drawLuach() {
  const now = NOW(), st = sync(now), info = dayInfo(st);
  const eff = new Date(now); if (st.sunset) eff.setDate(eff.getDate() + 1);
  $('#luDate').textContent = (st.sunset ? 'ליל ' : 'יום ') + DOW[eff.getDay()] + ', ' + info.date + ' ' + hebYear(eff);
  $('#luLoc').textContent = (place().name || '') + ' · ' + now.toLocaleDateString('he-IL');
  $('#luNotes').innerHTML = info.hilula.concat(['לוח תחנון: ' + info.tachanun], info.notes, info.daf ? ['דף יומי: ' + info.daf] : []).map(esc).join('<br>');
  const next = upcoming(info, now)[0], nextI = next ? info.times.indexOf(next) : -1;
  $('#luTable').innerHTML = info.times.map((z, i) => `<div class="lurow ${i === nextI ? 'hl' : ''}"><span class="nm">${esc(z.name)}</span><i class="ld"></i><span class="tm">${z.text}</span></div>`).join('');
  $('#luWarn').innerHTML = info.warn.map(esc).join('<br>');
}

function redraw() {
  if (curView === 'home') renderHome();
  else if (curView === 'luach') drawLuach();
  else if (curView === 'reader') { sync(); drawPage(); }
  else if (curView === 'listview') renderMenu();
  else if (curView === 'cal') Luach.drawCal();
  else if (curView === 'smv') Luach.drawSmv();
  else if (curView === 'chok') SidurExtras.drawChok();
}

/* ---------------- navigate to the nearest synagogue ---------------- */
const SHULS = window.SHULS || [];
const IS_APP = location.hostname === 'sidur.local';          // inside the Android app
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_ANDROID = IS_APP || /Android/.test(navigator.userAgent);
let shulSel = 0, shulGps = null, shulPicked = false, shulDone = null;
const kmBetween = (a, b) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };
function cityPos() {
  const c = place(); if (!c.latitude) return null;
  return { lat: toDeg(c.latitude), lon: toDeg(c.longitude), src: 'city' };
}
const shulWhere = () => shulGps || cityPos();   // device location when allowed, otherwise the city chosen in the settings
function nearestShul(pos) { let best = 0; SHULS.forEach((s, i) => { if (kmBetween(pos, s) < kmBetween(pos, SHULS[best])) best = i; }); return best; }
function shulLinks(s) {
  const q = encodeURIComponent(s.q), waze = `https://waze.com/ul?q=${q}&navigate=yes`;
  if (IS_ANDROID) return [['פתח ניווט', `geo:0,0?q=${q}`]];   // the device asks which navigation app to use
  if (IS_IOS) return [['Waze', waze], ['מפות', `https://maps.apple.com/?daddr=${q}&dirflg=d`]];
  return [['Waze', waze], ['Google Maps', `https://www.google.com/maps/dir/?api=1&destination=${q}`]];
}
function drawShul() {
  const shulPos = shulWhere(); if (shulPos && !shulPicked) shulSel = nearestShul(shulPos);
  const near = shulPos ? nearestShul(shulPos) : -1, s = SHULS[shulSel];
  $('#shulQ').textContent = `לפתוח ניווט אל ${s.name}?`;
  $('#shulList').innerHTML = SHULS.map((x, i) => {
    const km = shulPos ? kmBetween(shulPos, x) : null;
    const dist = km === null ? '' : (km < 1 ? 'פחות מק"מ' : (km < 20 ? km.toFixed(1) : Math.round(km)) + ' ק"מ');
    return `<button class="shulrow" role="radio" aria-checked="${i === shulSel}" data-i="${i}"><span class="dot"></span><span class="tx"><b>${esc(x.name)}</b>${x.lines.map(esc).join('<br>')}</span><span class="near">${i === near ? 'הקרוב · ' : ''}${dist}</span></button>`;
  }).join('');
  $('#shulNote').textContent = !shulPos ? '' : shulPos.src === 'gps' ? 'המרחק בקו אווירי, לפי מיקום המכשיר.'
    : `המרחק בקו אווירי, לפי העיר שבהגדרות (${place().name || ''}). אישור גישה למיקום ידייק את הבחירה.`;
  $('#shulBtns').innerHTML = '<button data-x="0">ביטול</button>' + shulLinks(s).map(([t, u]) => `<button class="main" data-u="${esc(u)}">${esc(t)}</button>`).join('');
}
function closeShul() { $('#scrimShul').classList.remove('show'); $('#shulbox').classList.remove('show'); const f = shulDone; shulDone = null; if (f) f(); }
function openShul(done) {
  if (!SHULS.length) { if (done) done(); return; }
  shulDone = done || null; shulPicked = false; shulSel = 0;
  const redraw = () => { if ($('#shulbox').classList.contains('show')) drawShul(); };
  drawShul(); $('#scrimShul').classList.add('show'); $('#shulbox').classList.add('show');
  if (!CITIES.length) setTimeout(redraw, 1200);            // opened from the cover before the city list arrived
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => {
    shulGps = { lat: p.coords.latitude, lon: p.coords.longitude, src: 'gps' }; redraw();
  }, () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
}
$('#shulList').onclick = e => { const r = e.target.closest('.shulrow'); if (!r) return; shulSel = +r.dataset.i; shulPicked = true; drawShul(); };
$('#shulBtns').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const u = b.dataset.u; closeShul(); if (!u) return;
  if (IS_APP || u.startsWith('geo:')) location.href = u; else window.open(u, '_blank', 'noopener');
};
$('#scrimShul').onclick = closeShul;

/* ---------------- splash ---------------- */
const ORIG_MONTH = { 'חשון': 'מרחשוון', 'סיון': 'סיוון' };   // the original's own spelling of the month names (engine/month-names.mjs)
const splashEl = document.getElementById('splash');
let _cReady = false, _tDone = false, _hold = false;
function hideSplash() { splashEl.classList.add('hidden'); setTimeout(() => { splashEl.style.display = 'none'; }, 500); }
function tryHideSplash() { if (_cReady && _tDone && !_hold) hideSplash(); }
function startSplash() {
  if (!cfg.splashOn) { splashEl.style.display = 'none'; _tDone = true; return; }
  /* the plate under the title page is empty in the picture: the app writes the current Hebrew month on it, as the original does */
  try { const n = NOW(), h = HebCal.fromGregorian(n.getFullYear(), n.getMonth() + 1, n.getDate()); const m = h.monthHeb.replace(/[֑-ׇ]/g, ''); $('#spMonth').textContent = (ORIG_MONTH[m] || m) + ' ' + h.yearHeb; } catch (e) {}
  setTimeout(() => { _tDone = true; tryHideSplash(); }, cfg.splashMs);
  /* the gold button on the cover opens the navigation question and keeps the cover up until it is answered */
  $('#spShul').addEventListener('click', e => { e.stopPropagation(); _hold = true; openShul(() => { _hold = false; _tDone = true; _cReady = true; hideSplash(); }); });
  splashEl.addEventListener('click', () => { _tDone = true; _cReady = true; hideSplash(); }, { once: true });
  setTimeout(() => { _tDone = true; _cReady = true; tryHideSplash(); }, 6000);
}

/* ---------------- boot ---------------- */
applyCfg(); startSplash(); renderToc(); show('home');
/* the data files carry the version of the script, so an update never meets an old copy of them */
const VER = ((document.currentScript && document.currentScript.src) || '').split('?v=')[1] || '';
Promise.all([fetch('cities.json?v=' + VER).then(r => r.json()), fetch('content.json?v=' + VER).then(r => r.json())]).then(([c, assets]) => {
  CITIES = c.cities;
  /* the original's order, with an added city placed where the alphabet puts it among the cities of its country */
  const order = CITIES.map((x, i) => i).filter(i => !CITIES[i].added);
  CITIES.forEach((x, i) => { if (!x.added) return; let at = order.findIndex(j => !!CITIES[j].isInIsrael === !!x.isInIsrael && CITIES[j].name.localeCompare(x.name, 'he') > 0); order.splice(at < 0 ? order.length : at, 0, i); });
  document.querySelectorAll('select[data-cfg="city"]').forEach(el => { el.innerHTML = order.map(i => `<option value="${i}">${esc(CITIES[i].name)}</option>`).join(''); });
  ENG = SidurEngine.create({ cities: c.cities, defaults: c.defaults, assets, settings: engineSettings(NOW()) });
  window.ENG = ENG;
  applyLive(); applyCfg(); drawLocNote(); renderHome(); locate();
  if (window.Luach) Luach.yzReady.then(() => { if (curView === 'home') renderHome(); });
  if (window.SidurExtras) SidurExtras.plan();                 /* reminders and the home-screen window, for the coming days */
  if (window.__afterBoot) { const f = window.__afterBoot; window.__afterBoot = null; f(); } else if (window.SidurGo) SidurGo();
  if (window.SidurGuide) SidurGuide.firstRun();               /* the new user's kit, once */
  _cReady = true; tryHideSplash();
}).catch(err => { $('#infoBar').innerHTML = '<div class="errbox">שגיאה בטעינת הסידור: ' + esc(err && err.message || err) + '</div>'; _cReady = true; tryHideSplash(); });
setInterval(() => { if (ENG && curView === 'home') renderHome(); }, 60000);
WIDE.addEventListener('change', () => { if (ENG && curView === 'home') renderHome(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
