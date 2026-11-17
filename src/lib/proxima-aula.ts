/** Próxima aula do aluno (horário de Brasília). A aula em andamento continua sendo a próxima até terminar. */
import { agoraEmBrasilia, chaveDia, inicioDaAula } from "@/lib/lembretes";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const NOMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

type TurmaAula = { id: string; nome: string; dias: string[]; horario: string | null };

/** Fim da aula em minutos ("18:00 às 18:50"); sem fim informado, considera 1 hora. */
export function fimDaAula(horario: string | null | undefined): number | null {
  const inicio = inicioDaAula(horario);
  if (inicio === null) return null;
  const m = (horario ?? "").match(/(?:às|as|a|-|–)\s*(\d{1,2})(?:\s*[:;h.]\s*(\d{2}))?\s*$/i);
  if (m) {
    const fim = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
    if (fim > inicio && fim < 24 * 60) return fim;
  }
  return inicio + 60;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export type ProximaAula = { turma: TurmaAula; texto: string; emAndamento: boolean };

export function proximaAula(turmas: TurmaAula[], agora = new Date()): ProximaAula | null {
  const br = agoraEmBrasilia(agora);
  const [a, m, d] = br.data.split("-").map(Number) as [number, number, number];
  const hojeIdx = DIAS.indexOf(br.dia);
  for (let k = 0; k < 8; k++) {
    const idx = (hojeIdx + k) % 7;
    const candidatas = turmas
      .map((t) => ({ t, inicio: inicioDaAula(t.horario), fim: fimDaAula(t.horario) }))
      .filter((c): c is { t: TurmaAula; inicio: number; fim: number } => c.inicio !== null && c.fim !== null)
      .filter((c) => c.t.dias.some((dia) => chaveDia(dia) === DIAS[idx]))
      .filter((c) => k > 0 || br.minutos < c.fim)
      .sort((x, y) => x.inicio - y.inicio);
    const c = candidatas[0];
    if (!c) continue;
    const faixa = `${hhmm(c.inicio)} às ${hhmm(c.fim)}`;
    const data = new Date(Date.UTC(a, m - 1, d + k));
    const ddmm = `${String(data.getUTCDate()).padStart(2, "0")}/${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
    const texto = k === 0 ? `Hoje, ${faixa}` : k === 1 ? `Amanhã, ${faixa}` : `${NOMES[idx]}, ${faixa} · ${ddmm}`;
    return { turma: c.t, texto, emAndamento: k === 0 && br.minutos >= c.inicio };
  }
  return null;
}
