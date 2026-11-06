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
  const alvo = new URL((event.notification.data && event.notification.data.url) || "/aluno", self.location.origin);
  const destino = alvo.origin === self.location.origin ? alvo.href : new URL("/aluno", self.location.origin).href;
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
