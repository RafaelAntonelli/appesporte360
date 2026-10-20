/** Envio de notificações pelo Firebase Cloud Messaging (conexão do Firebase do app). Somente servidor. */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export type ConfigWebFirebase = {
  apiKey: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

/** Dados públicos usados pelo navegador para registrar o celular. */
export function configWebFirebase(): ConfigWebFirebase | null {
  const apiKey = process.env["FIREBASE_MESSAGING_WEB_API_KEY"];
  const projectId = process.env["FIREBASE_MESSAGING_PROJECT_ID"];
  const appId = process.env["FIREBASE_MESSAGING_APP_ID"];
  const vapidKey = process.env["FIREBASE_MESSAGING_VAPID_KEY"];
  const messagingSenderId = appId?.split(":")[1] ?? "";
  if (!apiKey || !projectId || !appId || !vapidKey || !messagingSenderId) return null;
  return { apiKey, projectId, appId, vapidKey, messagingSenderId };
}

export type ResultadoPush = { configurado: boolean; enviados: number; invalidos: string[]; erro?: string };

export async function enviarPush(tokens: string[], msg: { titulo: string; mensagem: string; avisoId: string }): Promise<ResultadoPush> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const conexao = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !conexao) return { configurado: false, enviados: 0, invalidos: [] };
  if (!tokens.length) return { configurado: true, enviados: 0, invalidos: [] };

  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": conexao,
    "Content-Type": "application/json",
  };
  let enviados = 0;
  let falhas = 0;
  const invalidos: string[] = [];
  for (let i = 0; i < tokens.length; i += 20) {
    const lote = tokens.slice(i, i + 20);
    await Promise.all(
      lote.map(async (token) => {
        try {
          const resp = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              message: {
                token,
                data: { titulo: msg.titulo, mensagem: msg.mensagem, avisoId: msg.avisoId, url: "/aluno" },
                webpush: { headers: { Urgency: "high", TTL: "86400" } },
              },
            }),
          });
          if (resp.ok) {
            enviados += 1;
            return;
          }
          const texto = await resp.text();
          if (resp.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(texto)) invalidos.push(token);
          else {
            falhas += 1;
            console.error(`[push] falha [${resp.status}]: ${texto.slice(0, 300)}`);
          }
        } catch (e) {
          falhas += 1;
          console.error("[push] rede", e);
        }
      }),
    );
  }
  return { configurado: true, enviados, invalidos, ...(falhas ? { erro: `${falhas} celular(es) não puderam ser notificados agora.` } : {}) };
}
