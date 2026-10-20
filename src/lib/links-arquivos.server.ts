import { chaveLinkDrive, DOCUMENTOS_PLANILHA, type LinksTemporarios } from "@/lib/planilha-alunos";
import { CHAVE_VALIDADE_LINKS, validadeLinksHoras } from "@/lib/links-seguros";

const LOTE = 100;

/** Validade configurada (em horas) para os links de fotos e documentos. */
export async function horasValidadeLinks() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("configuracoes").select("valor").eq("chave", CHAVE_VALIDADE_LINKS).maybeSingle();
  return validadeLinksHoras(data?.valor);
}

/**
 * Monta o mapa de links dos arquivos guardados no próprio sistema.
 * São links assinados e temporários (validade configurada pelo administrador, no máximo 24 h).
 * Chave: 8 primeiros caracteres do id do aluno + tipo (ex.: "a1b2c3d4|foto").
 */
export async function linksArquivosStorage(): Promise<LinksTemporarios> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const horas = await horasValidadeLinks();
  const segundos = horas * 60 * 60;
  const validoAte = new Date(Date.now() + segundos * 1000).toISOString();
  const campos = ["foto_path", ...DOCUMENTOS_PLANILHA.map((d) => d.campo as string)];
  const { data: alunos, error } = await supabaseAdmin
    .from("alunos")
    .select(["id", ...campos].join(","));
  if (error) throw error;

  const pares: { chave: string; caminho: string }[] = [];
  for (const registro of (alunos ?? []) as unknown as Record<string, string | null>[]) {
    const id = registro["id"];
    if (!id) continue;
    for (const campo of campos) {
      const caminho = registro[campo];
      if (caminho) pares.push({ chave: chaveLinkDrive(id, campo), caminho });
    }
  }

  const links: Record<string, string> = {};
  for (let i = 0; i < pares.length; i += LOTE) {
    const parte = pares.slice(i, i + LOTE);
    const { data } = await supabaseAdmin.storage
      .from("fotos-alunos")
      .createSignedUrls(parte.map((p) => p.caminho), segundos);
    (data ?? []).forEach((item, indice) => {
      const par = parte[indice];
      if (par && item?.signedUrl && !item.error) links[par.chave] = item.signedUrl;
    });
  }
  return { links, validoAte };
}
