const CACHE = "flappy-dolphin-ocean-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./game.js",
  "./manifest.json",
  "./sw.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' helpt om echt de nieuwste files te pakken
    await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  e.respondWith((async () => {
    // 1) Als dit een "page navigation" is (iOS vraagt vaak /flappy-dolphin/),
    // geef altijd index.html uit cache als we offline zijn.
    if (req.mode === "navigate") {
      const cachedIndex = await caches.match("./index.html", { ignoreSearch: true });
      if (cachedIndex) return cachedIndex;
    }

    // 2) Voor alle andere requests: cache-first
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    // 3) Anders probeer netwerk
    try {
      return await fetch(req);
    } catch (err) {
      // 4) Offline fallback (veilig): index.html
      const cachedIndex = await caches.match("./index.html", { ignoreSearch: true });
      if (cachedIndex) return cachedIndex;
      throw err;
    }
  })());
});
