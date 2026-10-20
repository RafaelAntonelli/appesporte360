/** Cópia local (navegador) do aparelho do aluno. Chamar só em efeitos ou eventos. */
import {
  CHAVE_LOCAL_APARELHO,
  CHAVE_LOCAL_CONSENTIMENTO,
  CHAVE_LOCAL_DISPOSITIVO,
  CHAVE_LOCAL_PEDIDO,
} from "@/lib/aluno-acesso";

function ler(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    /* navegador sem armazenamento */
  }
}

export const tokenLocal = () => ler(CHAVE_LOCAL_APARELHO);
export const salvarTokenLocal = (t: string | null) => gravar(CHAVE_LOCAL_APARELHO, t);

export function dispositivoLocal() {
  let id = ler(CHAVE_LOCAL_DISPOSITIVO);
  if (!id) {
    id = crypto.randomUUID();
    gravar(CHAVE_LOCAL_DISPOSITIVO, id);
  }
  return id;
}

export type PedidoLocal = { codigo: string; expiraEm: string };
export function pedidoLocal(): PedidoLocal | null {
  try {
    const p = JSON.parse(ler(CHAVE_LOCAL_PEDIDO) ?? "null") as PedidoLocal | null;
    return p && new Date(p.expiraEm).getTime() > Date.now() ? p : null;
  } catch {
    return null;
  }
}
export const salvarPedidoLocal = (p: PedidoLocal | null) => gravar(CHAVE_LOCAL_PEDIDO, p ? JSON.stringify(p) : null);

/** "sim" | "nao" | null (ainda não respondeu) */
export const consentimentoLocal = () => ler(CHAVE_LOCAL_CONSENTIMENTO);
export const salvarConsentimentoLocal = (v: "sim" | "nao") => gravar(CHAVE_LOCAL_CONSENTIMENTO, v);
