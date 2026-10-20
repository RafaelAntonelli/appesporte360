/** Validade dos links assinados de fotos e documentos (LGPD): sempre temporários. */
export const CHAVE_VALIDADE_LINKS = "links_validade_horas";
export const VALIDADE_LINKS_PADRAO_HORAS = 24;
export const VALIDADE_LINKS_MINIMA_HORAS = 1;
export const VALIDADE_LINKS_MAXIMA_HORAS = 24;
/** Links usados só para mostrar imagens na tela. */
export const VALIDADE_EXIBICAO_SEGUNDOS = 60 * 60;

/** Normaliza o valor configurado para dentro dos limites permitidos. */
export function validadeLinksHoras(valor: unknown) {
  const numero = Math.round(Number(valor));
  if (!Number.isFinite(numero) || numero <= 0) return VALIDADE_LINKS_PADRAO_HORAS;
  return Math.min(VALIDADE_LINKS_MAXIMA_HORAS, Math.max(VALIDADE_LINKS_MINIMA_HORAS, numero));
}
