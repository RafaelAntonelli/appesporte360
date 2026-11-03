/**
 * Falta automática (browser-safe). A verificação em si roda no banco, nos horários de cada turma;
 * aqui ficam as opções de prazo e os textos mostrados no cartão da Presença.
 */

export const METODO_AUTOMATICO = "automatica";

/** Prazo padrão, em minutos depois do início da aula. */
export const MINUTOS_PADRAO = 15;

/** Opções de prazo: de 5 a 60 minutos, de 5 em 5. */
export const OPCOES_MINUTOS: number[] = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

export type ConfigFaltaAutomatica = { ativa: boolean; minutos: number };

/** Começa desligada. */
export const CONFIG_PADRAO: ConfigFaltaAutomatica = { ativa: false, minutos: MINUTOS_PADRAO };

export function prazoValido(minutos: number) {
  return OPCOES_MINUTOS.includes(minutos);
}

export function ehFaltaAutomatica(metodo: string | null | undefined) {
  return metodo === METODO_AUTOMATICO;
}

export function textoEstadoFaltaAutomatica({ ativa, minutos }: ConfigFaltaAutomatica) {
  return ativa
    ? `Ligada: ${minutos} minutos após o início de cada aula, quem ainda não tem registro recebe falta.`
    : "Desligada: nenhuma falta é lançada automaticamente.";
}

export function textoConfirmacaoFaltaAutomatica(minutos: number) {
  return (
    `Nos dias de aula de cada turma, ${minutos} minutos após o início, os alunos ativos matriculados ` +
    `que ainda não tiverem registro de presença naquele dia receberão "Falta" automaticamente. ` +
    `Quem está em licença médica e quem já tem registro (presente, falta ou justificada) não muda. ` +
    `Se alguém da equipe marcar o aluno depois, a marcação da equipe substitui a falta automática.`
  );
}
