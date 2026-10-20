const CACHE = "esporte-360-v7";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/favicon.ico", "/favicon.png", "/icons/icon-192x192.png", "/icons/icon-512x512.png", "/icons/apple-touch-icon.png"]).catch(() => undefined)));
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

// ---- Avisos para alunos (Firebase Cloud Messaging) ----
self.addEventListener("push", (event) => {
  let carga = {};
  try {
    carga = event.data ? event.data.json() : {};
  } catch {
    carga = {};
  }
  const dados = carga.data || {};
  const notificacao = carga.notification || {};
  const titulo = dados.titulo || notificacao.title || "Esporte 360";
  const corpo = dados.mensagem || notificacao.body || "Você tem um novo aviso.";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(titulo, {
        body: corpo,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: dados.avisoId || undefined,
        data: { url: dados.url || "/aluno" },
      }),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((janelas) => janelas.forEach((j) => j.postMessage({ tipo: "aviso-aluno", titulo, mensagem: corpo }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/aluno", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin) && "focus" in j) {
          return j.navigate(destino).then((w) => (w || j).focus());
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
