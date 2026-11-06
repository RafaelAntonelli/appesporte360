/** Ativa as notificações no celular (Firebase Cloud Messaging). Chamar só a partir de um clique. */
export type ConfigFirebaseWeb = {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export function notificacoesSuportadas() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function obterTokenNotificacao(config: ConfigFirebaseWeb) {
  if (!notificacoesSuportadas()) throw new Error("Este navegador não permite notificações. No Android, use o Chrome.");
  if (window.top !== window.self) throw new Error("Abra o app em uma aba própria (ou no site publicado) para ativar as notificações.");
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("As notificações foram bloqueadas. Libere nas configurações do navegador.");
  const registro = await navigator.serviceWorker.register("/notificacoes/firebase-messaging-sw.js", { scope: "/notificacoes/" });
  if (!registro.active) await new Promise<void>((resolve, reject) => {
    const worker = registro.installing ?? registro.waiting;
    if (!worker) return reject(new Error("Não foi possível preparar as notificações."));
    worker.addEventListener("statechange", () => { if (worker.state === "activated") resolve(); if (worker.state === "redundant") reject(new Error("Tente ativar as notificações novamente.")); });
  });
  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Este navegador não permite notificações. No Android, use o Chrome.");
  const { vapidKey, ...opcoes } = config;
  const app = getApps()[0] ?? initializeApp(opcoes);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registro });
  if (!token) throw new Error("Não foi possível ativar as notificações.");
  return token;
}
