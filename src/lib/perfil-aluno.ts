/** Textos do "Meu perfil" da Área do Aluno (somente leitura). Browser-safe. */

export const NAO_INFORMADO = "Não informado";

/** Idade completa na data informada (padrão: hoje). Nulo quando a data é inválida. */
export function idadeNaData(nascimento: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return null;
  let idade = hoje.getFullYear() - a;
  const mes = hoje.getMonth() + 1;
  if (mes < m || (mes === m && hoje.getDate() < d)) idade--;
  return idade >= 0 && idade <= 120 ? idade : null;
}

/** "12/03/2012" a partir de "2012-03-12"; nulo quando vazio. */
export function dataBrasileira(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return null;
  return `${d}/${m}/${a}`;
}

/** Ex.: "12/03/2012 (14 anos)". Sem data, mostra só a idade cadastrada (se houver). */
export function textoNascimento(nascimento: string | null | undefined, idadeCadastrada?: number | null, hoje: Date = new Date()): string | null {
  const data = dataBrasileira(nascimento);
  const idade = data ? idadeNaData(nascimento, hoje) : (idadeCadastrada ?? null);
  const anos = idade === null ? "" : `${idade} ${idade === 1 ? "ano" : "anos"}`;
  if (data) return anos ? `${data} (${anos})` : data;
  return anos || null;
}
