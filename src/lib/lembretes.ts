/** Regras dos lembretes de aula (30 e 15 minutos antes). Sem dependências de servidor, para poder testar. */

export type Antecedencia = 30 | 15;

/**
 * Janelas de envio, em minutos antes do início da aula. O agendador roda a cada 5 minutos;
 * as janelas cobrem duas execuções para tolerar um atraso, e o registro de envio impede repetição.
 */
export const JANELAS: { antecedencia: Antecedencia; acimaDe: number; ate: number }[] = [
  { antecedencia: 30, acimaDe: 20, ate: 30 },
  { antecedencia: 15, acimaDe: 5, ate: 15 },
];

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** "Sáb", "sabado", "SEG" → "sab", "seg". */
export function chaveDia(dia: string) {
  return semAcento(dia).trim().toLowerCase().slice(0, 3);
}

/** Minutos desde a meia-noite do início da aula ("16:00 às 17:30", "17 às 18:30", "16;00 às 17:30"). */
export function inicioDaAula(horario: string | null | undefined): number | null {
  const m = (horario ?? "").trim().match(/^(\d{1,2})(?:\s*[:;h.]\s*(\d{2}))?/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatarHora(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Data (AAAA-MM-DD), dia da semana e minutos do dia no horário de Brasília. */
export function agoraEmBrasilia(agora: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value]),
  );
  const indice = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.weekday ?? "");
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    dia: DIAS[indice] ?? "dom",
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

export type TurmaLembrete = { id: string; modalidade: string; dias_semana: string[] | null; horario: string | null; ativa?: boolean };

export type LembreteDevido = { turma: TurmaLembrete; antecedencia: Antecedencia; inicio: number; faltam: number };

/** Turmas ativas com aula hoje cujo início está dentro de uma janela de lembrete. */
export function lembretesDevidos(turmas: TurmaLembrete[], agora: { dia: string; minutos: number }): LembreteDevido[] {
  const lista: LembreteDevido[] = [];
  for (const turma of turmas) {
    if (turma.ativa === false) continue;
    if (!(turma.dias_semana ?? []).some((d) => chaveDia(d) === agora.dia)) continue;
    const inicio = inicioDaAula(turma.horario);
    if (inicio === null) continue;
    const faltam = inicio - agora.minutos;
    const janela = JANELAS.find((j) => faltam > j.acimaDe && faltam <= j.ate);
    if (janela) lista.push({ turma, antecedencia: janela.antecedencia, inicio, faltam });
  }
  return lista;
}

export function textoLembrete(l: Pick<LembreteDevido, "turma" | "inicio" | "faltam">) {
  return {
    titulo: `Aula de ${l.turma.modalidade} às ${formatarHora(l.inicio)}`,
    mensagem: `Sua aula começa em ${l.faltam} minutos. Até já!`,
  };
}
