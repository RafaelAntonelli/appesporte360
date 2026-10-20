/** Utilitários do servidor para o acesso dos alunos. Nunca importar no navegador. */
import { getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import {
  COOKIE_APARELHO,
  JANELA_TENTATIVAS_MIN,
  SESSAO_SEM_LOGIN_SALVO_HORAS,
  VALIDADE_LIBERACAO_DIAS,
  normalizarIdentificador,
  resolverAluno,
  tentativasExcedidas,
  type ResultadoBusca,
} from "@/lib/aluno-acesso";

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function sha256Hex(texto: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesAleatorios(n: number) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function novoTokenAparelho() {
  const b = bytesAleatorios(32);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cookie seguro primeiro; a cópia do navegador cobre visualizações que não mantêm cookies. */
export function tokenDaRequisicao(enviado?: string | null) {
  const cookie = getCookie(COOKIE_APARELHO);
  const t = (cookie || enviado || "").trim();
  return /^[A-Za-z0-9_-]{40,60}$/.test(t) ? t : null;
}

export function gravarCookieAparelho(token: string) {
  setCookie(COOKIE_APARELHO, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: VALIDADE_LIBERACAO_DIAS * 24 * 3600,
  });
}

function ipDaRequisicao() {
  return (
    getRequestHeader("cf-connecting-ip") ||
    getRequestIP({ xForwardedFor: true }) ||
    "desconhecido"
  );
}

/** Registra a tentativa e informa se o limite (rede ou aparelho) foi ultrapassado. */
export async function limiteDeTentativas(dispositivo: string) {
  const db = await admin();
  const rede = await sha256Hex(`rede:${ipDaRequisicao()}`);
  const aparelho = await sha256Hex(`aparelho:${dispositivo || "sem-id"}`);
  const desde = new Date(Date.now() - JANELA_TENTATIVAS_MIN * 60_000).toISOString();
  const [r, a] = await Promise.all([
    db.from("aluno_tentativas_acesso").select("id", { count: "exact", head: true }).eq("rede_hash", rede).gte("created_at", desde),
    db.from("aluno_tentativas_acesso").select("id", { count: "exact", head: true }).eq("aparelho_hash", aparelho).gte("created_at", desde),
  ]);
  if (tentativasExcedidas(r.count ?? 0, a.count ?? 0)) return true;
  await db.from("aluno_tentativas_acesso").insert({ rede_hash: rede, aparelho_hash: aparelho });
  if (Math.random() < 0.05) {
    await db.from("aluno_tentativas_acesso").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  }
  return false;
}

export async function localizarAluno(identificador: string, nascimento: string): Promise<ResultadoBusca> {
  const ident = normalizarIdentificador(identificador);
  if (!ident || !/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return { tipo: "nao_confere" };
  const db = await admin();
  const { data, error } = await db.rpc("localizar_aluno_acesso", { _identificador: ident.valor, _nascimento: nascimento });
  if (error) throw new Error("Não foi possível verificar os dados agora. Tente novamente.");
  return resolverAluno((data ?? []) as { id: string; ativo: boolean }[]);
}

export async function aparelhoPorToken(token: string | null) {
  if (!token) return null;
  const db = await admin();
  const { data } = await db.from("aluno_aparelhos").select("*").eq("token_hash", await sha256Hex(token)).maybeSingle();
  return data;
}

export function fimDaSessao(loginSalvo: boolean, liberadoAte: string | null) {
  if (loginSalvo && liberadoAte) return liberadoAte;
  const curta = new Date(Date.now() + SESSAO_SEM_LOGIN_SALVO_HORAS * 3600_000);
  if (liberadoAte && new Date(liberadoAte) < curta) return liberadoAte;
  return curta.toISOString();
}

export class SessaoAlunoInvalida extends Error {
  constructor() {
    super("Sua sessão terminou. Entre novamente.");
  }
}

/** Exige aparelho liberado, dentro da validade e com sessão ativa; devolve o aluno dono. */
export async function exigirSessaoAluno(enviado?: string | null) {
  const token = tokenDaRequisicao(enviado);
  const aparelho = await aparelhoPorToken(token);
  const agora = Date.now();
  if (
    !aparelho ||
    aparelho.status !== "liberado" ||
    !aparelho.liberado_ate ||
    new Date(aparelho.liberado_ate).getTime() <= agora ||
    !aparelho.sessao_ate ||
    new Date(aparelho.sessao_ate).getTime() <= agora
  ) {
    throw new SessaoAlunoInvalida();
  }
  const db = await admin();
  const { data: aluno } = await db.from("alunos").select("id,ativo").eq("id", aparelho.aluno_id).maybeSingle();
  if (!aluno?.ativo) {
    await db.from("aluno_aparelhos").update({ sessao_ate: null }).eq("id", aparelho.id);
    throw new SessaoAlunoInvalida();
  }
  void db.from("aluno_aparelhos").update({ ultimo_acesso: new Date().toISOString() }).eq("id", aparelho.id).then(() => undefined);
  return { aparelho, alunoId: aparelho.aluno_id, db };
}

export function descricaoAparelho() {
  const ua = getRequestHeader("user-agent") ?? "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os/i.test(ua)) return "Mac";
  return "Navegador";
}
