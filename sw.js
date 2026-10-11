// BST SRL - Service worker del Gestionale Rapporti (PWA)
// Pubblicazione: GitHub Pages (HTTPS). Tutti i file nella stessa cartella di index.html.
// - Pagina (index.html): PRIMA LA RETE, poi la copia in cache se si è offline.
//   Con la connessione arriva sempre l'ultima versione pubblicata: niente più "copia vecchia" sul telefono.
// - Librerie da CDN (Tailwind, icone, jsPDF, Firebase): copia in cache aggiornata in background.
// - Firestore e login Firebase NON passano da qui: la coda offline delle schede la gestisce Firestore.
const CACHE = 'bst-rapporti-v1';
const CDN = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png']).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(chiavi => Promise.all(chiavi.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pagina dell'app: prima la rete, cache solo se offline
  if (req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    // "no-cache": chiede sempre al server se c'è una versione nuova (GitHub Pages altrimenti la tiene 10 minuti in cache)
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => {
          if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copia)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Librerie esterne: risposta immediata dalla cache, aggiornata in background
  if (CDN.includes(url.hostname) && !url.pathname.includes('/firestore/') ) {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(inCache => {
        const rete = fetch(req)
          .then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; })
          .catch(() => inCache);
        return inCache || rete;
      }))
    );
    return;
  }

  // Icone e manifest: cache, poi rete
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
