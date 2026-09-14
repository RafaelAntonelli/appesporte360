import { unzipSync } from "fflate";

/**
 * Extrai imagens embutidas em um arquivo .xlsx e devolve um mapa
 * linha de dados (0 = primeira linha após o cabeçalho) -> imagem.
 */
export function extrairImagensPlanilha(buffer: ArrayBuffer): Map<number, Blob> {
  const resultado = new Map<number, Blob>();
  try {
    const zip = unzipSync(new Uint8Array(buffer));
    const texto = (caminho: string) => {
      const arquivo = zip[caminho];
      return arquivo ? new TextDecoder().decode(arquivo) : "";
    };

    const planilha = Object.keys(zip).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    if (!planilha) return resultado;
    const nomePlanilha = planilha.split("/").pop() ?? "";

    const relsPlanilha = texto(`xl/worksheets/_rels/${nomePlanilha}.rels`);
    const idDesenho = texto(planilha).match(/<drawing[^>]*r:id="([^"]+)"/)?.[1];
    if (!idDesenho || !relsPlanilha) return resultado;

    const alvoDesenho = relsPlanilha
      .match(new RegExp(`<Relationship[^>]*Id="${idDesenho}"[^>]*Target="([^"]+)"`))?.[1]
      ?.replace("../", "xl/");
    if (!alvoDesenho) return resultado;

    const desenho = texto(alvoDesenho);
    const nomeDesenho = alvoDesenho.split("/").pop() ?? "";
    const relsDesenho = texto(`xl/drawings/_rels/${nomeDesenho}.rels`);
    if (!desenho || !relsDesenho) return resultado;

    const midiaPorId = new Map<string, string>();
    for (const rel of relsDesenho.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      if (rel[1] && rel[2]) midiaPorId.set(rel[1], rel[2].replace("../", "xl/"));
    }

    const ancoras = desenho.match(/<xdr:(twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:\1>/g) ?? [];
    for (const ancora of ancoras) {
      const linha = Number(ancora.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1]);
      const idImagem = ancora.match(/r:embed="([^"]+)"/)?.[1];
      if (!Number.isFinite(linha) || !idImagem) continue;
      const caminho = midiaPorId.get(idImagem);
      const arquivo = caminho ? zip[caminho] : undefined;
      if (!arquivo || !caminho) continue;
      const ext = (caminho.split(".").pop() ?? "png").toLowerCase();
      const tipo = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
      // linha 0 é o cabeçalho
      const indiceDados = linha - 1;
      if (indiceDados >= 0 && !resultado.has(indiceDados)) {
        resultado.set(indiceDados, new Blob([new Uint8Array(arquivo)], { type: tipo }));
      }
    }
  } catch {
    return resultado;
  }
  return resultado;
}
