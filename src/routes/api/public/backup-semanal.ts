import { createFileRoute } from "@tanstack/react-router";

/** Backup automático semanal (chamado pelo agendador toda segunda-feira). */
export const Route = createFileRoute("/api/public/backup-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const enviado = request.headers.get("x-backup-secret") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cron } = await supabaseAdmin
          .from("backup_cron")
          .select("token")
          .maybeSingle();
        const segredo = cron?.token ?? process.env["BACKUP_CRON_SECRET"];
        if (!segredo || enviado.length !== segredo.length || enviado !== segredo) {
          return new Response("Não autorizado", { status: 401 });
        }
        try {
          const { executarBackupCompleto } = await import("@/lib/backup.server");
          const inicio = new Date().toISOString();
          const resultado = await executarBackupCompleto();
          await supabaseAdmin.from("backup_historico").insert({
            iniciado_em: inicio,
            concluido_em: new Date().toISOString(),
            tipo: "automatico",
            usuario_nome: "Agendamento automático",
            enviados: resultado.imagens,
            total: resultado.total,
            status: resultado.falhas.length ? "falha" : "sucesso",
            planilha_nome: resultado.planilha,
            planilha_id: resultado.planilhaId,
            falhas: resultado.falhas,
            resumo: `${resultado.planilha} · ${resultado.imagens} arquivo(s)`,
          });
          await supabaseAdmin
            .from("backup_cron")
            .update({
              ultimo_backup: new Date().toISOString(),
              ultimo_resultado: `${resultado.planilha} · ${resultado.imagens} imagem(ns)`,
              ultimo_status: resultado.falhas.length > 0 ? "falha" : "sucesso",
            })
            .eq("id", true);
          return Response.json({ ok: true, ...resultado });
        } catch (err) {
          const mensagem = err instanceof Error ? err.message : "Falha no backup";
          console.error("[backup-semanal]", mensagem);
          await supabaseAdmin.from("backup_historico").insert({
            tipo: "automatico",
            usuario_nome: "Agendamento automático",
            concluido_em: new Date().toISOString(),
            status: "falha",
            resumo: mensagem,
          });
          await supabaseAdmin
            .from("backup_cron")
            .update({
              ultimo_backup: new Date().toISOString(),
              ultimo_resultado: mensagem,
              ultimo_status: "falha",
            })
            .eq("id", true);
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }

      },
    },
  },
});
