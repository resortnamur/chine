/* Service worker : met tout le site en cache pour un usage hors ligne.
   Changer VERSION à chaque modification du code (pas nécessaire pour data.json). */
const VERSION = 'v18';
const CACHE = 'chine-' + VERSION;
// Photos du diaporama : cache à part, conservé d'une version à l'autre (≈ 5 Mo à ne télécharger qu'une fois)
const CACHE_PHOTOS = 'photos-chine';
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))).then(() => photos()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('chine-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => photosObsoletes())
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
  await photos();
}

// Liste des photos citées dans data.json (diaporama de présentation et images des dossiers)
async function listePhotos() {
  const rep = await caches.match('data.json') || await fetch('data.json');
  const d = await rep.json();
  const diapos = (((d.presentation || {}).diaporama || {}).diapos || []).map((x) => x.photo);
  const dossiers = (d.dossier || []).flatMap((c) => (c.sections || []).map((s) => (s.image || {}).photo));
  return [...new Set(diapos.concat(dossiers).filter(Boolean))];
}
// Met en cache les photos manquantes ; une photo en échec n'empêche pas les autres
let photosEnCours = null;
function photos() {
  if (!photosEnCours) photosEnCours = mettrePhotosEnCache().finally(() => { photosEnCours = null; });
  return photosEnCours;
}
async function mettrePhotosEnCache() {
  try {
    const cache = await caches.open(CACHE_PHOTOS);
    for (const f of await listePhotos()) {
      if (await cache.match(f)) continue;
      try { const rep = await fetch(f); if (rep.ok) await cache.put(f, rep); } catch (err) { /* réessai plus tard */ }
    }
  } catch (err) { /* data.json illisible : réessai à la prochaine ouverture */ }
}
// Retire du cache les photos qui ne figurent plus dans data.json
async function photosObsoletes() {
  try {
    const garder = new Set((await listePhotos()).map((f) => new URL(f, self.registration.scope).href));
    const cache = await caches.open(CACHE_PHOTOS);
    for (const req of await cache.keys()) if (!garder.has(req.url)) await cache.delete(req);
  } catch (err) { /* sans importance */ }
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

  // Photos du diaporama : cache dédié d'abord (adresse exacte : « ?v=2 » dans data.json force le rechargement)
  if (url.pathname.includes('/photos/')) {
    e.respondWith(caches.open(CACHE_PHOTOS).then((c) => c.match(req).then((r) => r || fetch(req).then((rep) => {
      if (rep.ok) c.put(req, rep.clone());
      return rep;
    }))));
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
