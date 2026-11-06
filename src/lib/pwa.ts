export function recusarOffline(hostname: string, producao: boolean, incorporado: boolean, desligado: boolean, delegado = "") {
  const h = hostname.toLowerCase();
  return !producao || incorporado || desligado || (delegado !== "" && h === delegado)
    || /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(h)
    || /^project--.+-dev\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(h)
    || /(?:^|\.)(?:lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(h);
}
export async function registrarOffline() {
  if (!("serviceWorker" in navigator)) return;
  const recusar = recusarOffline(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off");
  if (recusar) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.filter((r) => [r.active, r.waiting, r.installing].some((w) => w && new URL(w.scriptURL).pathname === "/sw.js")).map((r) => r.unregister()));
    await Promise.all((await caches.keys()).filter((n) => /^esporte-360-v\d+$/.test(n)).map((n) => caches.delete(n)));
    return;
  }
  // No auto-reload or skipWaiting: an active call/form is never interrupted.
  await navigator.serviceWorker.register("/sw.js");
}