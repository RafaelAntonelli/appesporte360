import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Links assinados e temporários das fotos e documentos (para planilhas exportadas pela equipe). */
export const linksArquivosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Só quem pode ver ou editar alunos recebe links (o administrador sempre pode).
    const permitido = await Promise.all(
      ["ver_relatorios", "editar_alunos", "cadastrar_alunos"].map(async (chave) => {
        const { data } = await context.supabase.rpc("pode", { _user_id: context.userId, _permissao: chave });
        return data === true;
      }),
    );
    if (!permitido.some(Boolean)) return { links: {} as Record<string, string>, validoAte: null };
    const { linksArquivosStorage } = await import("@/lib/links-arquivos.server");
    try {
      return await linksArquivosStorage();
    } catch (err) {
      console.error("[planilha] não foi possível gerar os links dos arquivos", err);
      return { links: {} as Record<string, string>, validoAte: null };
    }
  });
