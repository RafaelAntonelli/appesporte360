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

export type ResumoDoDia = { presentes: number; faltas: number; justificadas: number; licenca: number; semMarcacao: number };

export type ContadorChamada = keyof ResumoDoDia | "marcados";

/** As listas usam as mesmas prioridades do resumo; Marcados inclui qualquer registro. */
export function idsDoContador(
  ids: string[],
  contador: ContadorChamada,
  status: (id: string) => string | undefined | null,
  emLicenca: (id: string) => boolean,
) {
  return [...new Set(ids)].filter((id) => {
    const s = status(id);
    if (contador === "marcados") return Boolean(s);
    if (emLicenca(id)) return contador === "licenca";
    if (contador === "licenca") return false;
    if (contador === "presentes") return s === "presente";
    if (contador === "faltas") return s === "falta";
    if (contador === "justificadas") return s === "falta_justificada";
    return !s;
  });
}

/**
 * Resumo do dia para a lista filtrada: quem está em licença médica conta só em "Licença";
 * os demais contam pelo registro do dia, ou em "Sem marcação" quando não há registro.
 */
export function resumoDoDia(
  ids: string[],
  status: (id: string) => string | undefined | null,
  emLicenca: (id: string) => boolean,
): ResumoDoDia {
  const r: ResumoDoDia = { presentes: 0, faltas: 0, justificadas: 0, licenca: 0, semMarcacao: 0 };
  for (const id of new Set(ids)) {
    if (emLicenca(id)) r.licenca++;
    else {
      const s = status(id);
      if (s === "presente") r.presentes++;
      else if (s === "falta") r.faltas++;
      else if (s === "falta_justificada") r.justificadas++;
      else r.semMarcacao++;
    }
  }
  return r;
}
