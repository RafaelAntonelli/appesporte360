import { supabase } from "@/integrations/supabase/client";
import { lerCache, salvarCache, contaAtual } from "@/lib/offline";
import { todasPaginas, type MarcaOffline } from "@/lib/offline-regras";
import type { LicencaMedica } from "@/lib/licenca";

export type AlunoSalvo = {
  id: string; nome: string; codigo: string; cpf: string | null; telefone: string | null;
  ativo: boolean; idade: number | null; data_nascimento: string | null;
  atestado_entregue: boolean | null; atestado_data: string | null;
};
export type TurmaSalva = { id: string; nome: string; modalidade: string; horario: string | null; dias_semana: string[]; ativa: boolean; capacidade: number };
export type DadosOffline = {
  userId: string; nome: string; podeChamada: boolean; atualizadoEm: string;
  alunos: AlunoSalvo[]; turmas: TurmaSalva[];
  matriculas: { aluno_id: string; turma_id: string; status: string }[];
  licencas: LicencaMedica[]; presencas: MarcaOffline[];
};
export const lerDadosOffline = () => lerCache<DadosOffline>("dados-offline");
let preparando = false;
export async function prepararDadosOffline() {
  if (preparando || !navigator.onLine) return;
  preparando = true;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== contaAtual()) throw new Error("Entre novamente para atualizar as listas salvas.");
    const userId = data.user.id;
    const staff = await supabase.rpc("is_staff", { _user_id: userId });
    if (staff.error || !staff.data) throw new Error("A conta não tem acesso às listas.");
    const p = await supabase.rpc("pode", { _user_id: userId, _permissao: "registrar_presenca" });
    if (p.error) throw p.error;
    const [alunos, turmas, matriculas, licencas, presencas] = await Promise.all([
      todasPaginas((i, f) => supabase.from("alunos").select("id,nome,codigo,cpf,telefone,ativo,idade,data_nascimento,atestado_entregue,atestado_data").order("id").range(i, f)),
      todasPaginas((i, f) => supabase.from("turmas").select("id,nome,modalidade,horario,dias_semana,ativa,capacidade").order("id").range(i, f)),
      todasPaginas((i, f) => supabase.from("matriculas").select("aluno_id,turma_id,status").eq("status", "ativa").order("id").range(i, f)),
      todasPaginas((i, f) => supabase.from("licencas_medicas").select("id,aluno_id,data_inicio,data_retorno,motivo,anexo_path,status").eq("status", "ativa").order("id").range(i, f)),
      todasPaginas((i, f) => supabase.from("presencas").select("aluno_id,turma_id,data,status,horario,metodo,observacoes").order("id").range(i, f)),
    ]);
    if (contaAtual() !== userId) return;
    const anterior = await lerDadosOffline();
    if (anterior?.alunos.length && !alunos.length) throw new Error("A lista veio vazia; a cópia anterior foi preservada.");
    await salvarCache("dados-offline", {
      userId, nome: String(data.user.user_metadata?.['nome'] ?? "Equipe"), podeChamada: p.data === true,
      atualizadoEm: new Date().toISOString(), alunos, turmas, matriculas, licencas,
      presencas: presencas.filter((r) => ["presente", "falta", "falta_justificada"].includes(r.status)).map((r) => ({ ...r, status: r.status as MarcaOffline["status"] })),
    } satisfies DadosOffline, userId);
    window.dispatchEvent(new Event("listas-offline-atualizadas"));
  } finally { preparando = false; }
}