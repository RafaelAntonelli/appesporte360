/** Restauração a partir do Google Drive (planilha de backup + pastas de fotos e documentos). Somente servidor. */
import {
  GATEWAY,
  MIME_PASTA,
  cabecalhosDrive,
  comTentativas,
  erroDrive,
  listarPasta,
  motivoFalha,
  pastasDrive,
  type ArquivoDrive,
} from "@/lib/backup.server";
import { lerNomeArquivoDrive, tipoConteudoArquivo, TIPOS_ARQUIVO_DRIVE } from "@/lib/arquivos-drive";
import { carregarExcel } from "@/lib/planilha-alunos";
import { linhaParaAluno } from "@/lib/restauracao";

const TAMANHO_MAXIMO = 20 * 1024 * 1024;
const MIME_PLANILHA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type PlanilhaBackup = { id: string; nome: string; modificadoEm: string | null };
export type TarefaRestauracao = { fileId: string; nome: string };
export type FalhaRestauracao = { nome: string; motivo: string };

export type PreparoRestauracao = {
  alunosCriados: number;
  alunosExistentes: number;
  linhasIgnoradas: number;
  matriculasCriadas: number;
  errosPlanilha: FalhaRestauracao[];
  tarefas: TarefaRestauracao[];
  arquivosEncontrados: number;
  semAluno: string[];
  jaVinculados: number;
  foraDoPadrao: number;
};

/** Planilhas de backup (.xlsx) mais recentes na pasta de planilhas do Drive. */
export async function listarPlanilhasBackup(): Promise<PlanilhaBackup[]> {
  const pastas = await pastasDrive();
  const arquivos = await comTentativas(() => listarPasta(pastas.planilhas));
  return arquivos
    .filter((a) => a.mimeType === MIME_PLANILHA || a.name.toLowerCase().endsWith(".xlsx"))
    .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))
    .slice(0, 30)
    .map((a) => ({ id: a.id, nome: a.name, modificadoEm: a.modifiedTime ?? null }));
}

async function metadados(fileId: string) {
  const resp = await fetch(
    `${GATEWAY}/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`,
    { headers: cabecalhosDrive() },
  );
  if (!resp.ok) throw await erroDrive(resp);
  return (await resp.json()) as { id: string; name: string; mimeType?: string; size?: string; trashed?: boolean };
}

async function baixarDoDrive(fileId: string) {
  const resp = await fetch(`${GATEWAY}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: cabecalhosDrive(),
  });
  if (!resp.ok) throw await erroDrive(resp);
  return await resp.arrayBuffer();
}

function textoCelula(valor: unknown): unknown {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor;
  if (typeof valor === "object") {
    const v = valor as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return v.result;
    return "";
  }
  return valor;
}

/** Lê a planilha de backup e recria os alunos que não existem mais (mesmo código de matrícula). */
async function restaurarAlunosDaPlanilha(planilhaId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const meta = await comTentativas(() => metadados(planilhaId));
  if (meta.trashed) throw new Error("A planilha escolhida está na lixeira do Drive.");
  const conteudo = await comTentativas(() => baixarDoDrive(planilhaId));
  const Workbook = await carregarExcel();
  const wb = new Workbook();
  await wb.xlsx.load(conteudo);
  const ws = wb.getWorksheet("Alunos") ?? wb.worksheets[0];
  if (!ws) throw new Error("A planilha não tem a aba de alunos.");

  const cabecalho: string[] = [];
  ws.getRow(1).eachCell((c, col) => {
    cabecalho[col] = String(textoCelula(c.value) ?? "").trim();
  });
  if (!cabecalho.includes("Matrícula")) throw new Error("A planilha não tem a coluna Matrícula.");

  const [{ data: existentes, error }, { data: turmas }] = await Promise.all([
    db.from("alunos").select("codigo"),
    db.from("turmas").select("id,nome,modalidade"),
  ]);
  if (error) throw new Error(error.message);
  const codigos = new Set((existentes ?? []).map((a) => a.codigo));
  const turmaPorNome = new Map((turmas ?? []).map((t) => [t.nome.trim().toLowerCase(), t]));

  let criados = 0;
  let jaExistiam = 0;
  let ignoradas = 0;
  let matriculas = 0;
  const erros: FalhaRestauracao[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const registro: Record<string, unknown> = {};
    cabecalho.forEach((titulo, col) => {
      if (titulo) registro[titulo] = textoCelula(row.getCell(col).value);
    });
    if (!Object.values(registro).some((v) => String(v ?? "").trim())) continue;
    const linha = linhaParaAluno(registro);
    if (!linha) {
      ignoradas++;
      continue;
    }
    if (codigos.has(linha.aluno.codigo)) {
      jaExistiam++;
      continue;
    }
    const { data: novo, error: erroInsert } = await db.from("alunos").insert(linha.aluno).select("id").single();
    if (erroInsert || !novo) {
      erros.push({ nome: `${linha.aluno.codigo} · ${linha.aluno.nome}`, motivo: erroInsert?.message ?? "Não foi possível recriar o aluno" });
      continue;
    }
    codigos.add(linha.aluno.codigo);
    criados++;
    if (!linha.aluno.ativo) continue;
    for (const nomeTurma of linha.turmas.slice(0, 3)) {
      const turma = turmaPorNome.get(nomeTurma.toLowerCase());
      if (!turma) continue;
      const { error: erroMat } = await db.from("matriculas").insert({
        aluno_id: novo.id,
        turma_id: turma.id,
        status: "ativa",
        modalidade: turma.modalidade ?? linha.modalidade ?? "",
      });
      if (!erroMat) matriculas++;
    }
  }
  return { criados, jaExistiam, ignoradas, matriculas, erros };
}

/** Lista as pastas de fotos e documentos (e as subpastas de documentos). */
async function arquivosDasPastas(): Promise<ArquivoDrive[]> {
  const pastas = await pastasDrive();
  const raiz = await Promise.all([pastas.fotos, pastas.documentos].map((p) => comTentativas(() => listarPasta(p))));
  const todos = raiz.flat();
  const subpastas = todos.filter((a) => a.mimeType === MIME_PASTA);
  const internos = await Promise.all(subpastas.map((p) => comTentativas(() => listarPasta(p.id)).catch(() => [] as ArquivoDrive[])));
  return [...todos.filter((a) => a.mimeType !== MIME_PASTA), ...internos.flat().filter((a) => a.mimeType !== MIME_PASTA)];
}

/**
 * Prepara a restauração: recria os alunos da planilha (opcional) e monta a lista de arquivos
 * do Drive a vincular, identificando o aluno pelo código de matrícula no nome do arquivo.
 */
export async function prepararRestauracao(opcoes: { planilhaId: string | null; substituir: boolean }): Promise<PreparoRestauracao> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const planilha = opcoes.planilhaId
    ? await restaurarAlunosDaPlanilha(opcoes.planilhaId)
    : { criados: 0, jaExistiam: 0, ignoradas: 0, matriculas: 0, erros: [] as FalhaRestauracao[] };

  const campos = TIPOS_ARQUIVO_DRIVE.map((t) => t.campo);
  const { data: alunos, error } = await db.from("alunos").select(["codigo", ...campos].join(","));
  if (error) throw new Error(error.message);
  const porCodigo = new Map(
    ((alunos ?? []) as unknown as Record<string, string | null>[]).map((a) => [String(a["codigo"] ?? ""), a]),
  );

  const arquivos = await arquivosDasPastas();
  // Um arquivo por aluno + tipo: se houver repetidos, fica o mais recente.
  const escolhidos = new Map<string, ArquivoDrive>();
  let foraDoPadrao = 0;
  for (const arquivo of arquivos) {
    const lido = lerNomeArquivoDrive(arquivo.name);
    if (!lido) {
      foraDoPadrao++;
      continue;
    }
    const chave = `${lido.codigo}|${lido.campo}`;
    const atual = escolhidos.get(chave);
    if (!atual || (arquivo.modifiedTime ?? "") > (atual.modifiedTime ?? "")) escolhidos.set(chave, arquivo);
  }

  const tarefas: TarefaRestauracao[] = [];
  const semAluno = new Set<string>();
  let jaVinculados = 0;
  for (const arquivo of escolhidos.values()) {
    const lido = lerNomeArquivoDrive(arquivo.name)!;
    const aluno = porCodigo.get(lido.codigo);
    if (!aluno) {
      semAluno.add(lido.codigo);
      continue;
    }
    if (aluno[lido.campo] && !opcoes.substituir) {
      jaVinculados++;
      continue;
    }
    tarefas.push({ fileId: arquivo.id, nome: arquivo.name });
  }

  return {
    alunosCriados: planilha.criados,
    alunosExistentes: planilha.jaExistiam,
    linhasIgnoradas: planilha.ignoradas,
    matriculasCriadas: planilha.matriculas,
    errosPlanilha: planilha.erros,
    tarefas,
    arquivosEncontrados: escolhidos.size,
    semAluno: [...semAluno].sort(),
    jaVinculados,
    foraDoPadrao,
  };
}

/** Baixa um lote de arquivos do Drive, guarda no sistema e vincula ao aluno do código no nome. */
export async function restaurarLote(
  tarefas: TarefaRestauracao[],
  substituir: boolean,
): Promise<{ restaurados: number; ignorados: number; falhas: FalhaRestauracao[] }> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  let restaurados = 0;
  let ignorados = 0;
  const falhas: FalhaRestauracao[] = [];

  for (const tarefa of tarefas) {
    try {
      // O nome é conferido no próprio Drive: o vínculo nunca depende do que a tela enviou.
      const meta = await comTentativas(() => metadados(tarefa.fileId));
      const lido = lerNomeArquivoDrive(meta.name);
      if (!lido) {
        falhas.push({ nome: meta.name, motivo: "Nome fora do padrão CODIGO_TIPO.extensão" });
        continue;
      }
      if (Number(meta.size ?? 0) > TAMANHO_MAXIMO) {
        falhas.push({ nome: meta.name, motivo: "Arquivo maior que 20 MB" });
        continue;
      }
      const { data: aluno } = await db
        .from("alunos")
        .select(`id,codigo,${lido.campo}`)
        .eq("codigo", lido.codigo)
        .maybeSingle();
      const registro = aluno as unknown as Record<string, string | null> | null;
      if (!registro?.["id"]) {
        falhas.push({ nome: meta.name, motivo: `Nenhum aluno com a matrícula ${lido.codigo}` });
        continue;
      }
      if (registro[lido.campo] && !substituir) {
        ignorados++;
        continue;
      }
      const conteudo = await comTentativas(() => baixarDoDrive(tarefa.fileId));
      const caminho = `${registro["id"]}/${lido.tipo}-restaurado-${Date.now()}.${lido.extensao}`;
      const up = await db.storage
        .from("fotos-alunos")
        .upload(caminho, conteudo, { contentType: tipoConteudoArquivo(caminho), upsert: true });
      if (up.error) throw new Error(up.error.message);
      const { error } = await db
        .from("alunos")
        .update({ [lido.campo]: caminho } as never)
        .eq("id", registro["id"]);
      if (error) throw new Error(error.message);
      restaurados++;
    } catch (err) {
      console.error("[restauração] falha no arquivo", tarefa.nome, err);
      falhas.push({ nome: tarefa.nome, motivo: motivoFalha(err) });
    }
  }
  return { restaurados, ignorados, falhas };
}
