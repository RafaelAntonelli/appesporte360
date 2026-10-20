/**
 * Nomes dos arquivos de fotos e documentos guardados no Google Drive.
 * Padrão: [CODIGO_MATRICULA]_[TIPO_DOCUMENTO].[extensão] — ex.: A7B92K1_atestado.pdf.
 * O código de matrícula no nome é o que liga cada arquivo ao aluno na restauração,
 * mesmo quando há alunos com nomes iguais.
 */
export const TIPOS_ARQUIVO_DRIVE = [
  { campo: "foto_path", tipo: "foto" },
  { campo: "doc_atestado_path", tipo: "atestado" },
  { campo: "doc_residencia_path", tipo: "comprovante_residencia" },
  { campo: "doc_matricula_path", tipo: "comprovante_matricula" },
  { campo: "doc_identidade_path", tipo: "identidade" },
  { campo: "doc_ficha_path", tipo: "ficha" },
] as const;

export type CampoArquivoDrive = (typeof TIPOS_ARQUIVO_DRIVE)[number]["campo"];

const EXTENSOES = new Set(["jpg", "jpeg", "png", "webp", "pdf", "heic", "heif", "gif"]);

/** Extensão (minúscula) do caminho do arquivo; "jpg" quando não for reconhecida. */
export function extensaoArquivo(caminho: string) {
  const ext = (caminho.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
  if (!EXTENSOES.has(ext)) return "jpg";
  return ext === "jpeg" ? "jpg" : ext;
}

export function tipoArquivoDrive(campo: string) {
  return TIPOS_ARQUIVO_DRIVE.find((t) => t.campo === campo)?.tipo ?? null;
}

/** Início do nome no Drive (sem a extensão), usado para achar a versão anterior do mesmo arquivo. */
export function prefixoArquivoDrive(codigo: string, campo: string) {
  const tipo = tipoArquivoDrive(campo);
  if (!tipo) throw new Error(`Tipo de arquivo desconhecido: ${campo}`);
  return `${codigo.trim().toUpperCase()}_${tipo}.`;
}

/** Nome final do arquivo no Drive. */
export function nomeArquivoDrive(codigo: string, campo: string, caminho: string) {
  return `${prefixoArquivoDrive(codigo, campo)}${extensaoArquivo(caminho)}`;
}

/** Lê um nome no padrão do Drive e devolve código, campo e extensão (ou null se não seguir o padrão). */
export function lerNomeArquivoDrive(nome: string) {
  const m = nome.trim().match(/^([A-Za-z0-9]{7})_([a-z_]+)\.([A-Za-z0-9]{2,5})$/);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  const tipo = TIPOS_ARQUIVO_DRIVE.find((t) => t.tipo === m[2]);
  if (!tipo) return null;
  return { codigo: m[1].toUpperCase(), campo: tipo.campo, tipo: tipo.tipo, extensao: extensaoArquivo(`x.${m[3]}`) };
}

export function tipoConteudoArquivo(caminho: string) {
  const ext = extensaoArquivo(caminho);
  if (ext === "png") return "image/png";
  if (ext === "pdf") return "application/pdf";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return `image/${ext}`;
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}
