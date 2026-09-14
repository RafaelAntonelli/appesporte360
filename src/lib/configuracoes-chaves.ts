/** Chaves de configuração usadas tanto no cliente quanto no servidor. */
export const CHAVE_PASTA_PLANILHAS = "drive_pasta_planilhas";
export const CHAVE_PASTA_IMAGENS = "drive_pasta_imagens";
export const CHAVE_PASTA_DOCUMENTOS = "drive_pasta_documentos";

/** Tipos de documento que podem ir para subpastas distintas dentro da pasta de documentos. */
export const TIPOS_DOCUMENTO = [
  { campo: "doc_atestado_path", rotulo: "Atestado médico", padrao: "Atestados" },
  { campo: "doc_residencia_path", rotulo: "Comprovante de residência", padrao: "Residência" },
  { campo: "doc_matricula_path", rotulo: "Comprovante de matrícula escolar", padrao: "Matrícula escolar" },
  { campo: "doc_identidade_path", rotulo: "Documento de identidade", padrao: "Identidade" },
] as const;

export type CampoDocumento = (typeof TIPOS_DOCUMENTO)[number]["campo"];

/** Chave de configuração da subpasta de um tipo de documento. */
export function chaveSubpastaDocumento(campo: string) {
  return `drive_subpasta_${campo.replace(/^doc_/, "").replace(/_path$/, "")}`;
}

/** Remove caracteres inválidos de um nome de subpasta. */
export function limparNomeSubpasta(valor?: string | null) {
  return (valor ?? "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

/**
 * Aceita o ID da pasta ou o link completo do Google Drive
 * (ex.: https://drive.google.com/drive/folders/ID?usp=drive_link) e devolve só o ID.
 */
export function extrairIdPastaDrive(valor?: string | null): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) return "";
  const porUrl = bruto.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? bruto.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (porUrl?.[1]) return porUrl[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(bruto) ? bruto : "";
}
