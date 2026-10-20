/**
 * Regras compartilhadas (navegador e servidor) do acesso dos alunos:
 * login sem senha, liberação presencial do aparelho, avisos e foto do perfil.
 */
import { atestadoVencendo, atestadoVencido, vencimentoAtestado } from "@/lib/atestado";

export const JANELA_TENTATIVAS_MIN = 15;
export const LIMITE_TENTATIVAS_REDE = 60;
export const LIMITE_TENTATIVAS_APARELHO = 10;
/** Validade do pedido de liberação exibido em QR Code (igual ao banco). */
export const VALIDADE_PEDIDO_MIN = 30;
/** Validade da liberação do aparelho (igual à função liberar_aparelho_aluno). */
export const VALIDADE_LIBERACAO_DIAS = 180;
/** Duração do acesso quando o aluno não salvou o login no aparelho. */
export const SESSAO_SEM_LOGIN_SALVO_HORAS = 12;

export const AVISO_TITULO_MAX = 100;
export const AVISO_MENSAGEM_MAX = 1000;

export const FOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFoto = (typeof FOTO_TIPOS)[number];

export const COOKIE_APARELHO = "e360_aparelho";
export const PREFIXO_QR_APARELHO = "E360-APARELHO:";

export const MENSAGENS_ACESSO = {
  muitasTentativas: "Muitas tentativas. Aguarde 15 minutos.",
  inativo: "Compareça à administração para regularizar seu cadastro.",
  procureAdministracao: "Procure a administração!",
  naoConfere: "Os dados não conferem. Confira o CPF ou a matrícula e a data de nascimento.",
  aparelhoNaoLiberado: "Este aparelho ainda não foi liberado. Solicite a liberação e mostre o QR Code na administração.",
} as const;

export function tentativasExcedidas(daRede: number, doAparelho: number) {
  return daRede >= LIMITE_TENTATIVAS_REDE || doAparelho >= LIMITE_TENTATIVAS_APARELHO;
}

export type Identificador = { tipo: "cpf" | "codigo"; valor: string };

/** CPF (11 dígitos) ou código de matrícula (7 letras/números). */
export function normalizarIdentificador(entrada: string): Identificador | null {
  const texto = (entrada ?? "").trim();
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length === 11 && /^[\d.\-\s]+$/.test(texto)) return { tipo: "cpf", valor: digitos };
  const codigo = texto.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (codigo.length === 7) return { tipo: "codigo", valor: codigo };
  return null;
}

export type Correspondencia = { id: string; ativo: boolean };
export type ResultadoBusca = { tipo: "ok"; id: string } | { tipo: "inativo" } | { tipo: "nao_confere" };

/** Só entra quem confere com um único cadastro ativo. */
export function resolverAluno(encontrados: Correspondencia[]): ResultadoBusca {
  const ativos = encontrados.filter((a) => a.ativo);
  if (ativos.length === 1) return { tipo: "ok", id: ativos[0]!.id };
  if (ativos.length === 0 && encontrados.length > 0) return { tipo: "inativo" };
  return { tipo: "nao_confere" };
}

const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizarCodigoAparelho(texto: string) {
  const limpo = (texto ?? "").trim();
  const semPrefixo = limpo.toUpperCase().startsWith(PREFIXO_QR_APARELHO) ? limpo.slice(PREFIXO_QR_APARELHO.length) : limpo;
  return semPrefixo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function codigoAparelhoValido(codigo: string) {
  return codigo.length === 8 && [...codigo].every((c) => ALFABETO_CODIGO.includes(c));
}

export function formatarCodigoAparelho(codigo: string) {
  const c = normalizarCodigoAparelho(codigo);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function gerarCodigoAparelho(aleatorio: (n: number) => Uint8Array) {
  const bytes = aleatorio(8);
  return [...bytes].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

export function conteudoQrAparelho(codigo: string) {
  return `${PREFIXO_QR_APARELHO}${normalizarCodigoAparelho(codigo)}`;
}

export type SituacaoAtestado = "valido" | "vencendo" | "vencido" | "nao_entregue";

export function situacaoAtestado(aluno: { atestado_entregue?: boolean | null; atestado_data?: string | null }): SituacaoAtestado {
  if (!aluno.atestado_entregue || !vencimentoAtestado(aluno.atestado_data)) return "nao_entregue";
  if (atestadoVencido(aluno.atestado_data)) return "vencido";
  if (atestadoVencendo(aluno.atestado_data)) return "vencendo";
  return "valido";
}

export function validarAviso(titulo: string, mensagem: string): string | null {
  const t = (titulo ?? "").trim();
  const m = (mensagem ?? "").trim();
  if (!t) return "Informe o título do aviso.";
  if (t.length > AVISO_TITULO_MAX) return `O título pode ter até ${AVISO_TITULO_MAX} caracteres.`;
  if (!m) return "Escreva a mensagem do aviso.";
  if (m.length > AVISO_MENSAGEM_MAX) return `A mensagem pode ter até ${AVISO_MENSAGEM_MAX} caracteres.`;
  return null;
}

/** Identifica JPG, PNG ou WebP pelos primeiros bytes do arquivo. */
export function tipoDaFoto(b: Uint8Array): TipoFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  return null;
}

export function validarFoto(tamanho: number, tipoInformado: string): string | null {
  if (!FOTO_TIPOS.includes(tipoInformado as TipoFoto)) return "Envie uma foto JPG, PNG ou WebP.";
  if (tamanho > FOTO_MAX_BYTES) return "A foto pode ter até 5 MB.";
  if (tamanho <= 0) return "Arquivo vazio.";
  return null;
}

export function validarEmail(email: string) {
  const e = (email ?? "").trim();
  return !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

export function validarTelefone(telefone: string) {
  const d = (telefone ?? "").replace(/\D/g, "");
  return !d || d.length === 10 || d.length === 11;
}

/** Chaves do navegador: cópia do aparelho (algumas visualizações não mantêm cookies). */
export const CHAVE_LOCAL_APARELHO = "esporte360.aluno.aparelho";
export const CHAVE_LOCAL_DISPOSITIVO = "esporte360.aluno.dispositivo";
export const CHAVE_LOCAL_PEDIDO = "esporte360.aluno.pedido";
export const CHAVE_LOCAL_CONSENTIMENTO = "esporte360.aluno.consentimento";
