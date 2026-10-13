/* hebcal.js - self-contained Hebrew calendar + Daf Yomi (offline, no deps).
   Algorithms: Dershowitz-Reingold "Calendrical Calculations" (RD fixed dates). */
(function (g) {
  'use strict';
  const mod = (a, b) => ((a % b) + b) % b;
  const HEB_EPOCH = -1373427; // RD of 1 Tishrei AM 1

  // ---- Gregorian <-> RD (fixed day number, RD 1 = 0001-01-01) ----
  const gregLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  function gregToRD(y, m, d) {
    const priorMonthDays = Math.floor((367 * m - 362) / 12) +
      (m <= 2 ? 0 : (gregLeap(y) ? -1 : -2));
    return 365 * (y - 1) + Math.floor((y - 1) / 4) - Math.floor((y - 1) / 100) +
      Math.floor((y - 1) / 400) + priorMonthDays + d;
  }

  // ---- Hebrew calendar ----
  const hebLeap = y => mod(7 * y + 1, 19) < 7;
  const hebLastMonth = y => hebLeap(y) ? 13 : 12;      // Nisan=1 .. Adar(II)=12/13
  function hebElapsedDays(y) {
    const monthsElapsed = Math.floor((235 * y - 234) / 19);
    const partsElapsed = 12084 + 13753 * monthsElapsed;
    let day = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
    if (mod(3 * (day + 1), 7) < 3) day += 1;            // molad zaken / adu adjust
    return day;
  }
  function hebDelay(y) {
    const a = hebElapsedDays(y - 1), b = hebElapsedDays(y), c = hebElapsedDays(y + 1);
    if (c - b === 356) return 2;
    if (b - a === 382) return 1;
    return 0;
  }
  const hebNewYear = y => HEB_EPOCH + hebElapsedDays(y) + hebDelay(y);
  const hebYearLen = y => hebNewYear(y + 1) - hebNewYear(y);
  const longCheshvan = y => mod(hebYearLen(y), 10) === 5;
  const shortKislev = y => mod(hebYearLen(y), 10) === 3;
  function hebLastDay(m, y) {
    if ([2, 4, 6, 10, 13].indexOf(m) !== -1) return 29;
    if (m === 12 && !hebLeap(y)) return 29;
    if (m === 8 && !longCheshvan(y)) return 29;
    if (m === 9 && shortKislev(y)) return 29;
    return 30;
  }
  function hebToRD(y, m, d) {
    let n = d;
    if (m < 7) { // Nisan..Elul are the second half of the civil year
      for (let mm = 7; mm <= hebLastMonth(y); mm++) n += hebLastDay(mm, y);
      for (let mm = 1; mm < m; mm++) n += hebLastDay(mm, y);
    } else {
      for (let mm = 7; mm < m; mm++) n += hebLastDay(mm, y);
    }
    return hebNewYear(y) + n - 1;
  }
  function rdToHeb(rd) {
    let y = Math.floor((rd - HEB_EPOCH) / 365.2468) + 1;
    while (hebNewYear(y + 1) <= rd) y++;
    while (hebNewYear(y) > rd) y--;
    let m = rd < hebToRD(y, 1, 1) ? 7 : 1;
    while (rd > hebToRD(y, m, hebLastDay(m, y))) m++;
    const d = rd - hebToRD(y, m, 1) + 1;
    return { y, m, d };
  }

  // ---- Hebrew month names (Nisan=1) ----
  const MONTHS = ['', 'נִיסָן', 'אִיָּיר', 'סִיוָן', 'תַּמּוּז', 'אָב', 'אֱלוּל',
    'תִּשְׁרֵי', 'חֶשְׁוָן', 'כִּסְלֵו', 'טֵבֵת', 'שְׁבָט', 'אֲדָר', 'אֲדָר ב׳'];
  function monthName(m, y) {
    if (m === 12 && hebLeap(y)) return 'אֲדָר א׳';
    return MONTHS[m];
  }
  const DOW = ['רִאשׁוֹן', 'שֵׁנִי', 'שְׁלִישִׁי', 'רְבִיעִי', 'חֲמִישִׁי', 'שִׁישִׁי', 'שַׁבָּת'];

  // ---- gematria ----
  function gematria(n) {
    const H = { 1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
      10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
      100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת' };
    let s = '';
    let rem = n;
    while (rem >= 400) { s += 'ת'; rem -= 400; }
    for (const v of [300, 200, 100]) while (rem >= v) { s += H[v]; rem -= v; }
    if (rem === 15) s += 'טו';
    else if (rem === 16) s += 'טז';
    else {
      const t = Math.floor(rem / 10) * 10, o = rem % 10;
      if (t) s += H[t];
      if (o) s += H[o];
    }
    // punctuation: gershayim before last letter (>=2 letters) else geresh
    if (s.length === 1) return s + '׳';
    return s.slice(0, -1) + '״' + s.slice(-1);
  }

  // ---- Daf Yomi (14th cycle: began 2020-01-05 = Berachot 2) ----
  // day-counts per masechta (last daf - 1); small tractates merged into "מעילה".
  const SHAS = [
    ['בְּרָכוֹת', 63], ['שַׁבָּת', 156], ['עֵירוּבִין', 104], ['פְּסָחִים', 120],
    ['שְׁקָלִים', 21], ['יוֹמָא', 87], ['סוּכָּה', 55], ['בֵּיצָה', 39],
    ['רֹאשׁ הַשָּׁנָה', 34], ['תַּעֲנִית', 30], ['מְגִילָּה', 31], ['מוֹעֵד קָטָן', 28],
    ['חֲגִיגָה', 26], ['יְבָמוֹת', 121], ['כְּתוּבּוֹת', 111], ['נְדָרִים', 90],
    ['נָזִיר', 65], ['סוֹטָה', 48], ['גִּיטִּין', 89], ['קִידּוּשִׁין', 81],
    ['בָּבָא קַמָּא', 118], ['בָּבָא מְצִיעָא', 118], ['בָּבָא בַּתְרָא', 175],
    ['סַנְהֶדְרִין', 112], ['מַכּוֹת', 23], ['שְׁבוּעוֹת', 48], ['עֲבוֹדָה זָרָה', 75],
    ['הוֹרָיוֹת', 13], ['זְבָחִים', 119], ['מְנָחוֹת', 109], ['חוּלִּין', 141],
    ['בְּכוֹרוֹת', 60], ['עֲרָכִין', 33], ['תְּמוּרָה', 33], ['כְּרִיתוֹת', 27],
    ['מְעִילָה', 35], ['נִידָּה', 72]
  ]; // sum = 2711
  const DAF_CYCLE14_START = gregToRD(2020, 1, 5);
  const DAF_TOTAL = SHAS.reduce((a, m) => a + m[1], 0);
  function dafYomi(rd) {
    let n = mod(rd - DAF_CYCLE14_START, DAF_TOTAL); // day index in cycle
    for (const [name, cnt] of SHAS) {
      if (n < cnt) return { masechta: name, daf: n + 2, dafHeb: gematria(n + 2) };
      n -= cnt;
    }
    return null;
  }

  // ---- public: describe a Gregorian date ----
  function fromGregorian(y, m, d) {
    const rd = gregToRD(y, m, d);
    const h = rdToHeb(rd);
    const dow = mod(rd, 7); // 0=Sunday
    return {
      rd,
      hy: h.y, hm: h.m, hd: h.d,
      dayHeb: gematria(h.d),
      monthHeb: monthName(h.m, h.y),
      yearHeb: gematria(h.y % 1000),
      isLeap: hebLeap(h.y),
      dow,
      dowHeb: DOW[dow],
      full: `${DOW[dow] === 'שַׁבָּת' ? 'שַׁבָּת קֹדֶשׁ' : 'יוֹם ' + DOW[dow]}, ${gematria(h.d)} ${monthName(h.m, h.y)} ${gematria(h.y % 1000)}`,
      daf: dafYomi(rd)
    };
  }

  g.HebCal = { fromGregorian, gregToRD, rdToHeb, hebToRD, gematria, dafYomi,
    _internal: { hebLeap, hebNewYear, hebYearLen } };
})(typeof window !== 'undefined' ? window : globalThis);
