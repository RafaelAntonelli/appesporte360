import { idadePorNascimento, turnoDoHorario } from "@/lib/turnos";

export const DOCUMENTOS_PLANILHA = [
  { campo: "doc_atestado_path", rotulo: "Atestado médico" },
  { campo: "doc_residencia_path", rotulo: "Comprovante de residência" },
  { campo: "doc_matricula_path", rotulo: "Comprovante de matrícula escolar" },
  { campo: "doc_identidade_path", rotulo: "Documento de identidade" },
  { campo: "doc_ficha_path", rotulo: "Ficha" },
] as const;

export type CampoDocPlanilha = (typeof DOCUMENTOS_PLANILHA)[number]["campo"];

/** Chave curta do tipo de arquivo, igual à usada no marcador do nome no Drive. */
export function tipoArquivoPlanilha(campo: string) {
  return campo === "foto_path" ? "foto" : campo.replace(/^doc_|_path$/g, "");
}

/** Chave do mapa de links do Drive: 8 primeiros caracteres do id + tipo. */
export function chaveLinkDrive(alunoId: string, campo: string) {
  return `${alunoId.slice(0, 8)}|${tipoArquivoPlanilha(campo)}`;
}

export type AlunoPlanilha = {
  id: string;
  codigo?: string | null;
  nome: string;
  sexo?: string | null;
  idade?: number | null;
  data_nascimento?: string | null;
  cpf?: string | null;
  rg?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  email?: string | null;
  responsavel?: string | null;
  rede_ensino?: string | null;
  escola?: string | null;
  pcd?: boolean | null;
  pcd_condicoes?: string[] | null;
  pcd_descricao?: string | null;
  motivo_inativacao?: string | null;
  faixa_etaria?: string | null;
  atestado_entregue?: boolean | null;
  atestado_data?: string | null;
  ativo?: boolean | null;
  observacoes?: string | null;
  foto_path?: string | null;
} & Partial<Record<CampoDocPlanilha, string | null>>;


export type TurmaPlanilha = { id: string; nome: string; modalidade?: string | null; horario?: string | null };

/** Idade efetiva usada para ordenar a planilha (nascimento tem prioridade). */
export function idadeEfetiva(aluno: AlunoPlanilha) {
  const calculada = Number(idadePorNascimento(aluno.data_nascimento));
  if (Number.isFinite(calculada)) return calculada;
  const informada = Number(aluno.idade);
  return Number.isFinite(informada) ? informada : Number.POSITIVE_INFINITY;
}

export type OpcoesPlanilha = {
  alunos: AlunoPlanilha[];
  turmaDoAluno: (id: string) => TurmaPlanilha | undefined;
  modalidadeDoAluno: (id: string) => string;
  /** Permite cancelar a exportação no meio. */
  sinal?: AbortSignal | undefined;
  /** Progresso do processamento das linhas. */
  aoProgredir?: ((feitos: number, total: number) => void) | undefined;
  /**
   * Links assinados e temporários dos arquivos.
   * Devolve um mapa com a chave de `chaveLinkDrive(alunoId, campo)` (opcionalmente com a validade).
   */
  linksDrive?: (() => Promise<Record<string, string> | LinksTemporarios>) | undefined;
  /** Inclui as colunas de links dos arquivos (padrão: sim). O backup no Drive não usa links. */
  incluirLinks?: boolean | undefined;
};

export type LinksTemporarios = { links: Record<string, string>; validoAte: string | null };

type ConstrutorWorkbook = new () => import("exceljs").Workbook;

/** Carrega o gerador de Excel no navegador e no servidor (formatos de módulo diferentes). */
export async function carregarExcel(): Promise<ConstrutorWorkbook> {
  type ModuloExcel = { Workbook?: ConstrutorWorkbook; default?: ModuloExcel };
  const modulo = (await import("exceljs")) as unknown as ModuloExcel;
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook ?? modulo.default?.default?.Workbook;
  if (!Workbook) throw new Error("Não foi possível iniciar o gerador da planilha.");
  return Workbook;
}


/** Erro lançado quando o usuário cancela a exportação. */
export class ExportacaoCancelada extends Error {
  constructor() {
    super("Exportação cancelada");
    this.name = "ExportacaoCancelada";
  }
}

/** Estima a largura da coluna em unidades do Excel a partir de um texto. */
function larguraTexto(texto: string) {
  let largura = 0;
  for (const char of texto) {
    const code = char.charCodeAt(0);
    if (code < 128) {
      // caracteres ASCII: maiúsculas/largas ~0.9, minúsculas ~0.7
      largura += /[WM@mvw]/.test(char) ? 1.1 : /[A-Z0-9]/.test(char) ? 0.9 : 0.75;
    } else {
      // caracteres latinos/cjk: aproximadamente 1.15
      largura += 1.15;
    }
  }
  return largura;
}

/** Monta a planilha de alunos em ordem crescente de idade, com links dos arquivos no Drive. */
export async function montarPlanilhaAlunos(opcoes: OpcoesPlanilha): Promise<ArrayBuffer> {
  const Workbook = await carregarExcel();
  const wb = new Workbook();
  const ws = wb.addWorksheet("Alunos");

  const colunasBase = [
    "Matrícula", "Nome", "Sexo", "Idade", "Faixa etária", "Nascimento", "CPF", "RG", "Celular", "Celular 2", "E-mail",
    "Responsável", "Rede de ensino", "Escola", "PCD", "Condições PCD", "Descrição PCD", "Atestado entregue",
    "Data do atestado", "Modalidade", "Turma", "Horário", "Turno", "Situação", "Motivo da inativação", "Observações",
  ];
  const incluirLinks = opcoes.incluirLinks !== false;
  const arquivos = incluirLinks
    ? [
        { campo: "foto_path", rotulo: "Foto do aluno" },
        ...DOCUMENTOS_PLANILHA.map((d) => ({ campo: d.campo as string, rotulo: d.rotulo })),
      ]
    : [];
  const cabecalho = [...colunasBase, ...arquivos.map((a) => `Link - ${a.rotulo}`)];
  ws.addRow(cabecalho);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(1).height = 36;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const ordenados = [...opcoes.alunos].sort((a, b) => {
    const diff = idadeEfetiva(a) - idadeEfetiva(b);
    if (diff !== 0 && Number.isFinite(diff)) return diff;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  let links: Record<string, string> = {};
  let validoAte: string | null = null;
  if (incluirLinks && opcoes.linksDrive) {
    try {
      const r = await opcoes.linksDrive();
      if (r && typeof r === "object" && "links" in r && typeof r.links === "object") {
        links = (r as LinksTemporarios).links;
        validoAte = (r as LinksTemporarios).validoAte;
      } else {
        links = r as Record<string, string>;
      }
    } catch {
      links = {};
    }
  }
  if (opcoes.sinal?.aborted) throw new ExportacaoCancelada();
  const linkDe = (aluno: AlunoPlanilha, campo: string) => links[chaveLinkDrive(aluno.id, campo)] ?? "";

  const colunaLinkInicial = colunasBase.length + 1;

  const linhas = ordenados.map((a) => {
    const t = opcoes.turmaDoAluno(a.id);
    const idade = idadeEfetiva(a);
    return {
      aluno: a,
      valores: [
        a.codigo ?? "",
        a.nome,
        a.sexo ?? "",
        Number.isFinite(idade) ? idade : (a.idade ?? ""),
        a.faixa_etaria ?? "",
        a.data_nascimento ?? "",
        a.cpf ?? "",
        a.rg ?? "",
        a.telefone ?? "",
        a.telefone2 ?? "",
        a.email ?? "",
        a.responsavel ?? "",
        a.rede_ensino ?? "",
        a.escola ?? "",
        a.pcd ? "Sim" : "Não",
        (a.pcd_condicoes ?? []).join(" | "),
        a.pcd_descricao ?? "",
        a.atestado_entregue ? "Sim" : "Não",
        a.atestado_data ?? "",
        opcoes.modalidadeDoAluno(a.id),
        t?.nome ?? "",
        t?.horario ?? "",
        turnoDoHorario(t?.horario),
        a.ativo === false ? "Inativo" : "Ativo",
        a.ativo === false ? (a.motivo_inativacao ?? "") : "",
        a.observacoes ?? "",
        ...arquivos.map(() => ""),
      ] as (string | number)[],
    };
  });

  linhas.forEach((l) => ws.addRow(l.valores));

  // Links clicáveis para os arquivos no Google Drive
  for (let li = 0; li < linhas.length; li++) {
    if (opcoes.sinal?.aborted) throw new ExportacaoCancelada();
    opcoes.aoProgredir?.(li, linhas.length);
    const item = linhas[li];
    if (!item) continue;
    const linhaExcel = li + 2;
    arquivos.forEach((arq, i) => {
      const temArquivo = Boolean((item.aluno as Record<string, unknown>)[arq.campo]);
      if (!temArquivo) return;
      const url = linkDe(item.aluno, arq.campo);
      const celula = ws.getCell(linhaExcel, colunaLinkInicial + i);
      if (!url) {
        celula.value = "Arquivo indisponível";
        return;
      }
      celula.value = { text: `${arq.rotulo} - ${item.aluno.nome}`, hyperlink: url };
      celula.font = { color: { argb: "FF0563C1" }, underline: true };
    });
  }
  opcoes.aoProgredir?.(linhas.length, linhas.length);

  const colunasLargas = new Set(["Observações", "Condições PCD", "E-mail", "Escola", "Responsável"]);
  const colunasFixas = new Set(["Sexo", "Idade", "PCD", "Atestado entregue"]);

  cabecalho.forEach((titulo, i) => {
    const col = ws.getColumn(i + 1);
    let maxLargura = larguraTexto(titulo);
    col.eachCell({ includeEmpty: false }, (celula, numeroLinha) => {
      if (numeroLinha === 1) return;
      const v = celula.value as unknown;
      const texto =
        v && typeof v === "object" && "text" in (v as Record<string, unknown>)
          ? String((v as { text: unknown }).text ?? "")
          : String(v ?? "");
      maxLargura = Math.max(maxLargura, larguraTexto(texto));
    });

    const quebra = colunasLargas.has(titulo);
    if (colunasFixas.has(titulo)) {
      col.width = Math.max(maxLargura + 2, 10);
    } else if (titulo.startsWith("Link - ")) {
      col.width = Math.min(Math.max(maxLargura + 3, 18), 42);
    } else {
      col.width = Math.min(Math.max(maxLargura + 3, 10), quebra ? 55 : 36);
    }
    col.alignment = { vertical: "middle", wrapText: quebra };
  });

  // Ajusta altura das linhas que têm conteúdo grande
  linhas.forEach((_, li) => {
    const linhaExcel = li + 2;
    let altura = 15;
    cabecalho.forEach((titulo, ci) => {
      if (!colunasLargas.has(titulo)) return;
      const celula = ws.getCell(linhaExcel, ci + 1);
      const texto = String(celula.value ?? "");
      const linhasTexto = Math.ceil(texto.length / ((ws.getColumn(ci + 1).width ?? 10) / 1.1));
      altura = Math.max(altura, Math.min(linhasTexto, 8) * 14);
    });
    ws.getRow(linhaExcel).height = altura;
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cabecalho.length } };

  if (incluirLinks && validoAte) {
    const info = wb.addWorksheet("Sobre os links");
    info.getColumn(1).width = 90;
    info.addRow(["Os links de fotos e documentos são temporários e protegidos (LGPD)."]);
    info.addRow([`Válidos até ${new Date(validoAte).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília).`]);
    info.addRow(["Depois disso, exporte a planilha novamente para gerar novos links."]);
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
