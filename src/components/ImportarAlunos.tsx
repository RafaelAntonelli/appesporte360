import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { baixarImagem } from "@/lib/fotos.functions";
import { extrairImagensPlanilha } from "@/lib/planilha-imagens";
import { capitalizarNome, formatarCelular, formatarCPF, apenasDigitos, cpfValido } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Turma = {
  id: string;
  nome: string;
  horario: string | null;
  modalidade: string | null;
  capacidade: number | null;
  dias_semana?: string[] | null;
};
type Matricula = { aluno_id: string; turma_id: string; status: string };
type AlunoExistente = { id: string; nome: string; cpf: string | null; telefone: string | null };

const COLUNAS = [
  "Nome",
  "Sexo",
  "Idade",
  "Nascimento",
  "CPF",
  "RG",
  "Celular",
  "Celular 2",
  "E-mail",
  "Responsável",
  "Rede de ensino",
  "Escola",
  "PCD",
  "Atestado",
  "Data do atestado",
  "Modalidade",
  "Turma",
  "Foto",
  "Observações",
] as const;

// Aceita cabeçalhos fora do modelo (acentos, maiúsculas e apelidos comuns)
const ALIASES: Record<string, string[]> = {
  Nome: ["nome", "nome completo", "aluno", "nome do aluno", "estudante"],
  Sexo: ["sexo", "genero"],
  Idade: ["idade", "anos"],
  Nascimento: ["nascimento", "data de nascimento", "data nascimento", "dt nascimento", "nasc"],
  CPF: ["cpf", "cpf do aluno"],
  RG: ["rg", "identidade"],
  Celular: ["celular", "telefone", "fone", "whatsapp", "contato", "telefone 1", "celular 1"],
  "Celular 2": ["celular 2", "telefone 2", "segundo telefone", "outro contato"],
  "E-mail": ["e mail", "email", "e-mail", "mail"],
  Responsável: ["responsavel", "responsavel legal", "mae pai", "pai mae"],
  "Rede de ensino": ["rede de ensino", "rede", "rede ensino", "publica privada", "tipo de escola"],
  Escola: ["escola", "colegio", "nome da escola", "instituicao"],
  PCD: ["pcd", "deficiencia", "possui deficiencia"],
  Atestado: ["atestado", "entregou atestado", "atestado entregue", "atestado medico", "entregou atestado medico"],
  "Data do atestado": [
    "data do atestado",
    "data atestado",
    "atestado data",
    "validade do atestado",
    "data do atestado medico",
  ],
  Modalidade: ["modalidade", "atividade", "esporte"],
  Turma: ["turma", "turma horario", "horario", "classe", "grupo"],
  Observações: ["observacoes", "observacao", "obs", "anotacoes"],
  Foto: ["foto", "foto url", "url da foto", "link da foto", "imagem", "url foto", "foto do aluno"],
};

function normalizarModalidade(v: string) {
  const t = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/hidro/.test(t)) return "Hidroginástica";
  if (/nata|nataca|swim/.test(t)) return "Natação";
  return "";
}

function extrairHora(v: string) {
  const m = v.match(/(\d{1,2})\s*(?::|h|hs|hrs|\.)?\s*(\d{2})?/i);
  if (!m || m[1] == null) return "";
  const h = Number(m[1]);
  if (Number.isNaN(h) || h < 0 || h > 23) return "";
  return String(h).padStart(2, "0");
}

function extrairDias(v: string) {
  const t = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const tq = /\bterca?\b|\bter\b|\bquinta\b|\bqui\b|\bt\/q\b/.test(t);
  const qs = /\bquarta\b|\bqua\b|\bsexta\b|\bsex\b|\bq\/s\b/.test(t);
  if (tq && !qs) return ["Ter", "Qui"];
  if (qs && !tq) return ["Qua", "Sex"];
  return null;
}

type Linha = Record<string, unknown>;

type Dados = {
  nome: string;
  sexo: string;
  idade: string;
  data_nascimento: string;
  cpf: string;
  rg: string;
  telefone: string;
  telefone2: string;
  email: string;
  responsavel: string;
  rede_ensino: string;
  escola: string;
  pcd: string;
  atestado: string;
  atestado_data: string;
  modalidade: string;
  observacoes: string;
  turmaNome: string;
  foto: string;
  fotoEmbutida: boolean;
};

type Analise = {
  indice: number;
  original: Linha;
  dados: Dados;
  erros: string[];
  avisos: string[];
  acao: "criar" | "atualizar";
  alunoId?: string;
  turmaId?: string;
};

function normalizarChave(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function texto(v: unknown) {
  return v == null ? "" : String(v).trim();
}

function dataISO(v: unknown) {
  const s = texto(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

function sim(v: unknown) {
  return /^(sim|s|true|1|x)$/i.test(texto(v));
}

export function ImportarAlunos({
  turmas,
  matriculas,
  alunos = [],
  onImportado,
}: {
  turmas: Turma[];
  matriculas: Matricula[];
  alunos?: AlunoExistente[];
  onImportado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [arquivo, setArquivo] = useState<string>("");
  const [modo, setModo] = useState<"criar" | "atualizar">("atualizar");
  const [importando, setImportando] = useState(false);
  const imagensRef = useRef<Map<number, Blob>>(new Map());
  const baixar = useServerFn(baixarImagem);

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([
      [...COLUNAS],
      [
        "Maria da Silva", "Feminino", 12, "2014-03-25", "000.000.000-00", "12.345.678-9",
        "(11) 99999-9999", "", "maria@email.com", "João da Silva", "Pública", "Escola Municipal",
        "Não", "Sim", "2026-02-10", "Natação", turmas[0]?.nome ?? "", "https://exemplo.com/foto-maria.jpg", "",
      ],
    ]);
    ws["!cols"] = COLUNAS.map((c) => ({ wch: Math.max(c.length + 4, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo-importacao-alunos.xlsx");
  }

  function mapearColunas(linha: Linha) {
    const chaves = Object.keys(linha);
    const mapa: Record<string, string> = {};
    for (const coluna of COLUNAS) {
      const alvos = ALIASES[coluna] ?? [normalizarChave(coluna)];
      const encontrada = chaves.find((k) => alvos.includes(normalizarChave(k)));
      if (encontrada) mapa[coluna] = encontrada;
    }
    return mapa;
  }

  function analisar(linhas: Linha[], modoAtual: "criar" | "atualizar"): Analise[] {
    const primeira = linhas[0];
    const mapa = primeira ? mapearColunas(primeira) : {};
    const ocupacao = new Map<string, number>();
    for (const m of matriculas) {
      if (m.status === "ativa") ocupacao.set(m.turma_id, (ocupacao.get(m.turma_id) ?? 0) + 1);
    }
    const vistos = new Map<string, number>();

    return linhas.map((l, indice) => {
      const valor = (coluna: string) => texto(mapa[coluna] ? l[mapa[coluna] as string] : "");
      const erros: string[] = [];
      const avisos: string[] = [];

      const nome = capitalizarNome(valor("Nome"));
      if (!nome) erros.push("Nome não informado");
      else if (nome.length < 3) erros.push("Nome muito curto");

      const cpfBruto = valor("CPF");
      let cpf: string | null = null;
      if (cpfBruto) {
        if (!cpfValido(cpfBruto)) erros.push("CPF inválido");
        else cpf = formatarCPF(cpfBruto);
      }

      const nascBruto = valor("Nascimento");
      const nascimento = dataISO(mapa["Nascimento"] ? l[mapa["Nascimento"] as string] : "");
      if (nascBruto && !nascimento) erros.push("Data de nascimento inválida (use DD/MM/AAAA)");

      const atestadoBruto = valor("Atestado");
      const atestadoDataBruta = valor("Data do atestado");
      const atestadoData = dataISO(mapa["Data do atestado"] ? l[mapa["Data do atestado"] as string] : "");
      if (atestadoDataBruta && !atestadoData) erros.push("Data do atestado inválida (use DD/MM/AAAA)");
      const atestadoEntregue = atestadoBruto
        ? sim(mapa["Atestado"] ? l[mapa["Atestado"] as string] : "")
        : !!atestadoData;
      if (atestadoEntregue && !atestadoData) avisos.push("Atestado marcado como entregue, mas sem data");
      if (atestadoData) {
        const limite = new Date(atestadoData);
        limite.setFullYear(limite.getFullYear() + 1);
        if (limite < new Date()) avisos.push("Atestado vencido (mais de 1 ano)");
      }


      const idadeBruta = valor("Idade");
      let idade: number | null = null;
      if (idadeBruta) {
        const n = Number(apenasDigitos(idadeBruta));
        if (!n || n < 0 || n > 120) erros.push("Idade inválida");
        else idade = n;
      }

      const email = valor("E-mail");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push("E-mail inválido");

      const celularBruto = valor("Celular");
      let celular: string | null = null;
      if (celularBruto) {
        const digitos = apenasDigitos(celularBruto);
        if (digitos.length < 10 || digitos.length > 11) erros.push("Celular inválido (use DDD + número)");
        else celular = formatarCelular(celularBruto);
      }

      const nomeTurma = valor("Turma");
      const modalidadeTexto = valor("Modalidade");
      // A modalidade pode vir na própria coluna Turma ("Natação - Terça e Quinta 08h")
      const modalidade = normalizarModalidade(modalidadeTexto) || normalizarModalidade(nomeTurma);
      let turma: Turma | undefined;
      if (nomeTurma) {
        const alvo = `${nomeTurma} ${modalidadeTexto}`;
        const hora = extrairHora(nomeTurma);
        const dias = extrairDias(alvo);

        let candidatas = turmas;
        if (modalidade) candidatas = candidatas.filter((t) => (t.modalidade ?? "") === modalidade);
        if (dias) candidatas = candidatas.filter((t) => dias.every((d) => (t.dias_semana ?? []).includes(d)));
        if (hora) candidatas = candidatas.filter((t) => extrairHora(t.horario ?? "") === hora);

        if (candidatas.length === 1) turma = candidatas[0];
        else if (candidatas.length > 1) {
          const exata = candidatas.find(
            (t) =>
              t.nome.toLowerCase() === nomeTurma.toLowerCase() ||
              `${t.nome} ${t.horario ?? ""}`.trim().toLowerCase() === nomeTurma.toLowerCase(),
          );
          if (exata) turma = exata;
          else if (!modalidade && candidatas.some((t) => t.modalidade !== candidatas[0]?.modalidade))
            erros.push(`Informe a modalidade (Natação ou Hidroginástica) para a turma "${nomeTurma}"`);
          else erros.push(`Turma "${nomeTurma}" ambígua: informe os dias e o horário (ex.: Terça e Quinta 08:00)`);
        } else {
          erros.push(
            modalidade
              ? `Turma "${nomeTurma}" não encontrada em ${modalidade}`
              : `Turma "${nomeTurma}" não encontrada`,
          );
        }
      } else {
        avisos.push("Sem turma: o aluno será cadastrado sem matrícula");
      }

      const fotoUrl = valor("Foto");
      const fotoEmbutida = imagensRef.current.has(indice);
      if (fotoUrl && !fotoEmbutida && !/^(https?:\/\/|data:image\/)/i.test(fotoUrl))
        erros.push("Foto inválida: informe um link (https://...) da imagem ou cole a imagem na célula");

      // Duplicidade dentro do próprio arquivo
      const chaveArquivo = `${nome.toLowerCase()}|${apenasDigitos(cpf)}`;
      const jaVisto = vistos.get(chaveArquivo);
      if (nome && jaVisto != null) erros.push(`Linha duplicada no arquivo (igual à linha ${jaVisto + 2})`);
      else if (nome) vistos.set(chaveArquivo, indice);

      // Aluno já cadastrado?
      const cpfDigitos = apenasDigitos(cpf);
      const celularDigitos = apenasDigitos(celular);
      const existente = alunos.find((a) => {
        if (cpfDigitos && apenasDigitos(a.cpf) === cpfDigitos) return true;
        if (celularDigitos && apenasDigitos(a.telefone) === celularDigitos) return true;
        return a.nome.trim().toLowerCase() === nome.toLowerCase();
      });

      let acao: Analise["acao"] = "criar";
      if (existente) {
        const mesmaTurma =
          !!turma && matriculas.some((m) => m.aluno_id === existente.id && m.turma_id === turma!.id && m.status === "ativa");
        if (modoAtual === "atualizar" && (mesmaTurma || !turma)) {
          acao = "atualizar";
          avisos.push("Aluno já cadastrado: os dados serão atualizados");
        } else if (modoAtual === "atualizar") {
          acao = "atualizar";
          avisos.push("Aluno já cadastrado: dados atualizados e matrícula transferida para a turma informada");
        } else {
          erros.push(`Aluno já cadastrado (${existente.nome}) — use o modo "Atualizar existentes"`);
        }
      }

      // Capacidade só é validada quando haverá nova matrícula
      if (turma && acao === "criar") {
        const usadas = ocupacao.get(turma.id) ?? 0;
        if (usadas >= (turma.capacidade ?? 40)) erros.push(`Turma "${turma.nome}" lotada`);
        else if (!erros.length) ocupacao.set(turma.id, usadas + 1);
      }

      const analise: Analise = {
        indice,
        original: l,
        dados: {
          nome,
          sexo: valor("Sexo"),
          idade: idade == null ? "" : String(idade),
          data_nascimento: nascimento ?? "",
          cpf: cpf ?? "",
          rg: valor("RG"),
          telefone: celular ?? "",
          telefone2: valor("Celular 2") ? formatarCelular(valor("Celular 2")) : "",
          email,
          responsavel: capitalizarNome(valor("Responsável")),
          rede_ensino: valor("Rede de ensino"),
          escola: valor("Escola"),
          pcd: sim(mapa["PCD"] ? l[mapa["PCD"] as string] : "") ? "sim" : "",
          atestado: atestadoEntregue ? "sim" : "",
          atestado_data: atestadoData ?? "",
          modalidade: turma?.modalidade ?? modalidade,
          observacoes: valor("Observações"),
          turmaNome: turma ? `${turma.nome} · ${turma.modalidade ?? ""}` : nomeTurma,
          foto: fotoUrl,
          fotoEmbutida,
        },
        erros,
        avisos,
        acao,
      };
      if (existente) analise.alunoId = existente.id;
      if (turma) analise.turmaId = turma.id;
      return analise;
    });
  }

  async function selecionar(file: File | null) {
    if (!file) return;
    setArquivo(file.name);
    const buf = await file.arrayBuffer();
    imagensRef.current = /\.xlsx$/i.test(file.name) ? extrairImagensPlanilha(buf) : new Map();
    const wb = XLSX.read(buf, { type: "array" });
    const nomePlan = wb.SheetNames[0];
    if (!nomePlan) return toast.error("Planilha vazia.");
    const ws = wb.Sheets[nomePlan];
    if (!ws) return toast.error("Planilha vazia.");
    const dados = XLSX.utils.sheet_to_json<Linha>(ws, { defval: "" });
    if (!dados.length) return toast.error("Nenhuma linha encontrada na planilha.");
    aplicarLinks(ws, dados);
    const resultado = analisar(dados, modo);
    setAnalises(resultado);
    const invalidas = resultado.filter((a) => a.erros.length).length;
    if (invalidas) toast.warning(`${invalidas} linha(s) com problema. Revise antes de confirmar.`);
    return;
  }

  /** Usa o endereço do hyperlink da célula quando a planilha traz o link "escondido" no texto. */
  function aplicarLinks(ws: XLSX.WorkSheet, dados: Linha[]) {
    const ref = ws["!ref"];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    const cabecalhos = new Map<number, string>();
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })] as XLSX.CellObject | undefined;
      if (cell?.v != null) cabecalhos.set(c, String(cell.v).trim());
    }
    const colunasFoto = [...cabecalhos.entries()].filter(([, h]) =>
      (ALIASES["Foto"] ?? []).includes(normalizarChave(h)),
    );
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const linha = dados[r - range.s.r - 1];
      if (!linha) continue;
      for (const [c, cabecalho] of colunasFoto) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as (XLSX.CellObject & { l?: { Target?: string } }) | undefined;
        const alvo = cell?.l?.Target;
        if (alvo) linha[cabecalho] = alvo;
      }
    }
  }

  function trocarModo(novo: "criar" | "atualizar") {
    setModo(novo);
    if (analises.length) setAnalises(analisar(analises.map((a) => a.original), novo));
  }

  function baixarErros() {
    const invalidas = analises.filter((a) => a.erros.length);
    if (!invalidas.length) {
      toast.info("Nenhuma linha com erro para exportar.");
      return;
    }
    const colunasOriginais = Object.keys(invalidas[0]?.original ?? {});
    const cabecalho = ["Linha da planilha", ...colunasOriginais, "Motivo do erro"];
    const linhas = invalidas.map((a) => {
      const indice = analises.indexOf(a) + 2;
      return [indice, ...colunasOriginais.map((c) => texto(a.original[c])), a.erros.join(" · ")];
    });
    const dados = [cabecalho, ...linhas];
    const ws = XLSX.utils.aoa_to_sheet(dados);
    ws["!cols"] = cabecalho.map((_, i) => ({
      wch: Math.min(dados.reduce((max, l) => Math.max(max, String(l[i] ?? "").length), 12) + 2, 60),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, `erros-importacao-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Planilha de erros exportada. Corrija e reimporte.");
  }

  async function importar() {
    const validas = analises.filter((a) => !a.erros.length);
    if (!validas.length) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setImportando(true);
    let criados = 0;
    let atualizados = 0;
    let matriculados = 0;
    const falhas: string[] = [];

    for (const a of validas) {
      const d = a.dados;
      const payload = {
        nome: d.nome,
        sexo: d.sexo || null,
        idade: d.idade ? Number(d.idade) : null,
        data_nascimento: d.data_nascimento || null,
        cpf: d.cpf || null,
        rg: d.rg || null,
        telefone: d.telefone || null,
        telefone2: d.telefone2 || null,
        email: d.email || null,
        responsavel: d.responsavel || null,
        rede_ensino: d.rede_ensino || null,
        escola: d.escola || null,
        pcd: d.pcd === "sim",
        atestado_entregue: d.atestado === "sim",
        atestado_data: d.atestado_data || null,
        observacoes: d.observacoes || null,
      };

      let alunoId = a.alunoId;
      if (a.acao === "atualizar" && alunoId) {
        const limpo: Partial<typeof payload> = {};
        for (const [k, v] of Object.entries(payload)) {
          if (v !== null && v !== "" && v !== false) (limpo as Record<string, unknown>)[k] = v;
        }
        const { error } = await supabase.from("alunos").update(limpo).eq("id", alunoId);
        if (error) {
          falhas.push(`${d.nome}: ${error.message}`);
          continue;
        }
        atualizados++;
      } else {
        const { data, error } = await supabase.from("alunos").insert(payload).select("id").single();
        if (error || !data) {
          falhas.push(`${d.nome}: ${error?.message ?? "falha ao cadastrar"}`);
          continue;
        }
        alunoId = data.id;
        criados++;
      }

      const embutida = imagensRef.current.get(a.indice);
      if ((embutida || d.foto) && alunoId) {
        try {
          let blob: Blob;
          if (embutida) blob = embutida;
          else if (/^data:image\//i.test(d.foto)) blob = await (await fetch(d.foto)).blob();
          else {
            const img = await baixar({ data: { url: d.foto } });
            const bin = atob(img.base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            blob = new Blob([bytes], { type: img.contentType });
          }
          const ext = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
          const caminho = `${alunoId}/${Date.now()}.${ext}`;
          const up = await supabase.storage.from("fotos-alunos").upload(caminho, blob, {
            upsert: true,
            contentType: blob.type || "image/jpeg",
          });
          if (up.error) throw up.error;
          const { error } = await supabase.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
          if (error) throw error;
        } catch (err) {
          falhas.push(`${d.nome}: foto não importada (${err instanceof Error ? err.message : "erro"})`);
        }
      }

      if (!a.turmaId || !alunoId) continue;
      const modalidade = turmas.find((t) => t.id === a.turmaId)?.modalidade || d.modalidade || "Natação";
      const jaMatriculado = matriculas.some(
        (m) => m.aluno_id === alunoId && m.turma_id === a.turmaId && m.status === "ativa",
      );
      if (jaMatriculado) continue;

      if (a.acao === "atualizar") {
        // Um aluno pertence a apenas uma turma: encerra matrículas anteriores
        await supabase.from("matriculas").delete().eq("aluno_id", alunoId);
      }
      const { data: sessaoAtual } = await supabase.auth.getSession();
      const { error: erroMat } = await supabase.from("matriculas").insert({
        aluno_id: alunoId,
        turma_id: a.turmaId,
        status: "ativa",
        modalidade,
        data_inicio: new Date().toISOString().slice(0, 10),
        registrado_por: sessaoAtual.session?.user?.id ?? null,
      });
      if (erroMat) {
        falhas.push(`${d.nome}: ${erroMat.message}`);
        continue;
      }
      matriculados++;
    }

    setImportando(false);
    setAnalises([]);
    setArquivo("");
    setAberto(false);
    onImportado();
    toast.success(`${criados} criado(s) · ${atualizados} atualizado(s) · ${matriculados} matriculado(s)`);
    if (falhas.length) toast.error(`${falhas.length} falha(s): ${falhas.slice(0, 3).join(" · ")}`);
  }

  const invalidas = analises.filter((a) => a.erros.length);
  const validas = analises.filter((a) => !a.erros.length);
  const paraAtualizar = validas.filter((a) => a.acao === "atualizar").length;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Importar alunos por planilha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use um arquivo Excel (.xlsx) ou CSV com a primeira linha de cabeçalho. As colunas são detectadas
            automaticamente; apenas <strong>Nome</strong> é obrigatória. As colunas <strong>Turma</strong> e
            <strong> Modalidade</strong> definem a matrícula (Natação e Hidroginástica têm turmas distintas no mesmo
            horário). A coluna <strong>Foto</strong> aceita o link da imagem (inclusive Google Drive) e também imagens coladas direto na célula.
          </p>

          <div className="space-y-2">
            <Label>Ao encontrar um aluno já cadastrado</Label>
            <Select value={modo} onValueChange={(v) => trocarModo(v as "criar" | "atualizar")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atualizar">Atualizar existentes (não duplica)</SelectItem>
                <SelectItem value="criar">Somente novos (marca duplicados como erro)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={baixarModelo}>
            <Download className="size-4" /> Baixar modelo
          </Button>

          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void selecionar(e.target.files?.[0] ?? null)}
            />
            {arquivo ? <p className="text-xs text-muted-foreground">{arquivo}</p> : null}
          </div>

          {analises.length ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{validas.length} válida(s)</Badge>
                {paraAtualizar ? <Badge variant="outline">{paraAtualizar} atualização(ões)</Badge> : null}
                {invalidas.length ? <Badge variant="destructive">{invalidas.length} com erro</Badge> : null}
              </div>

              {invalidas.length ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <AlertTriangle className="size-4 text-destructive" />
                  <span className="text-sm">Linhas inválidas não serão importadas.</span>
                  <Button size="sm" variant="outline" onClick={baixarErros}>
                    <Download className="size-4" /> Baixar planilha de erros
                  </Button>
                </div>
              ) : null}

              <div className="max-h-72 overflow-auto rounded-lg border border-border/70">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-secondary/80">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Nome</th>
                      <th className="p-2">CPF</th>
                      <th className="p-2">Celular</th>
                      <th className="p-2">Turma</th>
                      <th className="p-2">Foto</th>
                      <th className="p-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analises.map((a, i) => (
                      <tr
                        key={i}
                        className={`border-t border-border/60 ${a.erros.length ? "bg-destructive/10" : ""}`}
                      >
                        <td className="p-2 text-muted-foreground">{i + 2}</td>
                        <td className="p-2">{a.dados.nome || "—"}</td>
                        <td className="p-2">{a.dados.cpf || texto(a.original["CPF"])}</td>
                        <td className="p-2">{a.dados.telefone || "—"}</td>
                        <td className="p-2">{a.dados.turmaNome || "—"}</td>
                        <td className="p-2">{a.dados.fotoEmbutida ? "imagem" : a.dados.foto ? "link" : "—"}</td>
                        <td className="p-2">
                          {a.erros.length ? (
                            <span className="text-destructive">{a.erros.join(" · ")}</span>
                          ) : (
                            <span className="text-muted-foreground">
                              {a.acao === "atualizar" ? "Atualizar" : "Criar"}
                              {a.avisos.length ? ` · ${a.avisos.join(" · ")}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button disabled={importando || !validas.length} onClick={() => void importar()}>
                <Upload className="size-4" /> {importando ? "Importando..." : `Importar ${validas.length} linha(s) válida(s)`}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
