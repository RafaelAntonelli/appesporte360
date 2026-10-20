import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Links assinados e temporários das fotos e documentos (para planilhas exportadas pela equipe). */
export const linksArquivosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ehEquipe } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: podeVer } = await context.supabase.rpc("pode", { uid: context.userId, chave: "ver_relatorios" } as never);
    const { data: podeEditar } = await context.supabase.rpc("pode", { uid: context.userId, chave: "editar_alunos" } as never);
    if (!ehEquipe && !podeVer && !podeEditar) return { links: {} as Record<string, string>, validoAte: null };
    const { linksArquivosStorage } = await import("@/lib/links-arquivos.server");
    try {
      return await linksArquivosStorage();
    } catch (err) {
      console.error("[planilha] não foi possível gerar os links dos arquivos", err);
      return { links: {} as Record<string, string>, validoAte: null };
    }
  });
