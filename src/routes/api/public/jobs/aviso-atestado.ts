import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Aviso de atestado vencendo (chamado pelo agendador todo dia às 9h de Brasília). */
export const Route = createFileRoute("/api/public/jobs/aviso-atestado")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const { enviarAvisosDeAtestado } = await import("@/lib/aviso-atestado.server");
          return Response.json({ ok: true, ...(await enviarAvisosDeAtestado()) });
        } catch (e) {
          console.error("[aviso-atestado]", e);
          return Response.json({ ok: false, erro: e instanceof Error ? e.message : "Falha" }, { status: 500 });
        }
      },
    },
  },
});
