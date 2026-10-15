/* compass.js - the direction of prayer: a brass dial that turns with the phone, and a gilded needle that points to the
   place of the Temple (the Foundation Stone on the Temple Mount). "היה עומד בח"ל יכוין את לבו כנגד ארץ ישראל ... היה עומד
   בירושלים יכוין את לבו כנגד בית המקדש" (ברכות ל.).
   The place is the device's location when the user allowed it, otherwise the city of the settings. Abroad there are two
   ways to reckon the direction (a fixed direction on the map, or the shortest way over the globe); the user picks one
   by their custom and it is kept. The phone's compass comes from the browser's orientation events: on Android the
   absolute orientation, on iPhone webkitCompassHeading after the user allows motion access. */
'use strict';
(function () {
  const TEMPLE = { lat: 31.77805, lon: 35.2354 };
  const RAD = Math.PI / 180, WIND = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
  const great = (a, b) => { const f1 = a.lat * RAD, f2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD, y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl); return (Math.atan2(y, x) / RAD + 360) % 360; };
  const rhumb = (a, b) => { const f1 = a.lat * RAD, f2 = b.lat * RAD; let dl = (b.lon - a.lon) * RAD; const dp = Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2)); if (Math.abs(dl) > Math.PI) dl = dl > 0 ? -(2 * Math.PI - dl) : 2 * Math.PI + dl; return (Math.atan2(dl, dp) / RAD + 360) % 360; };
  const km = (a, b) => { const f1 = a.lat * RAD, f2 = b.lat * RAD; return 6371 * 2 * Math.asin(Math.sqrt(Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin((b.lon - a.lon) * RAD / 2) ** 2)); };
  const S = { head: null, shown: 0, method: store.get('cmpMethod', 'r'), on: false, live: false, jitter: 0, last: 0, buzzed: false };
  const where = () => {
    const c = place(), il = !!c.isInIsrael;
    if (S.gps) return { lat: S.gps.lat, lon: S.gps.lon, name: 'המקום שלך', il, exact: true };
    if (typeof shulGps !== 'undefined' && shulGps) return { lat: shulGps.lat, lon: shulGps.lon, name: 'המקום שלך', il, exact: true };
    const p = typeof cityPos === 'function' ? cityPos() : null; return p ? { lat: p.lat, lon: p.lon, name: (c.name || '').split(',')[0], il } : null;
  };
  const bearing = w => (w.il || S.method === 'g') ? great(w, TEMPLE) : rhumb(w, TEMPLE);
  /* the dial: the four winds engraved on the brass, and the needle */
  function build() {
    $('#cmpDial').innerHTML = [['צפון', 0, 'n'], ['מזרח', 90, ''], ['דרום', 180, ''], ['מערב', 270, '']].map(([t, a, c]) =>
      `<span class="dr ${c}" style="transform:rotate(${a}deg)"><span>${t}</span></span>`).join('') + '<span class="ndl" id="cmpNdl"><i></i><b>מקום המקדש</b></span>';
  }
  /* smooth the heading along the shortest way round */
  function onHeading(h) {
    if (S.head === null) S.shown = h;
    const d = ((h - S.shown) % 360 + 540) % 360 - 180; S.jitter = S.jitter * .9 + Math.abs(d) * .1;
    S.shown = (S.shown + d * .25 + 360) % 360; S.head = h; S.live = true; S.last = Date.now(); draw();
  }
  function onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;                  /* iPhone */
    else if (e.absolute !== false && typeof e.alpha === 'number') h = (360 - e.alpha) % 360;     /* Android, absolute */
    if (h === null) return;
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;     /* the screen turned sideways */
    onHeading((h + ang + 360) % 360);
  }
  let listening = false;
  function listen() {
    if (listening) return; listening = true;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrient);
    else window.addEventListener('deviceorientation', onOrient);
  }
  function stop() { listening = false; window.removeEventListener('deviceorientationabsolute', onOrient); window.removeEventListener('deviceorientation', onOrient); }
  const needsAsk = () => IS_IOS && typeof (window.DeviceOrientationEvent || {}).requestPermission === 'function';
  function ask() {   /* the sensor is heard everywhere; iPhone also asks the user once for motion access, on a click */
    listen();
    if (needsAsk()) DeviceOrientationEvent.requestPermission().then(() => draw()).catch(() => draw());
  }
  /* in Jerusalem the city's point is not enough: the direction changes from street to street, so the exact place is asked */
  function precise() {
    if (!navigator.geolocation) return;
    $('#cmpMsg').querySelector('#cmpGps') && ($('#cmpGps').textContent = 'מאתר מיקום...');
    navigator.geolocation.getCurrentPosition(p => { S.gps = { lat: p.coords.latitude, lon: p.coords.longitude }; draw(); }, () => { S.gpsFail = true; draw(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function draw() {
    if (curView !== 'compass') return;
    const w = where();
    if (!w) { $('#cmpMsg').innerHTML = '<b>אין מיקום</b>אפשר לבחור עיר בהגדרות, או לאשר מיקום.'; return; }
    const d = km(w, TEMPLE);
    if (d < 3 && !w.exact) {   /* the city is Jerusalem itself: its point says nothing about the street, so the exact place is asked first */
      $('#cmpDial').style.transform = ''; $('#cmpNdl').style.opacity = '0'; $('#cmpStage').classList.remove('on');
      $('#cmpMsg').innerHTML = S.gpsFail ? '<b>לא התקבל מיקום</b>בירושלים צריך את המיקום המדויק. אפשר לאשר מיקום להגדרות האפליקציה ולנסות שוב.<button class="pbtn main" id="cmpGps">ניסיון נוסף</button>'
        : '<b>בירושלים מכוונים אל מקום המקדש עצמו</b>הכיוון משתנה משכונה לשכונה, ולכן צריך את המיקום המדויק.<button class="pbtn main" id="cmpGps">איתור המיקום שלי</button>';
      $('#cmpWhere').textContent = w.name; $('#cmpDeg').textContent = 'לפי המיקום המדויק'; $('#cmpKm').textContent = d.toFixed(1) + ' ק"מ'; $('#cmpMethod').classList.add('hide');
      $('#cmpNote').textContent = ''; return;
    }
    $('#cmpNdl').style.opacity = '';
    const b = bearing(w), head = S.live ? S.shown : 0, rel = ((b - head) % 360 + 540) % 360 - 180, on = S.live && Math.abs(rel) < 4;
    $('#cmpDial').style.transform = `rotate(${-head}deg)`; $('#cmpNdl').style.transform = `rotate(${b}deg)`;
    $('#cmpStage').classList.toggle('on', on); $('#cmpMsg').classList.toggle('on', on);
    if (on && !S.buzzed) { S.buzzed = true; try { navigator.vibrate && navigator.vibrate(35); } catch (e) { } } else if (!on && Math.abs(rel) > 8) S.buzzed = false;
    const stale = S.live && Date.now() - S.last > 3000;
    $('#cmpMsg').innerHTML = !S.live ? `<b>הכיוון: ${Math.round(b)}° מהצפון</b>${needsAsk() ? '<button class="pbtn main" id="cmpAsk">הפעלת המצפן</button>' : Date.now() - S.opened < 2500 ? 'מחפש את המצפן של הטלפון...' : 'לא נמצא מצפן בטלפון הזה. אפשר לכוון לפי מצפן אחר: ' + WIND[Math.round(b / 45) % 8] + '.'}`
      : on ? '<b>מכוון למקום המקדש</b>' : `<b>${rel > 0 ? 'לסובב ימינה' : 'לסובב שמאלה'} ${Math.round(Math.abs(rel))}°</b>עד שהמחט מצביעה למעלה, אל המשולש`;
    $('#cmpCal').classList.toggle('hide', !(S.live && (S.jitter > 6 || stale)));
    $('#cmpWhere').textContent = w.name;
    $('#cmpDeg').textContent = `${Math.round(b)}° · ${WIND[Math.round(b / 45) % 8]}`;
    $('#cmpKm').textContent = d < 10 ? d.toFixed(1) + ' ק"מ' : Math.round(d).toLocaleString('he-IL') + ' ק"מ';
    $('#cmpMethod').classList.toggle('hide', w.il);
    document.querySelectorAll('#cmpMethod [data-m]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === S.method)));
    $('#cmpNote').textContent = w.il ? (d < 12 ? 'בירושלים מכוונים אל מקום המקדש עצמו, ולכן הכיוון משתנה משכונה לשכונה.' : 'בארץ ישראל מכוונים אל ירושלים ואל מקום המקדש.')
      : `שתי דרכי החישוב: במפה ${Math.round(rhumb(w, TEMPLE))}°, על פני כדור הארץ ${Math.round(great(w, TEMPLE))}°. בוחרים לפי המנהג, וזה נשמר.`;
  }
  function open(fromBack) {
    if (fromBack) show('compass'); else if (curView !== 'compass') nav('compass', { depth: depth() });
    if (!$('#cmpNdl')) build();
    S.head = null; S.live = false; S.opened = Date.now(); S.gpsFail = false; ask(); draw();
    clearInterval(open.t); open.t = setInterval(() => { if (curView !== 'compass') { clearInterval(open.t); stop(); } else draw(); }, 1000);
  }
  $('#cmpMethod').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; S.method = b.dataset.m; store.set('cmpMethod', S.method); draw(); };
  $('#cmpMsg').onclick = e => { if (e.target.id === 'cmpAsk') ask(); if (e.target.id === 'cmpGps') precise(); };
  window.SidurCompass = { open };
})();
