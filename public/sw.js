const CACHE = "arena-aquatica-v5";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/favicon.ico", "/icons/icon-192x192.png", "/icons/icon-512x512.png", "/icons/apple-touch-icon.png", "/__l5e/assets-v1/b7812670-724f-4961-abc6-5886da4afd01/abertura.mp4"]).catch(() => undefined)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copia = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(async () => {
        const cacheado = await caches.match(req);
        if (cacheado) return cacheado;
        if (req.mode === "navigate") {
          const inicial = await caches.match("/");
          if (inicial) return inicial;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});
