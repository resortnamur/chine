/* Service worker : met tout le site en cache pour un usage hors ligne.
   Changer VERSION à chaque modification du code (pas nécessaire pour data.json). */
const VERSION = 'v7';
const CACHE = 'chine-' + VERSION;
const FICHIERS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'data.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('chine-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La page demande l'activation de la nouvelle version (bouton « mettre à jour »)
self.addEventListener('message', (e) => {
  if (e.data === 'activer') self.skipWaiting();
  if (e.data === 'completer') e.waitUntil(completer());
});

// Auto-réparation : remet en cache les fichiers qui en auraient disparu
async function completer() {
  const cache = await caches.open(CACHE);
  for (const f of FICHIERS) {
    if (await cache.match(f)) continue;
    try {
      const rep = await fetch(new Request(f, { cache: 'reload' }));
      if (rep.ok) await cache.put(f, rep);
    } catch (err) { /* hors ligne : on réessaiera à la prochaine ouverture */ }
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // data.json : réseau d'abord (4 s max), sinon la copie en cache marquée « hors ligne »
  if (url.pathname.endsWith('/data.json')) {
    e.respondWith(reseauDabord(url));
    return;
  }

  // Pages : la coquille en cache, quels que soient les paramètres (?t=…)
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('index.html').then((r) => r || fetch(req))
    );
    return;
  }

  // Autres fichiers : cache d'abord
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req).then((rep) => {
      if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
      return rep;
    }))
  );
});

async function reseauDabord(url) {
  const cache = await caches.open(CACHE);
  const cleCache = new URL('data.json', self.registration.scope).href;
  try {
    const rep = await Promise.race([
      fetch(url.href, { cache: 'no-store' }),
      new Promise((_, rejet) => setTimeout(() => rejet(new Error('délai')), 4000))
    ]);
    if (!rep.ok) throw new Error('HTTP ' + rep.status);
    await cache.put(cleCache, rep.clone());
    return rep;
  } catch (err) {
    const copie = await cache.match(cleCache);
    if (!copie) throw err;
    const entetes = new Headers(copie.headers);
    entetes.set('X-Hors-Ligne', '1');
    return new Response(await copie.blob(), { status: 200, headers: entetes });
  }
}
