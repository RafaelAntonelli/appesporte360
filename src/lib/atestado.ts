/** Regras de validade do atestado médico (1 ano a partir da data informada). */

export const PRAZO_AVISO_PADRAO = 30;

export function vencimentoAtestado(data: string | null | undefined) {
  if (!data) return null;
  const limite = new Date(`${data}T00:00:00`);
  if (Number.isNaN(limite.getTime())) return null;
  limite.setFullYear(limite.getFullYear() + 1);
  return limite;
}

export function atestadoVencido(data: string | null | undefined) {
  const limite = vencimentoAtestado(data);
  return limite ? limite < new Date() : false;
}

/** Vence dentro do prazo de aviso configurado (ainda válido). */
export function atestadoVencendo(data: string | null | undefined, dias = PRAZO_AVISO_PADRAO) {
  const limite = vencimentoAtestado(data);
  if (!limite) return false;
  const hoje = new Date();
  const aviso = new Date(hoje);
  aviso.setDate(aviso.getDate() + dias);
  return limite >= hoje && limite <= aviso;
}

export function diasParaVencer(data: string | null | undefined) {
  const limite = vencimentoAtestado(data);
  if (!limite) return 0;
  return Math.max(0, Math.ceil((limite.getTime() - Date.now()) / 86400000));
}
