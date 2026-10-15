/* Offline cache for the Tfilon reader (personal-use PWA). */
const CACHE = 'sidur-mv954bnf';
const ASSETS = [
  './', './index.html', './app.js', './hebcal.js', './calcore.js', './luach.js', './extras.js', './guide.js', './sizes.js', './compass.js', './img/dial.webp', './library.js', './vendor/daf-renderer.js', './img/bookcase.webp', './img/spine-burgundy.webp', './img/spine-navy.webp', './img/spine-green.webp', './img/spine-brown.webp', './img/spine-black.webp', './img/spine-plum.webp', './haman.json', './yahrzeits.json', './shuls.js', './commentary.js', './commentary/index.json', './rt.js', './orig.js', './engine.js',
  './cities.json', './content.json', './manifest.webmanifest', './icon-maskable.png', './icon.png', './splash.jpeg',
  './FrankRuhlLibre.ttf', './Heebo.ttf', './Alef-Regular.ttf', './HadasimCLM-Regular.ttf', './SILEOTSR.ttf', './ShofarRegular.ttf',
  './NotoRashiHebrew.woff2'
];
self.addEventListener('install', e => {
  /* 'reload': take each file from the server, never from the browser's own HTTP cache, or an update could store old files */
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
