import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Links diretos (sem pedir acesso) das fotos e documentos guardados no sistema. */
export const linksArquivosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { linksArquivosStorage } = await import("@/lib/links-arquivos.server");
    try {
      return await linksArquivosStorage();
    } catch (err) {
      console.error("[planilha] não foi possível gerar os links dos arquivos", err);
      return {} as Record<string, string>;
    }
  });
