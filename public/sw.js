const CACHE_VERSION = "tikanal-v1";
const APP_SHELL = [
  "/",
  "/food",
  "/event",
  "/guide",
  "/hors-ligne",
  "/manifest.webmanifest",
  "/icon.png",
  "/icon-512.png",
];

const PRIVATE_PATHS = [
  "/connexion",
  "/deposer",
  "/mon-espace",
  "/stats",
  "/food/mon-espace",
  "/event/proposer",
  "/annonce/",
  "/food/resto/",
];

function canCachePage(url) {
  return url.origin === self.location.origin
    && !PRIVATE_PATHS.some((path) => url.pathname.startsWith(path))
    && !url.pathname.includes("/modifier");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && canCachePage(url)) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          if (canCachePage(url)) {
            const cached = await caches.match(request);
            if (cached) return cached;
          }
          return caches.match("/hors-ligne");
        })
    );
    return;
  }

  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
