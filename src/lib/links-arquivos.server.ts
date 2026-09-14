import { chaveLinkDrive, DOCUMENTOS_PLANILHA } from "@/lib/planilha-alunos";

/** Validade dos links gerados: 10 anos (links abrem sem login e sem pedir acesso). */
const VALIDADE_SEGUNDOS = 60 * 60 * 24 * 365 * 10;
const LOTE = 100;

/**
 * Monta o mapa de links dos arquivos guardados no próprio sistema.
 * São links assinados: abrem direto no navegador, sem pedir permissão de acesso.
 * Chave: 8 primeiros caracteres do id do aluno + tipo (ex.: "a1b2c3d4|foto").
 */
export async function linksArquivosStorage(): Promise<Record<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

  const mapa: Record<string, string> = {};
  for (let i = 0; i < pares.length; i += LOTE) {
    const parte = pares.slice(i, i + LOTE);
    const { data } = await supabaseAdmin.storage
      .from("fotos-alunos")
      .createSignedUrls(parte.map((p) => p.caminho), VALIDADE_SEGUNDOS);
    (data ?? []).forEach((item, indice) => {
      const par = parte[indice];
      if (par && item?.signedUrl && !item.error) mapa[par.chave] = item.signedUrl;
    });
  }
  return mapa;
}
