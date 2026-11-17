/** Envio diário (9h de Brasília) do aviso de atestado vencendo. Somente servidor. */
import { agoraEmBrasilia } from "@/lib/lembretes";
import { avisosAtestadoDevidos, textoAvisoAtestado } from "@/lib/aviso-atestado";

export async function enviarAvisosDeAtestado(agora = new Date()) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { enviarPush } = await import("@/lib/push.server");
  const hoje = agoraEmBrasilia(agora).data;

  const alunos: { id: string; ativo: boolean; atestado_entregue: boolean | null; atestado_data: string | null }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("alunos")
      .select("id,ativo,atestado_entregue,atestado_data")
      .eq("ativo", true)
      .eq("atestado_entregue", true)
      .not("atestado_data", "is", null)
      .order("id")
      .range(de, de + 999);
    if (error) throw new Error(`Alunos: ${error.message}`);
    alunos.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const resultado: { aluno: string; antecedencia: number; enviados: number }[] = [];
  for (const d of avisosAtestadoDevidos(alunos, hoje)) {
    // Reserva: se já existe, este aviso já foi enviado antes e não se repete.
    const { data: reservado } = await db
      .from("avisos_atestado_enviados")
      .upsert({ aluno_id: d.alunoId, vencimento: d.vencimento, antecedencia: d.antecedencia }, { onConflict: "aluno_id,vencimento,antecedencia", ignoreDuplicates: true })
      .select("id");
    if (!reservado?.length) continue;

    const { titulo, mensagem } = textoAvisoAtestado(d.vencimento, d.antecedencia);
    // Primeiro guarda na central de avisos do aluno; o celular vem depois.
    const { data: aviso, error } = await db
      .from("avisos")
      .insert({ titulo, mensagem, aluno_id: d.alunoId, enviado_por: null, enviado_por_nome: "Sistema" })
      .select("id")
      .single();
    if (error || !aviso) {
      await db.from("avisos_atestado_enviados").delete().eq("id", reservado[0]!.id);
      console.error("[aviso-atestado] aviso", error?.message);
      continue;
    }

    const { data: destinos } = await db
      .from("aluno_push_tokens")
      .select("token,aluno_aparelhos!inner(status,liberado_ate),alunos!inner(ativo)")
      .eq("aluno_id", d.alunoId)
      .eq("aluno_aparelhos.status", "liberado")
      .gt("aluno_aparelhos.liberado_ate", agora.toISOString())
      .eq("alunos.ativo", true);
    const tokens = [...new Set((destinos ?? []).map((x) => x.token))];
    const r = await enviarPush(tokens, { titulo, mensagem, avisoId: aviso.id });
    if (r.invalidos.length) await db.from("aluno_push_tokens").delete().in("token", r.invalidos);
    await db.from("avisos").update({ notificados: r.enviados }).eq("id", aviso.id);
    await db.from("avisos_atestado_enviados").update({ aviso_id: aviso.id, enviados: r.enviados }).eq("id", reservado[0]!.id);
    resultado.push({ aluno: d.alunoId, antecedencia: d.antecedencia, enviados: r.enviados });
  }
  return { data: hoje, avisos: resultado };
}
