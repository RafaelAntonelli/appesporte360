import { atestadoVencido } from "@/lib/atestado";

/** Situação do aluno mostrada na etiqueta colorida (mesma em Alunos, Turmas e Presença). */
export type SituacaoAluno = "ativo" | "licenca" | "atestado_vencido" | "inativo";

export const ROTULO_SITUACAO: Record<SituacaoAluno, string> = {
  ativo: "Ativo",
  licenca: "Em licença médica",
  atestado_vencido: "Atestado vencido",
  inativo: "Inativo",
};

type AlunoSituacao = {
  ativo?: boolean | null;
  atestado_entregue?: boolean | null;
  atestado_data?: string | null;
};

/**
 * Prioridade: Inativo > Em licença médica > Atestado vencido > Ativo.
 * Usa as mesmas regras de atestado e licença já existentes; não altera dados.
 */
export function situacaoDoAluno(aluno: AlunoSituacao, emLicenca: boolean): SituacaoAluno {
  if (aluno.ativo === false) return "inativo";
  if (emLicenca) return "licenca";
  if (aluno.atestado_entregue === true && atestadoVencido(aluno.atestado_data)) return "atestado_vencido";
  return "ativo";
}
