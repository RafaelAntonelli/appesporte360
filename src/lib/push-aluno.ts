/** Ativa as notificações no celular (Firebase Cloud Messaging). Chamar só a partir de um clique. */
export type ConfigFirebaseWeb = {
  apiKey: string;
  authDomain?: string;
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
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("As notificações foram bloqueadas. Libere nas configurações do navegador.");
  const registro = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Este navegador não permite notificações. No Android, use o Chrome.");
  const { vapidKey, ...opcoes } = config;
  const app = getApps()[0] ?? initializeApp(opcoes);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registro });
  if (!token) throw new Error("Não foi possível ativar as notificações.");
  return token;
}
