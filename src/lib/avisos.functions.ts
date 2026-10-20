import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVISO_MENSAGEM_MAX, AVISO_TITULO_MAX, validarAviso } from "@/lib/aluno-acesso";

export type ResultadoEnvioAviso = {
  notificados: number;
  celularesCadastrados: number;
  firebaseConfigurado: boolean;
  erro: string | null;
};

/** Só administradores enviam avisos; a verificação é feita aqui e também nas regras do banco. */
export const enviarAvisoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        titulo: z.string().max(AVISO_TITULO_MAX + 20),
        mensagem: z.string().max(AVISO_MENSAGEM_MAX + 50),
        alunoId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ResultadoEnvioAviso> => {
    const { data: ehAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ehAdmin) throw new Error("Apenas administradores podem enviar avisos.");
    const erro = validarAviso(data.titulo, data.mensagem);
    if (erro) throw new Error(erro);

    if (data.alunoId) {
      const { data: aluno } = await context.supabase.from("alunos").select("id,ativo").eq("id", data.alunoId).maybeSingle();
      if (!aluno?.ativo) throw new Error("Escolha um aluno ativo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: nome } = await supabaseAdmin.rpc("nome_usuario", { _id: context.userId });

    const { data: aviso, error } = await context.supabase
      .from("avisos")
      .insert({
        titulo: data.titulo.trim(),
        mensagem: data.mensagem.trim(),
        aluno_id: data.alunoId,
        enviado_por: context.userId,
        enviado_por_nome: (nome as string | null) ?? null,
      })
      .select("id")
      .single();
    if (error || !aviso) throw new Error("Não foi possível enviar o aviso.");

    let consulta = supabaseAdmin
      .from("aluno_push_tokens")
      .select("token,aluno_id,aluno_aparelhos!inner(status,liberado_ate),alunos!inner(ativo)")
      .eq("aluno_aparelhos.status", "liberado")
      .gt("aluno_aparelhos.liberado_ate", new Date().toISOString())
      .eq("alunos.ativo", true);
    if (data.alunoId) consulta = consulta.eq("aluno_id", data.alunoId);
    const { data: destinos } = await consulta;
    const tokens = [...new Set((destinos ?? []).map((d) => d.token))];

    const { enviarPush } = await import("@/lib/push.server");
    const r = await enviarPush(tokens, { titulo: data.titulo.trim(), mensagem: data.mensagem.trim(), avisoId: aviso.id });
    if (r.invalidos.length) await supabaseAdmin.from("aluno_push_tokens").delete().in("token", r.invalidos);
    await supabaseAdmin.from("avisos").update({ notificados: r.enviados }).eq("id", aviso.id);

    return {
      notificados: r.enviados,
      celularesCadastrados: tokens.length,
      firebaseConfigurado: r.configurado,
      erro: r.erro ?? null,
    };
  });
