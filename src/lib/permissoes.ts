import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const PERMISSOES = [
  { chave: "cadastrar_alunos", rotulo: "Cadastrar alunos", descricao: "Fazer novas matrículas e importar alunos." },
  { chave: "editar_alunos", rotulo: "Editar alunos", descricao: "Alterar dados, matrículas e inativar alunos." },
  { chave: "editar_turmas", rotulo: "Editar turmas e horários", descricao: "Criar e alterar turmas, horários e grupos de dias." },
  { chave: "registrar_presenca", rotulo: "Registrar presença", descricao: "Marcar presença, falta e falta justificada." },
  { chave: "gerenciar_licencas", rotulo: "Gerenciar licenças médicas", descricao: "Registrar, prorrogar e concluir licenças." },
  { chave: "gerenciar_fila", rotulo: "Gerenciar a fila de espera", descricao: "Incluir, alterar e retirar pessoas da fila." },
  { chave: "ver_relatorios", rotulo: "Ver relatórios", descricao: "Acessar a tela Relatórios e as exportações." },
  { chave: "editar_configuracoes", rotulo: "Editar configurações", descricao: "Alterar configurações gerais do sistema." },
] as const;

export type ChavePermissao = (typeof PERMISSOES)[number]["chave"];

/** Admin pode tudo; professor depende da permissão ligada (mesma regra da função pode() no banco). */
export function temPermissao(isAdmin: boolean, isProfessor: boolean, ativas: Record<string, boolean>, chave: ChavePermissao) {
  if (isAdmin) return true;
  return isProfessor && ativas[chave] === true;
}

export function ordenarTurmasDoProfessor<T extends { id: string }>(turmas: T[], minhas: Set<string>): T[] {
  if (!minhas.size) return turmas;
  return [...turmas.filter((t) => minhas.has(t.id)), ...turmas.filter((t) => !minhas.has(t.id))];
}

export function usePermissoes() {
  const { user, isAdmin, roles, loading } = useAuth();
  const [ativas, setAtivas] = useState<Record<string, boolean>>({});
  const [minhasTurmas, setMinhasTurmas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let vivo = true;
    void Promise.all([
      supabase.from("permissoes_professor").select("chave,ativo"),
      supabase.from("professor_turmas").select("turma_id").eq("user_id", user.id),
    ]).then(([p, t]) => {
      if (!vivo) return;
      setAtivas(Object.fromEntries((p.data ?? []).map((r) => [r.chave, r.ativo])));
      setMinhasTurmas(new Set((t.data ?? []).map((r) => r.turma_id)));
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [loading, user?.id]);

  const isProfessor = roles.includes("professor");
  return {
    carregando: loading || carregando,
    minhasTurmas,
    pode: (chave: ChavePermissao) => temPermissao(isAdmin, isProfessor, ativas, chave),
  };
}
