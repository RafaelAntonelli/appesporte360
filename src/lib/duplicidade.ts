export type AlunoBasico = {
  id: string;
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
};

export type DadosMatricula = {
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
};

function normalizarNome(nome: string) {
  return nome.trim().toLowerCase();
}

/**
 * Critério único de duplicidade (mesmo usado pelo banco de dados):
 * mesmo nome + mesma data de nascimento.
 * CPF NUNCA é considerado: famílias usam o CPF do responsável para vários alunos.
 * Telefone NUNCA é considerado: irmãos/famílias compartilham o número.
 * Retorna o aluno duplicado ou null.
 */
export function encontrarAlunoDuplicado<T extends AlunoBasico>(
  dados: DadosMatricula,
  alunos: T[],
  ignorarId?: string | null,
): T | null {
  const nomeNovo = normalizarNome(dados.nome ?? "");
  if (!nomeNovo || !dados.data_nascimento) return null;

  for (const a of alunos) {
    if (ignorarId && a.id === ignorarId) continue;
    if (normalizarNome(a.nome) !== nomeNovo) continue;
    if (a.data_nascimento && a.data_nascimento === dados.data_nascimento) return a;
  }
  return null;
}

