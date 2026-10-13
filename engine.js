/* Siddur engine: a thin host around the mechanically translated original logic (rt.js + orig.js).
   Everything that decides WHAT is shown (day flags, conditions, page assembly, menu, the sunset
   questions, zmanim) is the original code; this file only wires inputs and collects outputs. */
(function (g) {
  'use strict';
  const RT = g.SidurRT; const M = RT.M;
  const T = 'Lbav/sbav/Tfilon;', PG = 'Lbav/sbav/Page;';
  const S3 = '(Ljava/lang/String;Ljava/lang/String;I)V';
  const DIALOGS = { 1: { key: 'late_mincha', next: 'minchaNextDayListener', prev: 'minchaPrevDayListener' }, 2: { key: 'early_arvit', next: 'arvitNextDayListener', prev: 'arvitPrevDayListener' }, 3: { key: 'late_mazon', next: 'mazonNextDayListener', prev: 'mazonPrevDayListener' } };

  function create(opts) {
    const cities = opts.cities, defaults = opts.defaults || {};
    const ui = { shown: null, pages: [], dialogs: [] };
    // ---- assets: the original reads a file, decodes UTF-8 and drops the first character
    let assetText = '';
    RT.shims.set('*.getAssets', () => ({ cls: 'Landroid/content/res/AssetManager;', f: {} }));
    RT.shims.set('Landroid/content/res/AssetManager;.open', (o, name) => { const a = opts.assets[name]; if (typeof a !== 'string') RT.jthrow('Ljava/io/FileNotFoundException;', name); assetText = a; return { cls: 'Ljava/io/InputStream;', f: {}, done: false }; });
    RT.shims.set('Ljava/io/InputStream;.read', o => { if (o.done) return -1; o.done = true; return 0; });
    RT.shims.set('Ljava/io/InputStream;.close', () => { });
    RT.shims.set('Ljava/io/ByteArrayOutputStream;.<init>', () => { });
    RT.shims.set('Ljava/io/ByteArrayOutputStream;.write', () => { });
    RT.shims.set('Ljava/io/ByteArrayOutputStream;.close', () => { });
    RT.shims.set('Ljava/io/ByteArrayOutputStream;.toString', () => assetText);
    // ---- observation points instead of real Android screens
    M[T + '.showViewWithBar:(Landroid/view/View;Ljava/lang/String;Z)V'] = (t, view, title) => { ui.shown = { view, title }; };
    M[T + '.showPage:' + S3] = (t, file, title, fd) => { ui.pages.push({ file, title: title === '' ? file : title, forceDay: fd }); };
    M[T + '.ToggleDoNotDisturb:(Z)V'] = () => { };
    RT.shims.set('*.showDialog', (t, id) => { ui.dialogs.push(id); });
    RT.shims.set('*.dismissDialog', () => { });
    RT.shims.set('*.findViewById', (t, id) => ({ cls: 'Landroid/widget/TextView;', f: {}, id, text: '', vis: 0 }));
    RT.shims.set('*.registerForContextMenu', () => { });
    RT.shims.set('*.setContentView', () => { });
    RT.shims.set('*.invalidate', () => { });

    RT.IC(T);
    RT.C[T].statics.res = { cls: 'Landroid/content/res/Resources;', f: {} };   // the original caches getResources() in onCreate
    const tf = { cls: T, f: {} };
    M[T + '.<init>:()V'](tf);
    const flagNames = Object.entries(tf.f).filter(([k, v]) => typeof v === 'bigint' && /^[A-Z0-9_]+$/.test(k) && v > 0n && (v & (v - 1n)) === 0n);
    const cityObj = c => { const lat = c.latitude.slice(); lat.t = '[I'; const lng = c.longitude.slice(); lng.t = '[I'; return { cls: 'Lbav/sbav/City;', f: { innerId: c.innerId, name: c.name, latitude: lat, longitude: lng, gmtOffset: new RT.Dbl(c.gmtOffset), isInIsrael: c.isInIsrael, elevation: c.elevation, shabbatTime: c.shabbatTime } }; };
    const cityObjs = cities.map(cityObj);
    tf.f.cities = cityObjs;
    const settings = {};
    const eng = {
      RT, tf, cities,
      /* settings: the same keys the original keeps in its preferences */
      configure(s) {
        Object.assign(settings, { city: 34, purimDay: 1, censor: 1, vaanenu: 0, doctor: 0, doctorNames: '', summerTime: 0, font: 4, ratio: 2, night: 0, specialText: 'red', koteretText: 'blue' }, defaults, settings, s || {});
        const f = tf.f, col = n => f[{ red: 'RED', blue: 'BLUE', green: 'GREEN', purple: 'PURPLE' }[n] || 'RED'];
        f.city = cityObjs[settings.city] || cityObjs[34]; f.chul = f.city.f.isInIsrael ? 0 : 1;
        f.purimDay = settings.purimDay; f.censor = settings.censor ? 1 : 0; f.vaanenu = settings.vaanenu ? 1 : 0; f.doctor = settings.doctor ? 1 : 0; f.doctorNames = settings.doctorNames || '';
        f.summerTime = settings.summerTime ? 1 : 0; f.font = settings.font; f.ratio = settings.ratio; f.nightMode = settings.night ? 1 : 0;
        f.specialText = col(settings.specialText); f.koteretText = col(settings.koteretText);
        f.nusach = 's'; f.locale_gravity = 5; f.autoDnd = 0;
        return settings;
      },
      settings: () => Object.assign({}, settings),
      /* a place outside the original's list (the device's own location), in the same form as a listed city;
         the original's own calculation then runs on it unchanged */
      setCity(index, c) { cityObjs[index] = cityObj(c); },
      /* `date` is a Date whose local fields are the wall-clock time the app should see */
      setNow(date) { RT.now = date; },
      /* recompute the day exactly as the original does on every screen change */
      refresh() { M[T + '.setDayData:()V'](tf); return eng.state(); },
      state() { const f = tf.f; return { sunset: f.sunset ? 1 : 0, sunrise: f.sunrise ? 1 : 0, dayData: f.dayData, nextDayData: f.nextDayData, flags: eng.flagNames(f.sunset ? f.nextDayData : f.dayData), kria: (f.kria || []).slice(), zmanimHtml: f.zmanimText || '' }; },
      flagNames(bits) { return flagNames.filter(([k, v]) => (bits & v) !== 0n).map(([k]) => k); },
      /* run one of the original's menu builders and report the buttons it produced */
      menu(method) {
        ui.shown = null; M[T + '.' + (method || 'showTfilaMenu') + ':()V'](tf);
        const s = ui.shown; if (!s) return null;
        return shownMenu(s);
      },
      /* press a button: returns the page(s) the original would open, or the question it would ask */
      click(btn) {
        ui.pages = []; ui.dialogs = []; ui.shown = null; const l = btn._l; if (!l) return { pages: [], dialog: null };
        RT.find(l.cls, 'onClick:(Landroid/view/View;)V')(l, btn._v);
        return { pages: ui.pages.slice(), dialog: ui.dialogs.length ? ui.dialogs[0] : null, submenu: ui.shown ? ui.shown.title : null, menu: ui.shown ? shownMenu(ui.shown) : null };
      },
      /* the "which day?" question the original shows around sunset */
      dialog(n) { const d = DIALOGS[n]; if (!d) return null; const lay = Object.values(RT.res.layouts).find(x => x.name === d.key); const tv = lay.views.find(v => v.tag === 'TextView'); const bs = lay.views.filter(v => v.tag === 'Button'); return { id: n, text: tv ? tv.text : '', buttons: bs.map(b => b.text) }; },
      answer(n, which) { const d = DIALOGS[n]; const l = tf.f[which === 'next' ? d.next : d.prev]; ui.pages = []; RT.find(l.cls, 'onClick:(Landroid/view/View;)V')(l, null); return ui.pages.slice(); },
      /* assemble a page exactly as Page.<init> + onDraw do (text-view path) */
      page(file, forceDay) {
        const vec = () => ({ cls: 'Ljava/util/Vector;', f: {}, a: [] });
        const page = { cls: PG, f: { mgr: tf, fname: file, forceDay: forceDay | 0, coloreds: vec(), skips: vec(), firstTime: 1, secondTime: 0 } };
        const contents = M[T + '.readFile:(Ljava/lang/String;)Ljava/lang/String;'](tf, file) + '\r\n';
        page.f.fileContents = contents;
        page.f.splitByLines = M[PG + '.splitByNL:(Ljava/lang/String;)Ljava/util/Vector;'](page, contents);
        M[PG + '.initiateText:()V'](page);
        const lines = page.f.splitByLines.a.slice();
        const od = RT.res.onDraw, cz = settings.censor ? od.strs[3] : od.strs[4];
        let html = od.strs[2];
        const kq = String.fromCharCode(od.chars[1]), sof = String.fromCharCode(od.chars[3]);
        for (const ln of lines) html += trimJ(ln).split('K').join(kq).split(od.strs[5]).join(cz).split(';').join(sof).split(od.strs[6]).join(od.strs[7]) + od.strs[8];
        return { file, forceDay: forceDay | 0, lines, html, skips: page.f.skips.a.map(s => ({ title: firstString(s), line: firstInt(s) })) };
      },
    };
    eng.configure(opts.settings);
    return eng;
  }
  const trimJ = a => { let s = 0, e = a.length; while (s < e && a.charCodeAt(s) <= 32) s++; while (e > s && a.charCodeAt(e - 1) <= 32) e--; return a.slice(s, e); };
  const firstString = o => { for (const v of Object.values(o.f)) if (typeof v === 'string') return v; return ''; };
  const firstInt = o => { for (const v of Object.values(o.f)) if (typeof v === 'number') return v; return 0; };
  function collectKids(v, out) { out = out || []; for (const k of v.kids || []) { out.push(k); collectKids(k, out); } return out; }
  // every button of the screen the original just built: those from the layout and those it added in code, in order
  function shownMenu(s) { const views = []; for (const v of s.view.views || []) { views.push(v); collectKids(v, views); } collectKids(s.view, views);
    return { title: s.title, buttons: views.filter(v => v.tag === 'Button' || v.listener).map(v => ({ id: v.id, text: v.text, visible: v.vis === 0, enabled: !!v.enabled, _l: v.listener, _v: v })) }; }

  g.SidurEngine = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.SidurEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
