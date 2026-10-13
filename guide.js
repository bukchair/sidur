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
    pages.forEach((p, i) => p.classList.toggle('on', i === step)); dots.forEach((d, i) => d.classList.toggle('on', i <= step));
    $('#kitHead').textContent = pages[step].dataset.title; $('#kitCount').textContent = `צעד ${step + 1} מתוך ${pages.length}`;
    $('#kitPrev').classList.toggle('hide', !step); $('#kitNext').textContent = step === pages.length - 1 ? 'סיום' : 'הבא';
    $('#kitSkip').classList.toggle('hide', step === pages.length - 1); $('#kitBody').scrollTop = 0;
  }
  function openKit() { store.set('kitDone', 1); step = 0; $('#kitDndRow').classList.toggle('hide', !N); drawRems(); draw(); openSheet('Kit'); }
  const closeKit = () => closeSheet('Kit');
  $('#kitRems').onclick = e => { const b = e.target.closest('[data-kit]'); if (b && !b.disabled) b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')); };
  $('#kitPrev').onclick = () => { if (step) { step--; draw(); } };
  $('#kitNext').onclick = () => {
    if (step < pages.length - 1) { step++; return draw(); }
    const picked = [...document.querySelectorAll('#kitRems [data-kit][aria-checked="true"]:not([disabled])')].map(b => JSON.parse(JSON.stringify(offered[+b.dataset.kit])));
    closeKit(); if (picked.length) X.addRems(picked);
  };
  $('#kitSkip').onclick = closeKit; $('#scrimKit').onclick = closeKit; $('#kitOpen').onclick = openKit;

  /* A new installation: the kit comes up by itself, once, after the cover has left and only on the home page
     (the app may have been opened by a reminder, straight into a prayer). */
  function firstRun() {
    if (store.get('kitDone', 0)) return; let tries = 0;
    const wait = setInterval(() => {
      if (++tries > 60) return clearInterval(wait);
      if ($('#splash').style.display !== 'none') return;
      clearInterval(wait); if (curView === 'home' && !document.querySelector('.sheet.show,.askbox.show')) openKit();
    }, 300);
  }
  window.SidurGuide = { firstRun, openKit };
})();
