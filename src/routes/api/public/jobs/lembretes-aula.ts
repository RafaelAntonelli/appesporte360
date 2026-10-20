import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Lembretes 30 e 15 minutos antes das aulas (chamado pelo agendador a cada 5 minutos). */
export const Route = createFileRoute("/api/public/jobs/lembretes-aula")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const { enviarLembretesDeAula } = await import("@/lib/lembretes.server");
          return Response.json({ ok: true, ...(await enviarLembretesDeAula()) });
        } catch (e) {
          console.error("[lembretes-aula]", e);
          return Response.json({ ok: false, erro: e instanceof Error ? e.message : "Falha" }, { status: 500 });
        }
      },
    },
  },
});
