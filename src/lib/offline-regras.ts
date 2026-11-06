export type StatusOffline = "presente" | "falta" | "falta_justificada";
export type MarcaOffline = {
  aluno_id: string; turma_id: string | null; data: string; status: StatusOffline;
  horario: string; metodo: string; observacoes: string | null;
};
export type AcaoChamada = {
  tipo: "presenca" | "presenca_remover"; aluno_id: string; turma_id: string | null;
  data: string; horario: string; status?: string; metodo?: string; observacoes?: string | null;
};
export function chaveMarca(m: Pick<MarcaOffline, "aluno_id" | "turma_id" | "data">) {
  return `${m.data}:${m.turma_id ?? ""}:${m.aluno_id}`;
}
export function sobreporPendentes(base: MarcaOffline[], acoes: AcaoChamada[]): MarcaOffline[] {
  const mapa = new Map(base.map((r) => [chaveMarca(r), r]));
  for (const a of acoes) {
    if (a.tipo === "presenca_remover") mapa.delete(chaveMarca(a));
    else if (["presente", "falta", "falta_justificada"].includes(a.status ?? "")) {
      mapa.set(chaveMarca(a), { ...a, status: a.status as StatusOffline, metodo: a.metodo ?? "manual", observacoes: a.observacoes ?? null });
    }
  }
  return [...mapa.values()];
}
/** Paginação estável; falha em qualquer página invalida a atualização inteira. */
export async function todasPaginas<T>(pagina: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>, tamanho = 500): Promise<T[]> {
  const resultado: T[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const r = await pagina(inicio, inicio + tamanho - 1);
    if (r.error || !r.data) throw r.error ?? new Error("A lista não foi recebida por completo.");
    resultado.push(...r.data);
    if (r.data.length < tamanho) return resultado;
  }
}