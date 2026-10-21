/**
 * Resumo da chamada de uma turma: quantos já têm registro e quem pode ser
 * marcado de uma vez como presente (só quem ainda não tem registro e não está em licença médica).
 */
export function resumoChamada(
  ids: string[],
  marcado: (id: string) => boolean,
  emLicenca: (id: string) => boolean,
) {
  const unicos = Array.from(new Set(ids));
  const semRegistro = unicos.filter((id) => !marcado(id));
  return {
    total: unicos.length,
    marcados: unicos.length - semRegistro.length,
    /** Alunos que "Marcar todos como presentes" vai marcar. */
    pendentes: semRegistro.filter((id) => !emLicenca(id)),
    /** Sem registro, mas em licença: ficam de fora (continuam justificados). */
    emLicenca: semRegistro.filter((id) => emLicenca(id)).length,
  };
}
