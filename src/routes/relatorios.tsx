import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, Download, FileSpreadsheet, FileText, IdCard, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ConversarWhatsApp } from "@/components/ConversarWhatsApp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { notificarAtestadoVencendo, notificarAtestadoVencido, diasParaVencer, vencimentoAtestado } from "@/lib/atestado";
import { usePrazoAvisoAtestado } from "@/lib/configuracoes";
import { montarPlanilhaAlunos, ExportacaoCancelada, type AlunoPlanilha } from "@/lib/planilha-alunos";
import { linksArquivosFn } from "@/lib/links-arquivos.functions";

import { gerarCrachasPdfFielAoPreview, type DadosCracha } from "@/lib/cracha";
import { FAIXAS_ETARIAS, TURNOS, faixaEtariaECA, turnoDoHorario } from "@/lib/turnos";
import { GRUPOS_DIAS_PADRAO } from "@/lib/dias";
import { Checkbox } from "@/components/ui/checkbox";


export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
  head: () => ({
    meta: [
      { title: "Relatórios e backup | Arena Aquática" },
      {
        name: "description",
        content: "Acompanhe atestados vencendo, exporte planilhas e crachás e faça o backup no Google Drive.",
      },
      { property: "og:title", content: "Relatórios e backup | Arena Aquática" },
      { property: "og:description", content: "Atestados a vencer, exportações e backup da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Aluno = AlunoPlanilha & {
  codigo: string;
  foto_path: string | null;
  telefone: string | null;
  cpf: string | null;
  pcd: boolean;
};
type Turma = { id: string; nome: string; horario: string | null; dias_semana: string[]; modalidade: string; capacidade: number };
type Matricula = { id: string; aluno_id: string; turma_id: string; modalidade: string; status: string };

const PRAZOS = [15, 30, 45, 60, 90];

const PARAMETROS = [
  { id: "situacao", rotulo: "Ativos/Inativos" },
  { id: "pcd", rotulo: "Alunos PCD" },
  { id: "faixa", rotulo: "Faixa etária" },
  { id: "sexo", rotulo: "Sexo" },
  { id: "modalidade", rotulo: "Modalidade" },
  { id: "horario", rotulo: "Horários" },
  { id: "dias", rotulo: "Dias" },
  { id: "turno", rotulo: "Turno" },
] as const;

type ParametroId = (typeof PARAMETROS)[number]["id"];

/** Rótulo dos dias de uma turma, igual ao do formulário (ex.: "Terça e Quinta"). */
function rotuloDias(dias: string[] | null | undefined) {
  const d = dias ?? [];
  if (!d.length) return "";
  const chave = [...d].sort().join("|");
  const grupo = GRUPOS_DIAS_PADRAO.find((g) => [...g.dias].sort().join("|") === chave);
  return grupo ? grupo.label : d.join(" e ");
}
const ORDEM_FILTROS: ParametroId[] = ["faixa", "sexo", "modalidade", "horario", "dias", "turno", "pcd", "situacao"];
const ROTULO_FILTRO: Record<ParametroId, string> = {
  faixa: "Faixa etária",
  sexo: "Sexo",
  modalidade: "Modalidade",
  horario: "Horários",
  dias: "Dias",
  turno: "Turno",
  pcd: "Alunos PCD",
  situacao: "Ativos e Inativos",
};
type PontoGrafico = { nome: string; total: number; alunos: Aluno[] };

function RelatoriosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [valoresEscolhidosEstado, setValoresEscolhidos] = useState<Partial<Record<ParametroId, string[]>>>({});
  const valoresEscolhidos = valoresEscolhidosEstado;
  const parametros = useMemo<ParametroId[]>(() => {
    const comValor = ORDEM_FILTROS.filter((id) => valoresEscolhidos[id]?.length);
    return comValor.length ? comValor : ["faixa"];
  }, [valoresEscolhidos]);
  const modoGrafico = "cruzado" as "cruzado" | "separado";
  const [detalhe, setDetalhe] = useState<{ titulo: string; alunos: Aluno[] } | null>(null);
  const { valor: prazo, salvar: salvarPrazo } = usePrazoAvisoAtestado();
  const [prazoEditado, setPrazoEditado] = useState<string>("");
  const [exportando, setExportando] = useState(false);
  const [progressoPlanilha, setProgressoPlanilha] = useState<{ feitos: number; total: number } | null>(null);
  const cancelarRef = useRef<AbortController | null>(null);

  async function exportarPlanilha() {
    const controle = new AbortController();
    cancelarRef.current = controle;
    setExportando(true);
    setProgressoPlanilha({ feitos: 0, total: alunos.length });
    try {
      const buffer = await montarPlanilhaAlunos({
        alunos,
        turmaDoAluno,
        modalidadeDoAluno,
        sinal: controle.signal,
        aoProgredir: (feitos, total) => setProgressoPlanilha({ feitos, total }),
        linksDrive: async () => await linksArquivosFn({ data: undefined }),

      });
      const url = URL.createObjectURL(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `alunos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha exportada em ordem crescente de idade");
    } catch (err) {
      if (err instanceof ExportacaoCancelada) toast.info("Exportação cancelada");
      else toast.error(err instanceof Error ? err.message : "Erro ao exportar planilha");
    } finally {
      cancelarRef.current = null;
      setExportando(false);
      setProgressoPlanilha(null);
    }
  }


  useEffect(() => {
    setPrazoEditado(String(prazo));
  }, [prazo]);

  async function carregar() {
    setCarregando(true);
    try {
      const [a, t, m] = await Promise.all([
        supabase.from("alunos").select("*").order("nome"),
        supabase.from("turmas").select("id,nome,horario,dias_semana,modalidade,capacidade").order("nome"),
        supabase.from("matriculas").select("*"),
      ]);
      if (a.error) throw a.error;
      setAlunos((a.data ?? []) as Aluno[]);
      setTurmas((t.data ?? []) as Turma[]);
      setMatriculas((m.data ?? []) as Matricula[]);

      const comFoto = ((a.data ?? []) as Aluno[]).filter((x) => x.foto_path);
      if (comFoto.length) {
        const { data: signed } = await supabase.storage
          .from("fotos-alunos")
          .createSignedUrls(comFoto.map((x) => x.foto_path as string), 3600);
        const mapa: Record<string, string> = {};
        signed?.forEach((s, i) => {
          const aluno = comFoto[i];
          if (s.signedUrl && aluno) mapa[aluno.id] = s.signedUrl;
        });
        setFotos(mapa);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function matriculaDoAluno(id: string) {
    return matriculas.find((m) => m.aluno_id === id);
  }
  function turmaDoAluno(id: string) {
    const m = matriculaDoAluno(id);
    return m ? turmas.find((t) => t.id === m.turma_id) : undefined;
  }
  function modalidadeDoAluno(id: string) {
    return matriculaDoAluno(id)?.modalidade ?? turmaDoAluno(id)?.modalidade ?? "";
  }

  const vencidos = useMemo(
    () => alunos.filter(notificarAtestadoVencido),
    [alunos],
  );
  const vencendo = useMemo(
    () =>
      alunos
        .filter((a) => notificarAtestadoVencendo(a, prazo))
        .sort((x, y) => diasParaVencer(x.atestado_data) - diasParaVencer(y.atestado_data)),
    [alunos, prazo],
  );

  const relatorio = useMemo(
    () =>
      [...vencidos.map((a) => ({ aluno: a, situacao: "Vencido" as const })), ...vencendo.map((a) => ({ aluno: a, situacao: "A vencer" as const }))],
    [vencidos, vencendo],
  );

  function linhasRelatorio() {
    return relatorio.map(({ aluno, situacao }) => {
      const t = turmaDoAluno(aluno.id);
      const venc = vencimentoAtestado(aluno.atestado_data);
      return [
        aluno.codigo,
        aluno.nome,
        aluno.telefone ?? "",
        aluno.responsavel ?? "",
        modalidadeDoAluno(aluno.id),
        t?.nome ?? "",
        t?.horario ?? "",
        aluno.atestado_data ?? "",
        venc ? venc.toLocaleDateString("pt-BR") : "",
        situacao,
        situacao === "Vencido" ? "0" : String(diasParaVencer(aluno.atestado_data)),
      ];
    });
  }

  const CABECALHO_RELATORIO = [
    "Matrícula",
    "Aluno",
    "Celular",
    "Responsável",
    "Modalidade",
    "Turma",
    "Horário",
    "Data do atestado",
    "Vence em",
    "Situação",
    "Dias restantes",
  ];

  function exportarCsv() {
    if (!relatorio.length) return toast.error("Nenhum atestado vencido ou a vencer");
    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [CABECALHO_RELATORIO, ...linhasRelatorio()].map((l) => l.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `atestados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado em CSV");
    return;
  }

  async function exportarPdf() {
    if (!relatorio.length) return toast.error("Nenhum atestado vencido ou a vencer");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const larguras = [18, 44, 26, 36, 22, 28, 22, 24, 22, 18, 16];
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Atestados vencidos e a vencer — Arena Aquática", 12, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Prazo de aviso: ${prazo} dias · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 12, 16.5);

    const escreverLinha = (celulas: string[], negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(8);
      let x = 12;
      celulas.forEach((c, i) => {
        const largura = larguras[i] ?? 24;
        doc.text(doc.splitTextToSize(c, largura - 2)[0] ?? "", x, y);
        x += largura;
      });
      y += 5.5;
    };

    y += 6;
    escreverLinha(CABECALHO_RELATORIO, true);
    doc.setDrawColor(200);
    doc.line(12, y - 4, 285, y - 4);

    for (const linha of linhasRelatorio()) {
      if (y > 195) {
        doc.addPage();
        y = 18;
        escreverLinha(CABECALHO_RELATORIO, true);
      }
      escreverLinha(linha);
    }

    doc.save(`atestados-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório exportado em PDF");
    return;
  }

  function valoresDe(id: ParametroId, a: Aluno): string[] {
    let v: string | string[];
    switch (id as ParametroId) {
      case "situacao": v = a.ativo === false ? "Inativos" : "Ativos"; break;
      case "pcd": v = a.pcd ? "PCD" : "Não PCD"; break;
      case "faixa": v = a.faixa_etaria || faixaEtariaECA(a.data_nascimento, a.idade) || ""; break;
      case "sexo": v = a.sexo ?? ""; break;
      case "modalidade": v = modalidadeDoAluno(a.id); break;
      case "horario": v = turmaDoAluno(a.id)?.horario ?? ""; break;
      case "dias": v = rotuloDias(turmaDoAluno(a.id)?.dias_semana); break;
      case "turno": v = turnoDoHorario(turmaDoAluno(a.id)?.horario) || ""; break;
    }
    return (Array.isArray(v) ? v : [v]).map((x) => x || "Não informado");
  }

  const contarPor = (lista: Aluno[], chavesDe: (a: Aluno) => string[]) => {
    const mapa = new Map<string, Aluno[]>();
    for (const a of lista) {
      for (const chave of new Set(chavesDe(a))) {
        const atual = mapa.get(chave);
        if (atual) atual.push(a);
        else mapa.set(chave, [a]);
      }
    }
    return [...mapa.entries()]
      .map(([nome, l]): PontoGrafico => ({ nome, total: l.length, alunos: l }))
      .sort((x, y) => y.total - x.total);
  };

  /** Opções disponíveis de cada parâmetro (sobre todos os alunos). */
  const opcoesParametro = useMemo(() => {
    const r = {} as Record<ParametroId, string[]>;
    const fixos: Partial<Record<ParametroId, readonly string[]>> = {
      situacao: ["Ativos", "Inativos"],
      pcd: ["PCD", "Não PCD"],
      faixa: FAIXAS_ETARIAS,
      turno: TURNOS,
      dias: Array.from(new Set(turmas.map((t) => rotuloDias(t.dias_semana)).filter(Boolean))),
    };
    for (const p of PARAMETROS) {
      const encontrados = p.id === "dias" ? [] : contarPor(alunos, (a) => valoresDe(p.id, a)).map((x) => x.nome);
      const base = fixos[p.id] ?? [];
      const extras = encontrados.filter((v) => !base.includes(v)).sort((x, y) => x.localeCompare(y, "pt-BR"));
      r[p.id] = [...base, ...extras];
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunos, turmas, matriculas]);

  /** Alunos que atendem aos valores escolhidos em todos os parâmetros selecionados. */
  const alunosFiltrados = useMemo(
    () =>
      alunos.filter((a) =>
        parametros.every((id) => {
          const escolhidos = valoresEscolhidos[id];
          if (!escolhidos?.length) return true;
          return valoresDe(id, a).some((v) => escolhidos.includes(v));
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alunos, turmas, matriculas, parametros, valoresEscolhidos],
  );

  const passaValor = (id: ParametroId, v: string) => {
    const escolhidos = valoresEscolhidos[id];
    return !escolhidos?.length || escolhidos.includes(v);
  };

  const graficos = useMemo(() => {
    const r = {} as Record<ParametroId, PontoGrafico[]>;
    for (const p of PARAMETROS) r[p.id] = contarPor(alunosFiltrados, (a) => valoresDe(p.id, a).filter((v) => passaValor(p.id, v)));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunosFiltrados, valoresEscolhidos]);

  /** Gráfico único cruzando as combinações dos parâmetros selecionados. */
  const graficoCruzado = useMemo(() => {
    if (!parametros.length) return [] as PontoGrafico[];
    return contarPor(alunosFiltrados, (a) => {
      let combos: string[] = [""];
      for (const id of parametros) {
        const vs = valoresDe(id, a).filter((v) => passaValor(id, v));
        combos = combos.flatMap((c) => vs.map((v) => (c ? `${c} · ${v}` : v)));
      }
      return combos;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunosFiltrados, parametros, valoresEscolhidos]);

  const rotuloCruzado = parametros.map((id) => PARAMETROS.find((p) => p.id === id)?.rotulo ?? id).join(" × ");
  const descricaoFiltros = parametros
    .filter((id) => valoresEscolhidos[id]?.length)
    .map((id) => `${PARAMETROS.find((p) => p.id === id)?.rotulo}: ${valoresEscolhidos[id]!.join(", ")}`)
    .join(" | ");

  function secoesGrafico(): { id: string; rotulo: string; dados: PontoGrafico[] }[] {
    if (modoGrafico === "cruzado") return [{ id: "cruzado", rotulo: rotuloCruzado, dados: graficoCruzado }];
    return parametros.map((id) => ({ id, rotulo: PARAMETROS.find((p) => p.id === id)?.rotulo ?? id, dados: graficos[id] ?? [] }));
  }

  function baixarArquivo(conteudo: BlobPart, nome: string, tipo: string) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarGraficosCsv() {
    if (!parametros.length) {
      toast.error("Selecione ao menos um parâmetro");
      return;
    }
    const linhas = [["Parâmetro", "Categoria", "Alunos"]];
    if (descricaoFiltros) linhas.unshift(["Filtros", descricaoFiltros, ""]);
    for (const secao of secoesGrafico()) {
      for (const ponto of secao.dados) linhas.push([secao.rotulo, ponto.nome, String(ponto.total)]);
    }
    const csv = linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    baixarArquivo("\uFEFF" + csv, `graficos-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    toast.success("CSV dos gráficos exportado");
  }

  async function svgParaImagem(svg: SVGSVGElement, escala = 2) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const largura = svg.clientWidth || 600;
    const altura = svg.clientHeight || 300;
    clone.setAttribute("width", String(largura));
    clone.setAttribute("height", String(altura));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll("text").forEach((t) => {
      t.setAttribute("fill", "#111827");
      t.setAttribute("font-family", "Arial, sans-serif");
    });
    clone.querySelectorAll("path,line").forEach((el) => {
      const stroke = el.getAttribute("stroke");
      if (!stroke || stroke.includes("var(")) el.setAttribute("stroke", "#d1d5db");
    });
    clone.querySelectorAll("rect,path").forEach((el) => {
      const fill = el.getAttribute("fill");
      if (fill && fill.includes("var(")) el.setAttribute("fill", "#0ea5a4");
    });
    const texto = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Falha ao converter o gráfico"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dados: canvas.toDataURL("image/png"), largura, altura };
  }

  async function exportarGraficosPdf() {
    if (!parametros.length) {
      toast.error("Selecione ao menos um parâmetro");
      return;
    }
    const idToast = toast.loading("Gerando PDF dos gráficos…");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const margem = 40;
      const larguraUtil = pdf.internal.pageSize.getWidth() - margem * 2;
      let y = margem;

      pdf.setFontSize(16);
      pdf.text("Relatório de alunos por parâmetro", margem, y);
      y += 18;
      pdf.setFontSize(10);
      pdf.text(
        `Gerado em ${new Date().toLocaleString("pt-BR")} · ${alunosFiltrados.length} aluno(s) · Parâmetros: ${rotuloCruzado}`,
        margem,
        y,
      );
      y += 14;
      if (descricaoFiltros) {
        for (const l of pdf.splitTextToSize(`Filtros: ${descricaoFiltros}`, larguraUtil) as string[]) {
          pdf.text(l, margem, y);
          y += 12;
        }
      }
      y += 8;

      for (const { id, rotulo, dados } of secoesGrafico()) {
        const svg = document.querySelector<SVGSVGElement>(`#grafico-${id} svg`);

        if (y > pdf.internal.pageSize.getHeight() - 160) {
          pdf.addPage();
          y = margem;
        }
        pdf.setFontSize(12);
        pdf.text(rotulo, margem, y);
        y += 10;

        if (svg) {
          const img = await svgParaImagem(svg);
          const altura = (img.altura / img.largura) * larguraUtil;
          if (y + altura > pdf.internal.pageSize.getHeight() - margem) {
            pdf.addPage();
            y = margem;
          }
          pdf.addImage(img.dados, "PNG", margem, y, larguraUtil, altura);
          y += altura + 10;
        }

        pdf.setFontSize(9);
        for (const ponto of dados) {
          if (y > pdf.internal.pageSize.getHeight() - margem) {
            pdf.addPage();
            y = margem;
          }
          pdf.text(`${ponto.nome}: ${ponto.total} aluno(s)`, margem, y);
          y += 12;
        }
        y += 14;
      }

      pdf.save(`graficos-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF dos gráficos gerado", { id: idToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o PDF", { id: idToast });
    }
  }




  async function aplicarPrazo(valor: string) {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 1) return toast.error("Informe um prazo válido em dias");
    try {
      await salvarPrazo(Math.round(numero));
      toast.success(`Aviso configurado para ${Math.round(numero)} dias antes do vencimento`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a configuração");
    }
    return;
  }

  return (
    <AppShell title="Relatórios" subtitle="Atestados, exportações e backup da Arena Aquática">
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Settings2 className="size-4" /> Prazo do aviso de atestado
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label>Avisar com antecedência de</Label>
            <div className="flex items-center gap-2">
              <Select value={PRAZOS.includes(Number(prazoEditado)) ? prazoEditado : "custom"} onValueChange={(v) => v !== "custom" && setPrazoEditado(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Prazo" />
                </SelectTrigger>
                <SelectContent>
                  {PRAZOS.map((p) => (
                    <SelectItem key={p} value={String(p)}>{p} dias</SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="w-24"
                type="number"
                min={1}
                value={prazoEditado}
                onChange={(e) => setPrazoEditado(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>
          <Button onClick={() => void aplicarPrazo(prazoEditado)}>Salvar prazo</Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <FileSpreadsheet className="size-4" /> Planilha de alunos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={exportando} onClick={() => void exportarPlanilha()}>
              <FileSpreadsheet className="size-4" /> {exportando ? "Exportando..." : "Exportar planilha"}
            </Button>
            {exportando ? (
              <Button variant="destructive" onClick={() => cancelarRef.current?.abort()}>
                Cancelar exportação
              </Button>
            ) : null}
          </div>
          {progressoPlanilha ? (
            <p className="text-xs text-muted-foreground">
              Processando imagens: {progressoPlanilha.feitos} de {progressoPlanilha.total}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <BarChart3 className="size-4" /> Alunos por parâmetro
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarGraficosCsv}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportarGraficosPdf()}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ORDEM_FILTROS.map((id) => {
                const rotulo = ROTULO_FILTRO[id];
                const escolhidos = valoresEscolhidos[id] ?? [];
                const resumo = !escolhidos.length ? "Todos" : escolhidos.length === 1 ? escolhidos[0] : `${escolhidos.length} selecionados`;
                return (
                  <div key={id} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{rotulo}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-11 w-full justify-between font-medium">
                          <span className="truncate">{resumo}</span>
                          <ChevronDown className="size-4 opacity-70" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-2">
                        <div className="max-h-72 space-y-1 overflow-y-auto">
                          {(opcoesParametro[id] ?? []).map((v) => {
                            const marcado = escolhidos.includes(v);
                            return (
                              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                                <Checkbox
                                  checked={marcado}
                                  onCheckedChange={() =>
                                    setValoresEscolhidos((atual) => ({
                                      ...atual,
                                      [id]: marcado ? escolhidos.filter((x) => x !== v) : [...escolhidos, v],
                                    }))
                                  }
                                />
                                {v}
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setValoresEscolhidos({})}>
                Limpar filtros
              </Button>
              <p className="text-xs text-muted-foreground">{alunosFiltrados.length} aluno(s) no resultado</p>
            </div>
          </div>

          {!parametros.length ? (
            <p className="text-sm text-muted-foreground">Selecione um ou mais parâmetros para ver os gráficos.</p>
          ) : (
            <div className={modoGrafico === "cruzado" ? "grid gap-6" : "grid gap-6 lg:grid-cols-2"}>
              {secoesGrafico().map(({ id, rotulo, dados }) => {
                const totalBase = alunosFiltrados.length || 1;
                const maior = dados[0];
                const comPct = dados.map((d) => ({ ...d, rotuloBarra: `${d.total} (${Math.round((d.total / totalBase) * 100)}%)` }));
                return (
                  <div key={id} id={`grafico-${id}`} className="rounded-xl border border-border p-3">
                    <div className="mb-3 space-y-1">
                      <p className="text-sm font-semibold">
                        {id === "cruzado" ? "Quantos alunos há em cada combinação de " : "Quantos alunos há em cada opção de "}
                        <span className="text-primary">{rotulo}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Base: {alunosFiltrados.length} aluno(s){descricaoFiltros ? ` · Filtros: ${descricaoFiltros}` : " · sem filtros de valor"}
                      </p>
                      {maior ? (
                        <p className="text-xs">
                          Maior grupo: <strong>{maior.nome}</strong> com {maior.total} aluno(s).
                        </p>
                      ) : null}
                    </div>
                    {!dados.length ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Nenhum aluno com esses filtros.</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(200, dados.length * 38 + 50)}>
                          <BarChart data={comPct} layout="vertical" margin={{ left: 8, right: 70 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                            <XAxis
                              type="number"
                              allowDecimals={false}
                              fontSize={12}
                              label={{ value: "Número de alunos", position: "insideBottom", offset: -2, fontSize: 11 }}
                              height={40}
                            />
                            <YAxis type="category" dataKey="nome" width={id === "cruzado" ? 240 : 140} fontSize={12} />
                            <Tooltip
                              formatter={(v: number) => [`${v} aluno(s) · ${Math.round((v / totalBase) * 100)}% da base`, "Total"]}
                              labelFormatter={(l: string) => (id === "cruzado" ? l.split(" · ").join(" + ") : l)}
                            />
                            <Bar
                              dataKey="total"
                              radius={[0, 6, 6, 0]}
                              fill="hsl(var(--primary))"
                              cursor="pointer"
                              onClick={(ponto: unknown) => {
                                const dado = ponto as { payload?: PontoGrafico };
                                if (dado?.payload) setDetalhe({ titulo: `${rotulo}: ${dado.payload.nome}`, alunos: dado.payload.alunos });
                              }}
                            >
                              <LabelList dataKey="rotuloBarra" position="right" fontSize={12} className="fill-foreground" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p className="mt-1 text-center text-xs text-muted-foreground">
                          Cada barra mostra a quantidade de alunos e a porcentagem da base. Clique em uma barra para ver a lista de alunos.
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detalhe)} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{detalhe?.titulo}</DialogTitle>
            <DialogDescription>{detalhe?.alunos.length ?? 0} aluno(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {(detalhe?.alunos ?? [])
              .slice()
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                   <span><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span> · {a.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {turmaDoAluno(a.id)?.nome ?? "Sem turma"}
                  </span>
                </div>
              ))}
            {!detalhe?.alunos.length && <p className="text-sm text-muted-foreground">Nenhum aluno.</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!detalhe) return;
              const csv =
                "\uFEFF" +
                 [["Matrícula", "Nome", "Turma"], ...detalhe.alunos.map((a) => [a.codigo, a.nome, turmaDoAluno(a.id)?.nome ?? ""])]
                  .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
                  .join("\n");
              baixarArquivo(csv, `alunos-${detalhe.titulo.replace(/[^\w]+/g, "-").toLowerCase()}.csv`, "text/csv;charset=utf-8");
            }}
          >
            <Download className="size-4" /> Exportar lista (CSV)
          </Button>
        </DialogContent>
      </Dialog>



      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <AlertTriangle className="size-4 text-destructive" /> Atestados vencidos e a vencer
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarCsv}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportarPdf()}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="py-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !relatorio.length ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nenhum atestado vencido ou vencendo nos próximos {prazo} dias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    {CABECALHO_RELATORIO.map((c) => (
                      <th key={c} className="py-2 pr-4 font-medium">{c}</th>
                    ))}
                    <th className="py-2 pr-4 font-medium">Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.map(({ aluno, situacao }) => {
                    const t = turmaDoAluno(aluno.id);
                    const venc = vencimentoAtestado(aluno.atestado_data);
                    return (
                      <tr key={aluno.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{aluno.codigo}</td>
                        <td className="py-2 pr-4 font-medium">{aluno.nome}</td>
                        <td className="py-2 pr-4">{aluno.telefone ?? "—"}</td>
                        <td className="py-2 pr-4">{aluno.responsavel ?? "—"}</td>
                        <td className="py-2 pr-4">{modalidadeDoAluno(aluno.id) || "—"}</td>
                        <td className="py-2 pr-4">{t?.nome ?? "—"}</td>
                        <td className="py-2 pr-4">{t?.horario ?? "—"}</td>
                        <td className="py-2 pr-4">{aluno.atestado_data ?? "—"}</td>
                        <td className="py-2 pr-4">{venc ? venc.toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={situacao === "Vencido" ? "destructive" : "secondary"}>{situacao}</Badge>
                        </td>
                        <td className="py-2 pr-4">{situacao === "Vencido" ? 0 : diasParaVencer(aluno.atestado_data)}</td>
                        <td className="py-2 pr-4"><ConversarWhatsApp telefone={aluno.telefone} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
