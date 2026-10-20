import {
  CHAVE_PASTA_DOCUMENTOS,
  CHAVE_PASTA_IMAGENS,
  CHAVE_PASTA_PLANILHAS,
  TIPOS_DOCUMENTO,
  chaveSubpastaDocumento,
  extrairIdPastaDrive,
  limparNomeSubpasta,
} from "@/lib/configuracoes-chaves";
import { montarPlanilhaAlunos, type AlunoPlanilha } from "@/lib/planilha-alunos";
import { nomeArquivoDrive, prefixoArquivoDrive, tipoArquivoDrive, tipoConteudoArquivo } from "@/lib/arquivos-drive";

export const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
export const MIME_PASTA = "application/vnd.google-apps.folder";

/** Pasta padrão do Drive para as planilhas de exportação. */
export const PASTA_PLANILHAS = "1xCkat_TA0nT_zOW2yzw0myflN8jBO65n";
/** Pasta padrão do Drive para as fotos dos alunos. */
export const PASTA_IMAGENS = "1j7Llm91Q2Zp0JfFg1afhPRADDO_KmoOz";
/** Pasta padrão do Drive para as imagens dos documentos dos alunos. */
export const PASTA_DOCUMENTOS = "1o-dAKikn44JlISnEK7IwUNrv-apownZ3";

export type PastasDrive = {
  planilhas: string;
  fotos: string;
  documentos: string;
  /** Nome da subpasta (dentro da pasta de documentos) por tipo de documento. */
  subpastas: Record<string, string>;
};

async function lerConfiguracoes(chaves: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("configuracoes").select("chave,valor").in("chave", chaves);
  return new Map((data ?? []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]));
}

/** Lê as pastas de destino configuradas pelo administrador (com fallback para os padrões). */
export async function pastasDrive(): Promise<PastasDrive> {
  const padrao: PastasDrive = {
    planilhas: PASTA_PLANILHAS,
    fotos: PASTA_IMAGENS,
    documentos: PASTA_DOCUMENTOS,
    subpastas: {},
  };
  try {
    const chavesSub = TIPOS_DOCUMENTO.map((t) => chaveSubpastaDocumento(t.campo));
    const mapa = await lerConfiguracoes([
      CHAVE_PASTA_PLANILHAS,
      CHAVE_PASTA_IMAGENS,
      CHAVE_PASTA_DOCUMENTOS,
      ...chavesSub,
    ]);
    const subpastas: Record<string, string> = {};
    for (const tipo of TIPOS_DOCUMENTO) {
      subpastas[tipo.campo] = limparNomeSubpasta(mapa.get(chaveSubpastaDocumento(tipo.campo)));
    }
    return {
      planilhas: extrairIdPastaDrive(mapa.get(CHAVE_PASTA_PLANILHAS)) || PASTA_PLANILHAS,
      fotos: extrairIdPastaDrive(mapa.get(CHAVE_PASTA_IMAGENS)) || PASTA_IMAGENS,
      documentos: extrairIdPastaDrive(mapa.get(CHAVE_PASTA_DOCUMENTOS)) || PASTA_DOCUMENTOS,
      subpastas,
    };
  } catch (err) {
    console.error("[backup] não foi possível ler as pastas configuradas", err);
    return padrao;
  }
}

export function cabecalhosDrive() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conexao = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovable || !conexao) {
    throw new Error("Conexão com o Google Drive não configurada. Reconecte o Google Drive nos conectores.");
  }
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conexao,
  };
}

export class ErroDrive extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

export async function erroDrive(resp: Response) {
  const corpo = await resp.text();
  console.error(`[backup] Google Drive [${resp.status}]: ${corpo}`);
  return new ErroDrive(resp.status, `Google Drive respondeu ${resp.status}: ${corpo}`);
}

/** Drive temporariamente indisponível (limite de uso, erro interno ou falha de rede). */
export function erroTemporario(err: unknown) {
  if (err instanceof ErroDrive) return err.status === 429 || err.status >= 500 || (err.status === 403 && /rateLimit|userRateLimit/i.test(err.message));
  return err instanceof TypeError; // falha de rede no fetch
}

/** Motivo da falha em linguagem simples. */
export function motivoFalha(err: unknown) {
  if (erroTemporario(err)) return "Drive temporariamente indisponível";
  if (err instanceof ErroDrive) {
    if (err.status === 401 || err.status === 403) return "Sem permissão na pasta do Drive";
    if (err.status === 404) return "Pasta do Drive não encontrada";
    return `Drive recusou o arquivo (${err.status})`;
  }
  return err instanceof Error ? err.message.slice(0, 160) : "Erro desconhecido";
}

const TENTATIVAS = 3;
export async function comTentativas<T>(fn: () => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimo = err;
      if (!erroTemporario(err) || i === TENTATIVAS - 1) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw ultimo;
}

function nomeArquivoSeguro(texto: string) {
  return texto.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------- conta Google

/** Lê a conta Google (email) que está guardando os backups. */
export async function contaDrive(): Promise<{ email: string | null; nome: string | null; erro?: string }> {
  try {
    const resp = await fetch(`${GATEWAY}/drive/v3/about?fields=user(displayName,emailAddress)`, {
      headers: cabecalhosDrive(),
    });
    if (!resp.ok) {
      const corpo = await resp.text();
      return { email: null, nome: null, erro: `Drive respondeu ${resp.status}: ${corpo.slice(0, 160)}` };
    }
    const json = (await resp.json()) as { user?: { displayName?: string; emailAddress?: string } };
    return { email: json.user?.emailAddress ?? null, nome: json.user?.displayName ?? null };
  } catch (err) {
    return { email: null, nome: null, erro: err instanceof Error ? err.message : "Falha ao consultar o Google Drive." };
  }
}

// ---------------------------------------------------------------- validação


export type ChecagemPasta = {
  chave: string;
  rotulo: string;
  id: string;
  padrao: boolean;
  ok: boolean;
  nome?: string | undefined;
  podeEscrever?: boolean | undefined;
  erro?: string | undefined;
};

/** Verifica se uma pasta do Drive existe, não está na lixeira e aceita novos arquivos. */
export async function verificarPastaDrive(id: string): Promise<Omit<ChecagemPasta, "chave" | "rotulo" | "padrao">> {
  if (!id) return { id, ok: false, erro: "Pasta não informada." };
  try {
    const url = `${GATEWAY}/drive/v3/files/${id}?fields=id,name,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`;
    const resp = await fetch(url, { headers: cabecalhosDrive() });
    if (resp.status === 404) return { id, ok: false, erro: "Pasta não encontrada ou sem acesso." };
    if (!resp.ok) {
      const corpo = await resp.text();
      return { id, ok: false, erro: `Drive respondeu ${resp.status}: ${corpo.slice(0, 160)}` };
    }
    const json = (await resp.json()) as {
      name?: string;
      mimeType?: string;
      trashed?: boolean;
      capabilities?: { canAddChildren?: boolean };
    };
    if (json.mimeType !== MIME_PASTA) return { id, ok: false, nome: json.name, erro: "O ID informado não é uma pasta." };
    if (json.trashed) return { id, ok: false, nome: json.name, erro: "A pasta está na lixeira do Drive." };
    const podeEscrever = json.capabilities?.canAddChildren !== false;
    if (!podeEscrever) {
      return { id, ok: false, nome: json.name, podeEscrever, erro: "Sem permissão para adicionar arquivos na pasta." };
    }
    return { id, ok: true, nome: json.name, podeEscrever };
  } catch (err) {
    return { id, ok: false, erro: err instanceof Error ? err.message : "Falha ao consultar o Google Drive." };
  }
}

/** Valida as três pastas configuradas (ou os padrões) antes de rodar o backup. */
export async function validarPastasDrive(): Promise<ChecagemPasta[]> {
  const pastas = await pastasDrive();
  const alvos = [
    { chave: CHAVE_PASTA_PLANILHAS, rotulo: "Pasta da planilha", id: pastas.planilhas, padrao: pastas.planilhas === PASTA_PLANILHAS },
    { chave: CHAVE_PASTA_IMAGENS, rotulo: "Pasta das fotos", id: pastas.fotos, padrao: pastas.fotos === PASTA_IMAGENS },
    { chave: CHAVE_PASTA_DOCUMENTOS, rotulo: "Pasta dos documentos", id: pastas.documentos, padrao: pastas.documentos === PASTA_DOCUMENTOS },
  ];
  return await Promise.all(
    alvos.map(async (alvo) => ({ ...alvo, ...(await verificarPastaDrive(alvo.id)) })),
  );
}

// ------------------------------------------------------------------ arquivos

export type ArquivoDrive = { id: string; name: string; mimeType?: string | undefined; modifiedTime?: string | undefined; size?: string | undefined };

/** Lista todos os arquivos de uma pasta de uma vez (evita uma busca por arquivo). */
export async function listarPasta(pasta: string): Promise<ArquivoDrive[]> {
  const arquivos: ArquivoDrive[] = [];
  let pageToken: string | undefined;
  do {
    const q = `'${pasta}' in parents and trashed = false`;
    const url =
      `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size)&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const resp = await fetch(url, { headers: cabecalhosDrive() });
    if (!resp.ok) throw await erroDrive(resp);
    const json = (await resp.json()) as { files?: ArquivoDrive[]; nextPageToken?: string };
    arquivos.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return arquivos;
}

/** Localiza (ou cria) uma subpasta pelo nome dentro de uma pasta do Drive. */
export async function garantirSubpasta(nome: string, pai: string) {
  const q = `name = '${nome.replace(/'/g, "\\'")}' and mimeType = '${MIME_PASTA}' and '${pai}' in parents and trashed = false`;
  const resp = await fetch(`${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {
    headers: cabecalhosDrive(),
  });
  if (!resp.ok) throw await erroDrive(resp);
  const existente = ((await resp.json()) as { files?: { id: string }[] }).files?.[0]?.id;
  if (existente) return existente;
  const criar = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { ...cabecalhosDrive(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, parents: [pai], mimeType: MIME_PASTA }),
  });
  if (!criar.ok) throw await erroDrive(criar);
  return ((await criar.json()) as { id: string }).id;
}

/**
 * Envia um arquivo para o Drive mantendo apenas a versão mais recente:
 * se já existir arquivo com o mesmo nome ou com o mesmo marcador do aluno
 * (mesmo que o nome tenha mudado), ele é renomeado e sobrescrito.
 */
export async function enviarParaDrive(opcoes: {
  nome: string;
  pasta: string;
  conteudo: ArrayBuffer | Uint8Array;
  tipo: string;
  /** Marcador único do aluno + tipo de arquivo, usado para achar versões antigas. */
  marcador?: string | undefined;
  /** Marcador do padrão de nome anterior, para renomear arquivos antigos em vez de duplicar. */
  marcadorAntigo?: string | undefined;
  /** Arquivos já existentes na pasta (evita uma busca por arquivo). */
  existentes?: ArquivoDrive[] | undefined;
}) {
  const nome = nomeArquivoSeguro(opcoes.nome);
  const lista = opcoes.existentes ?? (await listarPasta(opcoes.pasta));
  const porNome = lista.find((f) => f.name === nome);
  const porMarcador = opcoes.marcador ? lista.find((f) => f.name.includes(opcoes.marcador!)) : undefined;
  const porMarcadorAntigo = opcoes.marcadorAntigo ? lista.find((f) => f.name.includes(opcoes.marcadorAntigo!)) : undefined;
  const existente = porNome ?? porMarcador ?? porMarcadorAntigo;

  let fileId = existente?.id ?? null;
  if (!fileId) {
    const resp = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
      method: "POST",
      headers: { ...cabecalhosDrive(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, parents: [opcoes.pasta], mimeType: opcoes.tipo }),
    });
    if (!resp.ok) throw await erroDrive(resp);
    fileId = ((await resp.json()) as { id: string }).id;
    lista.push({ id: fileId, name: nome });
  } else if (existente && existente.name !== nome) {
    // Versão anterior com outro nome (outra extensão ou padrão antigo): renomeia em vez de duplicar.
    const rename = await fetch(`${GATEWAY}/drive/v3/files/${fileId}?fields=id`, {
      method: "PATCH",
      headers: { ...cabecalhosDrive(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome }),
    });
    if (!rename.ok) throw await erroDrive(rename);
    existente.name = nome;
  }

  const upload = await fetch(`${GATEWAY}/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers: { ...cabecalhosDrive(), "Content-Type": opcoes.tipo },
    body: opcoes.conteudo as BodyInit,
  });
  if (!upload.ok) throw await erroDrive(upload);
  return { id: fileId, nome, substituido: Boolean(existente) };
}

type Resultado = {
  planilha: string;
  planilhaId: string;
  imagens: number;
  total: number;
  falhas: FalhaBackup[];
};

export type FalhaBackup = ArquivoBackup & { motivo: string };

export type ArquivoBackup = {
  caminho: string;
  nome: string;
  /** ID da pasta de destino (já resolvida, incluindo subpastas de documentos). */
  pasta: string;
  /** Marcador único (código de matrícula + tipo) para substituir a versão anterior. */
  marcador: string;
  /** Marcador do padrão de nome anterior (id do aluno + tipo). */
  marcadorAntigo?: string | undefined;
};
/** Índice de arquivos já existentes, por ID de pasta. */
export type ExistentesBackup = Record<string, ArquivoDrive[]>;

async function baixarArquivoStorage(caminho: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("fotos-alunos").download(caminho);
  return data ? await data.arrayBuffer() : null;
}

/** Gera a planilha (dados cadastrais + código de matrícula, sem links) e envia para a pasta de planilhas. */
export async function gerarPlanilhaBackup(): Promise<{ nome: string; id: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: alunos, error: erroAlunos }, { data: turmas }, { data: matriculas }] = await Promise.all([
    supabaseAdmin.from("alunos").select("*"),
    supabaseAdmin.from("turmas").select("*"),
    supabaseAdmin.from("matriculas").select("*"),
  ]);
  if (erroAlunos) throw erroAlunos;

  const lista = (alunos ?? []) as AlunoPlanilha[];
  const matriculaDoAluno = (id: string) => (matriculas ?? []).find((m) => m.aluno_id === id);
  const turmaDoAluno = (id: string) => {
    const m = matriculaDoAluno(id);
    return m ? (turmas ?? []).find((t) => t.id === m.turma_id) : undefined;
  };

  // Sem links: os arquivos ficam no Drive com o nome CODIGO_TIPO.ext,
  // e é o código de matrícula que liga cada arquivo ao aluno na restauração.
  const buffer = await montarPlanilhaAlunos({
    alunos: lista,
    turmaDoAluno,
    modalidadeDoAluno: (id) => matriculaDoAluno(id)?.modalidade ?? turmaDoAluno(id)?.modalidade ?? "",
    incluirLinks: false,
  });

  const pastas = await pastasDrive();
  const data = new Date().toISOString().slice(0, 10);
  const planilha = await comTentativas(() => enviarParaDrive({
    nome: `alunos-${data}.xlsx`,
    pasta: pastas.planilhas,
    conteudo: buffer,
    tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  return { nome: planilha.nome, id: planilha.id };
}

/** Prepara a fila de fotos/documentos a enviar para o Drive. */
export async function prepararBackup(): Promise<{
  planilha: string;
  arquivos: ArquivoBackup[];
  existentes: ExistentesBackup;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const checagens = await validarPastasDrive();
  const invalidas = checagens.filter((c) => !c.ok);
  if (invalidas.length > 0) {
    throw new Error(
      `Não foi possível iniciar o backup. ${invalidas.map((c) => `${c.rotulo}: ${c.erro}`).join(" | ")}`,
    );
  }

  const { data: alunos, error: erroAlunos } = await supabaseAdmin.from("alunos").select("*");
  if (erroAlunos) throw erroAlunos;
  const lista = (alunos ?? []) as AlunoPlanilha[];

  const pastas = await pastasDrive();

  // Resolve (criando se necessário) as subpastas de cada tipo de documento.
  const pastaPorTipo: Record<string, string> = {};
  for (const tipo of TIPOS_DOCUMENTO) {
    const sub = pastas.subpastas[tipo.campo];
    pastaPorTipo[tipo.campo] = sub ? await garantirSubpasta(sub, pastas.documentos) : pastas.documentos;
  }

  const arquivos: ArquivoBackup[] = [];
  for (const aluno of lista) {
    const registro = aluno as AlunoPlanilha & Record<string, unknown>;
    const codigo = String(aluno.codigo ?? "").trim().toUpperCase();
    if (!codigo) continue;
    const curto = aluno.id.slice(0, 8);
    const campos = ["foto_path", ...TIPOS_DOCUMENTO.map((t) => t.campo as string)];
    for (const campo of campos) {
      const caminho = registro[campo] as string | null | undefined;
      if (!caminho) continue;
      const tipoAntigo = campo === "foto_path" ? "foto" : campo.replace(/^doc_|_path$/g, "");
      if (!tipoArquivoDrive(campo)) continue;
      arquivos.push({
        caminho,
        nome: nomeArquivoDrive(codigo, campo, caminho),
        pasta: campo === "foto_path" ? pastas.fotos : (pastaPorTipo[campo] ?? pastas.documentos),
        marcador: prefixoArquivoDrive(codigo, campo),
        marcadorAntigo: `[${curto}-${tipoAntigo}]`,
      });
    }
  }

  const pastasUsadas = Array.from(new Set(arquivos.map((a) => a.pasta)));
  const listagens = await Promise.all(pastasUsadas.map((p) => listarPasta(p)));
  const existentes: ExistentesBackup = {};
  pastasUsadas.forEach((p, i) => {
    existentes[p] = listagens[i] ?? [];
  });
  return { planilha: "", arquivos, existentes };
}


/** Envia um lote de fotos/documentos para a pasta correspondente no Drive. */
export async function enviarLoteBackup(
  arquivos: ArquivoBackup[],
  existentes?: ExistentesBackup,
): Promise<{ enviados: number; falhas: FalhaBackup[] }> {
  const indices: ExistentesBackup = {};
  for (const [pasta, itens] of Object.entries(existentes ?? {})) indices[pasta] = [...itens];
  const falhas: FalhaBackup[] = [];
  let enviados = 0;
  const CONCORRENCIA = 8;
  let proximo = 0;

  async function trabalhador() {
    while (proximo < arquivos.length) {
      const arquivo = arquivos[proximo++];
      if (!arquivo) return;
      try {
        const conteudo = await baixarArquivoStorage(arquivo.caminho);
        if (!conteudo) {
          falhas.push({ ...arquivo, motivo: "Arquivo não encontrado no sistema" });
          continue;
        }
        if (!indices[arquivo.pasta]) indices[arquivo.pasta] = await comTentativas(() => listarPasta(arquivo.pasta));
        await comTentativas(() =>
          enviarParaDrive({
            nome: arquivo.nome,
            pasta: arquivo.pasta,
            conteudo,
            tipo: tipoConteudoArquivo(arquivo.caminho),
            marcador: arquivo.marcador,
            marcadorAntigo: arquivo.marcadorAntigo,
            existentes: indices[arquivo.pasta],
          }),
        );
        enviados++;
      } catch (err) {
        console.error("[backup] falha ao enviar arquivo", arquivo.nome, err);
        falhas.push({ ...arquivo, motivo: motivoFalha(err) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, arquivos.length) }, trabalhador));
  return { enviados, falhas };
}

/** Exporta a planilha do dia e todas as fotos/documentos para as pastas do Google Drive. */
export async function executarBackupCompleto(): Promise<Resultado> {
  const { arquivos, existentes } = await prepararBackup();
  const { enviados, falhas } = await enviarLoteBackup(arquivos, existentes);
  const planilha = await gerarPlanilhaBackup();
  return { planilha: planilha.nome, planilhaId: planilha.id, imagens: enviados, total: arquivos.length, falhas };
}
