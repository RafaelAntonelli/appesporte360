/** Envio dos lembretes de aula pelo Firebase. Somente servidor (chamado pelo agendador). */
import { agoraEmBrasilia, lembretesDevidos, textoLembrete } from "@/lib/lembretes";

export async function enviarLembretesDeAula(agora = new Date()) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { enviarPush } = await import("@/lib/push.server");
  const hoje = agoraEmBrasilia(agora);

  const { data: turmas, error } = await db.from("turmas").select("id,modalidade,dias_semana,horario,ativa").eq("ativa", true);
  if (error) throw new Error(`Turmas: ${error.message}`);
  const devidos = lembretesDevidos(turmas ?? [], hoje);
  const resultado: { turma: string; antecedencia: number; celulares: number; enviados: number }[] = [];

  for (const l of devidos) {
    // Reserva o envio; se já existe, outra execução já mandou este lembrete.
    const { data: reservado } = await db
      .from("lembretes_aula_enviados")
      .upsert({ turma_id: l.turma.id, data: hoje.data, antecedencia: l.antecedencia }, { onConflict: "turma_id,data,antecedencia", ignoreDuplicates: true })
      .select("id");
    if (!reservado?.length) continue;

    const { data: mats } = await db.from("matriculas").select("aluno_id").eq("turma_id", l.turma.id).eq("status", "ativa");
    let alunos = [...new Set((mats ?? []).map((m) => m.aluno_id))];
    if (alunos.length) {
      const { data: licencas } = await db
        .from("licencas_medicas")
        .select("aluno_id")
        .eq("status", "ativa")
        .lte("data_inicio", hoje.data)
        .gte("data_retorno", hoje.data)
        .in("aluno_id", alunos);
      const emLicenca = new Set((licencas ?? []).map((x) => x.aluno_id));
      alunos = alunos.filter((id) => !emLicenca.has(id));
    }

    let tokens: string[] = [];
    if (alunos.length) {
      const { data: destinos } = await db
        .from("aluno_push_tokens")
        .select("token,aluno_aparelhos!inner(status,liberado_ate,lembretes_aula),alunos!inner(ativo)")
        .in("aluno_id", alunos)
        .eq("aluno_aparelhos.status", "liberado")
        .eq("aluno_aparelhos.lembretes_aula", true)
        .gt("aluno_aparelhos.liberado_ate", agora.toISOString())
        .eq("alunos.ativo", true);
      tokens = [...new Set((destinos ?? []).map((d) => d.token))];
    }

    const { titulo, mensagem } = textoLembrete(l);
    const r = await enviarPush(tokens, { titulo, mensagem, avisoId: `lembrete-${l.turma.id}-${hoje.data}` });
    if (r.invalidos.length) await db.from("aluno_push_tokens").delete().in("token", r.invalidos);
    await db.from("lembretes_aula_enviados").update({ celulares: tokens.length, enviados: r.enviados }).eq("id", reservado[0]!.id);
    resultado.push({ turma: l.turma.id, antecedencia: l.antecedencia, celulares: tokens.length, enviados: r.enviados });
  }
  return { data: hoje.data, lembretes: resultado };
}
