/* guide.js - the guide screen, and the new user's kit.
   The guide only explains and leads to the screens themselves. The kit is a sheet of four short steps
   (city, display, prayer time, suggested reminders) that is shown once on a new installation and can be
   reopened from the guide. Its controls are the settings' own (data-cfg), so there is one copy of every choice. */
'use strict';
(function () {
  const X = window.SidurExtras, N = window.SidurNative || null;

  /* ---------------- the guide ---------------- */
  const body = $('#guideBody');
  body.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) X.goTarget(b.dataset.go, b.dataset.label); });
  /* one topic open at a time, and the opened one is brought under the title */
  body.addEventListener('toggle', e => {
    const d = e.target; if (!d.open) return;
    body.querySelectorAll('details[open]').forEach(o => { if (o !== d) o.open = false; });
    const top = d.getBoundingClientRect().top; if (top < 70 || top > innerHeight * 0.6) window.scrollBy(0, top - 76);
  }, true);

  /* ---------------- the kit ---------------- */
  const WEEK = [0, 1, 2, 3, 4, 5];                         /* Sunday to Friday: nothing rings on Shabbat */
  const zman = (title, name, before, days, attach) => ({ on: 1, title, kind: 'zman', time: '07:00', zman: name, before, days, attach: attach || { target: '', label: '' } });
  const hour = (title, time, days, attach) => ({ on: 1, title, kind: 'time', time, zman: '', before: 0, days, attach });
  const STARTERS = [
    zman('סוף זמן קריאת שמע (מג"א)', 'סזק"ש (מג"א)', 15, WEEK),
    zman('סוף זמן קריאת שמע (גר"א)', 'סזק"ש (גר"א)', 15, WEEK),
    zman('מנחה', 'שקיעה', 30, [0, 1, 2, 3, 4], { target: 'tfila:מנחה', label: 'תפילה · מנחה' }),
    zman('הדלקת נרות', 'הדלקת נרות', 30, [5]),
    hour('חוק לישראל', '07:00', WEEK, { target: '#chok', label: 'חוק לישראל · של היום' }),
    hour('שניים מקרא ואחד תרגום', '09:00', [5], { target: 'smv:-1', label: 'חומש · העלייה של היום' }),
  ];
  const pages = [...document.querySelectorAll('#kitBody .kitp')], dots = [...document.querySelectorAll('#kitSteps i')];
  let step = 0, offered = [];
  function drawRems() {
    const names = X.zmanNames();                          /* a reminder by a time the siddur does not show here is not offered */
    offered = STARTERS.filter(r => r.kind !== 'zman' || names.includes(r.zman));
    $('#kitRems').innerHTML = offered.map((r, i) => {
      const have = X.hasRem(r.title);
      return `<label class="srw"><span>${esc(r.title)}<small>${esc(X.whenText(r))}${r.attach.target ? ' · נפתח: ' + esc(r.attach.label) : ''}${have ? ' · כבר ברשימה שלך' : ''}</small></span>` +
        `<button class="sw" role="switch" aria-checked="${have}" data-kit="${i}"${have ? ' disabled' : ''}></button></label>`;
    }).join('');
    $('#kitRemNote').textContent = X.canNotify() ? 'אם ההתראות עוד לא אושרו, המכשיר יבקש את אישורך בסיום.' : 'ההתראות עצמן פועלות באפליקציה (אנדרואיד ואייפון). כאן, בדפדפן, הרשימה נשמרת בלבד.';
  }
  function draw() {
    pages.forEach((p, i) => p.classList.toggle('on', i === step)); dots.forEach((d, i) => d.classList.toggle('on', i <= step)); $('#kitSteps').classList.toggle('hide', only >= 0);
    $('#kitHead').textContent = pages[step].dataset.title; $('#kitCount').textContent = `צעד ${step + 1} מתוך ${pages.length}`;
    $('#kitPrev').classList.toggle('hide', !step || only >= 0); $('#kitNext').textContent = only >= 0 ? 'שמירה' : step === pages.length - 1 ? 'סיום' : 'הבא';
    $('#kitSkip').classList.toggle('hide', step === pages.length - 1); $('#kitBody').scrollTop = 0;
  }
  /* "your library": the packs, the base one ticked; the light version unticks everything */
  const fmtMB = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' גיגה' : Math.max(1, Math.round(n / 1e6)) + ' מגה';
  function drawPacks() {
    const L = window.SidurLib; if (!L) return;
    L.load().then(() => {
      const packs = L.packs(), pick = store.get('libPick', null);
      $('#kitPacks').innerHTML = packs.length ? packs.map(p => `<label class="srw"><span>${esc(p.he)}<small>${esc(p.desc || '')} · <b>${fmtMB(p.zipBytes || p.bytes || 0)}</b></small></span><button class="sw" role="switch" data-pack="${p.id}" aria-checked="${pick ? pick.includes(p.id) : !!p.base}"></button></label>`).join('')
        : '<p class="hint">רשימת החבילות תופיע כשהספרייה תהיה זמינה.</p>';
      sumPacks();
    }).catch(() => { $('#kitPacks').innerHTML = '<p class="hint">הספרייה עוד לא זמינה. אפשר להוריד ספרים אחר כך במגירה "שמור בטלפון".</p>'; });
    $('#kitWifi').setAttribute('aria-checked', String(!!store.get('libWifi', true)));
  }
  function sumPacks() {
    const L = window.SidurLib, on = [...document.querySelectorAll('#kitPacks [data-pack][aria-checked="true"]')].map(b => b.dataset.pack);
    const bytes = L ? L.packs().filter(p => on.includes(p.id)).reduce((a, p) => a + (p.zipBytes || p.bytes || 0), 0) : 0;
    let free = 0; try { free = N && N.libPacks ? JSON.parse(N.libPacks()).free : 0; } catch (e) { }
    $('#kitPackSum').textContent = !N ? 'כאן, בדפדפן, הספרים נקראים ישר מהאינטרנט. ההורדה לטלפון קיימת באפליקציה לאנדרואיד.'
      : on.length ? `יורד: ${fmtMB(bytes)}${free ? ' · פנוי בטלפון: ' + fmtMB(free) : ''}` : 'לא יורד כלום כרגע. אפשר להוריד בכל רגע מהמגירה "שמור בטלפון".';
  }
  function startPacks() {   /* the downloads begin when the kit is done; nothing is fetched before the user says so */
    const L = window.SidurLib, on = [...document.querySelectorAll('#kitPacks [data-pack][aria-checked="true"]')].map(b => b.dataset.pack);
    store.set('libPick', on); store.set('libAsked', 1); if (!L || !N) return;
    L.packs().filter(p => on.includes(p.id)).forEach(p => L.getPack(p));
  }
  $('#kitPacks').onclick = e => { const b = e.target.closest('[data-pack]'); if (!b) return; b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); sumPacks(); };
  $('#kitWifi').onclick = () => { store.set('libWifi', !store.get('libWifi', true)); $('#kitWifi').setAttribute('aria-checked', String(!!store.get('libWifi', true))); };
  $('#kitLight').onclick = () => { document.querySelectorAll('#kitPacks [data-pack]').forEach(b => b.setAttribute('aria-checked', 'false')); sumPacks(); };
  let only = -1;   /* a single step shown by itself (the library step, offered once to those who had finished the kit) */
  function openKit(at, alone) { store.set('kitDone', 1); step = at || 0; only = alone ? step : -1; $('#kitDndRow').classList.toggle('hide', !N); drawRems(); drawPacks(); draw(); openSheet('Kit'); }
  const closeKit = () => closeSheet('Kit');
  $('#kitRems').onclick = e => { const b = e.target.closest('[data-kit]'); if (b && !b.disabled) b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); };
  $('#kitPrev').onclick = () => { if (step) { step--; draw(); } };
  $('#kitNext').onclick = () => {
    if (only >= 0) { closeKit(); return startPacks(); }
    if (step < pages.length - 1) { step++; return draw(); }
    startPacks();
    const picked = [...document.querySelectorAll('#kitRems [data-kit][aria-checked="true"]:not([disabled])')].map(b => JSON.parse(JSON.stringify(offered[+b.dataset.kit])));
    closeKit(); if (picked.length) X.addRems(picked);
  };
  $('#kitSkip').onclick = () => { if (only >= 0) store.set('libAsked', 1); closeKit(); }; $('#scrimKit').onclick = closeKit; $('#kitOpen').onclick = () => openKit(0);

  /* A new installation: the kit comes up by itself, once, after the cover has left and only on the home page
     (the app may have been opened by a reminder, straight into a prayer). */
  function firstRun() {
    /* those who finished the kit before the library existed are asked once, by the library step alone */
    const libStep = pages.findIndex(p => p.id === 'kitLib');
    if (store.get('kitDone', 0) && store.get('libAsked', 0)) return;
    const alone = !!store.get('kitDone', 0); let tries = 0;
    const wait = setInterval(() => {
      if (++tries > 60) return clearInterval(wait);
      if ($('#splash').style.display !== 'none') return;
      clearInterval(wait); if (curView === 'home' && !document.querySelector('.sheet.show,.askbox.show')) alone ? openKit(libStep, true) : openKit(0);
    }, 300);
  }
  window.SidurGuide = { firstRun, openKit };
})();
