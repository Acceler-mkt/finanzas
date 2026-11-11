// Guarda en el dispositivo solo la propia app (pantallas, fuentes, iconos) para que abra al
// instante y sin cobertura. Los datos nunca se guardan aquí: van siempre a la base de datos.

const CACHE = 'finanzas-app-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest'])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // La página: primero la red (para recibir versiones nuevas) y, sin conexión, la guardada.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copia));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Archivos de la app (llevan una huella en el nombre): primero lo guardado.
  e.respondWith(
    caches.match(req).then((guardado) => guardado ?? fetch(req).then((res) => {
      if (res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia));
      }
      return res;
    })),
  );
});
