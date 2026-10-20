/** Envio de notificações pelo Firebase Cloud Messaging (API HTTP v1). Somente servidor. */

type ContaServico = { project_id: string; client_email: string; private_key: string };

export function contaFirebase(): ContaServico | null {
  const bruto = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Partial<ContaServico>;
    if (!c.project_id || !c.client_email || !c.private_key) return null;
    return c as ContaServico;
  } catch {
    return null;
  }
}

export type ConfigWebFirebase = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export function configWebFirebase(): ConfigWebFirebase | null {
  const bruto = process.env["FIREBASE_WEB_CONFIG"];
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Partial<ConfigWebFirebase>;
    if (!c.apiKey || !c.projectId || !c.messagingSenderId || !c.appId || !c.vapidKey) return null;
    return {
      apiKey: c.apiKey,
      ...(c.authDomain ? { authDomain: c.authDomain } : {}),
      projectId: c.projectId,
      messagingSenderId: c.messagingSenderId,
      appId: c.appId,
      vapidKey: c.vapidKey,
    };
  } catch {
    return null;
  }
}

function base64url(dados: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenDeAcesso(conta: ContaServico) {
  const pem = conta.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const assinatura = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(`${cabecalho}.${corpo}`));
  const jwt = `${cabecalho}.${corpo}.${base64url(assinatura)}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!resp.ok) throw new Error(`Firebase recusou as credenciais (HTTP ${resp.status}).`);
  const json = (await resp.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Firebase não devolveu o acesso.");
  return json.access_token;
}

export type ResultadoPush = { configurado: boolean; enviados: number; invalidos: string[]; erro?: string };

export async function enviarPush(tokens: string[], msg: { titulo: string; mensagem: string; avisoId: string }): Promise<ResultadoPush> {
  const conta = contaFirebase();
  if (!conta) return { configurado: false, enviados: 0, invalidos: [] };
  if (!tokens.length) return { configurado: true, enviados: 0, invalidos: [] };
  let acesso: string;
  try {
    acesso = await tokenDeAcesso(conta);
  } catch (e) {
    console.error("[push] credenciais", e);
    return { configurado: true, enviados: 0, invalidos: [], erro: "Não foi possível conectar ao Firebase." };
  }
  const url = `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`;
  let enviados = 0;
  const invalidos: string[] = [];
  for (let i = 0; i < tokens.length; i += 20) {
    const lote = tokens.slice(i, i + 20);
    await Promise.all(
      lote.map(async (token) => {
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: { authorization: `Bearer ${acesso}`, "content-type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                data: { titulo: msg.titulo, mensagem: msg.mensagem, avisoId: msg.avisoId, url: "/aluno" },
                webpush: { headers: { Urgency: "high", TTL: "86400" } },
                android: { priority: "high" },
              },
            }),
          });
          if (resp.ok) {
            enviados += 1;
            return;
          }
          const texto = await resp.text();
          if (resp.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(texto)) invalidos.push(token);
          else console.error("[push] falha", resp.status, texto.slice(0, 300));
        } catch (e) {
          console.error("[push] rede", e);
        }
      }),
    );
  }
  return { configurado: true, enviados, invalidos };
}
