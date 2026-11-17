/** Aviso ao aluno de atestado médico perto de vencer (7 dias e 1 dia antes). Seguro para o navegador e testável. */

export const ANTECEDENCIAS_ATESTADO = [7, 1] as const;

type AlunoAviso = { id: string; ativo: boolean | null; atestado_entregue: boolean | null; atestado_data: string | null };

/** Vencimento = 1 ano após a data informada, em AAAA-MM-DD (mesma regra de src/lib/atestado.ts). */
export function vencimentoISO(data: string | null | undefined): string | null {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const v = new Date(Date.UTC(a + 1, m - 1, d));
  return v.toISOString().slice(0, 10);
}

function diasEntre(deISO: string, ateISO: string) {
  return Math.round((Date.parse(`${ateISO}T00:00:00Z`) - Date.parse(`${deISO}T00:00:00Z`)) / 86400000);
}

/** Alunos ATIVOS que devem receber o aviso hoje (data de Brasília). Inativos nunca entram. */
export function avisosAtestadoDevidos(alunos: AlunoAviso[], hojeISO: string) {
  const lista: { alunoId: string; vencimento: string; antecedencia: number }[] = [];
  for (const a of alunos) {
    if (a.ativo !== true || a.atestado_entregue !== true) continue;
    const vencimento = vencimentoISO(a.atestado_data);
    if (!vencimento) continue;
    const faltam = diasEntre(hojeISO, vencimento);
    if ((ANTECEDENCIAS_ATESTADO as readonly number[]).includes(faltam)) lista.push({ alunoId: a.id, vencimento, antecedencia: faltam });
  }
  return lista;
}

export function textoAvisoAtestado(vencimento: string, antecedencia: number) {
  const [a, m, d] = vencimento.split("-");
  const quando = antecedencia === 1 ? "vence amanhã" : `vence em ${antecedencia} dias`;
  return {
    titulo: "Seu atestado médico está perto de vencer",
    mensagem: `Seu atestado ${quando} (${d}/${m}/${a}). Leve um novo atestado à administração para continuar nas aulas.`,
  };
}
