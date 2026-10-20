/**
 * Otimização de imagens no aparelho, antes do envio ou da leitura por IA:
 * reduz o lado maior e recomprime em JPEG. PDFs e outros arquivos passam sem mudança.
 */
export const LADO_MAXIMO_IMAGEM = 1600;
export const QUALIDADE_IMAGEM = 0.82;

/** Novas dimensões mantendo a proporção, com o lado maior limitado a `ladoMaximo`. */
export function dimensoesOtimizadas(largura: number, altura: number, ladoMaximo = LADO_MAXIMO_IMAGEM) {
  const maior = Math.max(largura, altura);
  if (!maior || maior <= ladoMaximo) return { largura, altura, reduzida: false };
  const escala = ladoMaximo / maior;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
    reduzida: true,
  };
}

/** Só imagens comuns são otimizadas (GIF animado e SVG ficam como estão). */
export function imagemOtimizavel(tipo: string) {
  return /^image\/(jpeg|jpg|png|webp|bmp|heic|heif)$/i.test(tipo);
}

function trocarExtensao(nome: string) {
  const base = nome.replace(/\.[^./\\]+$/, "") || "imagem";
  return `${base}.jpg`;
}

async function paraBlob(canvas: HTMLCanvasElement | OffscreenCanvas, qualidade: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return await canvas.convertToBlob({ type: "image/jpeg", quality: qualidade });
  return await new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, "image/jpeg", qualidade));
}

/**
 * Redimensiona e comprime a imagem. Em caso de qualquer problema (formato que o navegador
 * não abre, falta de memória), devolve o arquivo original para não impedir o envio.
 */
export async function otimizarImagem(
  arquivo: File | Blob,
  opcoes: { nome?: string; ladoMaximo?: number; qualidade?: number } = {},
): Promise<File> {
  const nome = opcoes.nome ?? (arquivo instanceof File ? arquivo.name : "imagem.jpg");
  const original = arquivo instanceof File ? arquivo : new File([arquivo], nome, { type: arquivo.type });
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined") return original;
  if (!imagemOtimizavel(original.type)) return original;
  try {
    const bitmap = await createImageBitmap(original, { imageOrientation: "from-image" });
    const alvo = dimensoesOtimizadas(bitmap.width, bitmap.height, opcoes.ladoMaximo);
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(alvo.largura, alvo.altura)
        : Object.assign(document.createElement("canvas"), { width: alvo.largura, height: alvo.altura });
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      bitmap.close();
      return original;
    }
    // Fundo branco para imagens com transparência (PNG), já que o JPEG não tem transparência.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, alvo.largura, alvo.altura);
    ctx.drawImage(bitmap, 0, 0, alvo.largura, alvo.altura);
    bitmap.close();
    const blob = await paraBlob(canvas, opcoes.qualidade ?? QUALIDADE_IMAGEM);
    if (!blob) return original;
    // Se não houve redução e o arquivo novo ficou maior, mantém o original.
    if (!alvo.reduzida && blob.size >= original.size && /jpe?g/i.test(original.type)) return original;
    return new File([blob], trocarExtensao(nome), { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return original;
  }
}
