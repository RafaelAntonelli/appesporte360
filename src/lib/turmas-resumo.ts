/**
 * Números dos cartões de resumo da tela Turmas. Usa a mesma contagem do
 * "X de Y vagas" de cada cartão de turma, para os totais sempre baterem.
 */
export function resumoTurmas(
  turmas: { id: string; ativa: boolean; capacidade: number | null }[],
  contagem: Record<string, number>,
) {
  const ativas = turmas.filter((t) => t.ativa);
  return {
    abertas: ativas.length,
    vagas: ativas.reduce((soma, t) => soma + (t.capacidade ?? 0), 0),
    ocupadas: ativas.reduce((soma, t) => soma + (contagem[t.id] ?? 0), 0),
  };
}

/** Número no formato brasileiro (ex.: 1.219). */
export function numeroBR(valor: number) {
  return valor.toLocaleString("pt-BR");
}
