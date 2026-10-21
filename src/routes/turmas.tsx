import { usePermissoes } from "@/lib/permissoes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users, Trash2, Pencil, Clock, CalendarDays, Printer, Search } from "lucide-react";
import { normalizarTexto } from "@/lib/formatacao";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHorarios } from "@/lib/horarios";
import { TURNOS, turnoDoHorario } from "@/lib/turnos";
import { MODALIDADES, MODALIDADE_PADRAO } from "@/lib/modalidades";
import { BotoesChamada, MarcarTodosPresentes, ProgressoChamada } from "@/components/Chamada";
import { EtiquetaSituacao } from "@/components/EtiquetaSituacao";
import { situacaoDoAluno } from "@/lib/situacao";
import { resumoChamada } from "@/lib/chamada";
import { formatarDataCurta, licencaVigente, type LicencaMedica } from "@/lib/licenca";

import { useGruposDias, diasDoLabel } from "@/lib/dias";
import { AppShell } from "@/components/AppShell";
import { PerfilAluno } from "@/components/PerfilAluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/turmas")({
  validateSearch: (s: Record<string, unknown>): { turma?: string } => (typeof s['turma'] === "string" ? { turma: s['turma'] } : {}),
  component: TurmasPage,
  head: () => ({
    meta: [
      { title: "Turmas | Esporte 360" },
      { name: "description", content: "Organize as turmas esportivas com horários e professores." },
      { property: "og:title", content: "Turmas | Esporte 360" },
      { property: "og:description", content: "Gestão de turmas e horários do Esporte 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Turma = {
  id: string;
  nome: string;
  modalidade: string;
  professor: string | null;
  dias_semana: string[];
  horario: string | null;
  capacidade: number;
  ativa: boolean;
};

type AlunoTurma = {
  id: string;
  nome: string;
  codigo: string;
  modalidade: string;
  status: string;
  pcd: boolean;
  foto_path: string | null;
  ativo: boolean;
  atestado_entregue: boolean | null;
  atestado_data: string | null;
};
type StatusPresenca = "presente" | "falta" | "falta_justificada";

const ROTULO_PRESENCA: Record<StatusPresenca, string> = {
  presente: "Presença",
  falta: "Falta",
  falta_justificada: "Falta justificada",
};

function TurmasPage() {
  const { minhasTurmas } = usePermissoes();
  const { horarios, lista: listaHorarios, recarregar: recarregarHorarios } = useHorarios();
  const { grupos, lista: listaGrupos, recarregar: recarregarGrupos } = useGruposDias();
  const [gerenciarDias, setGerenciarDias] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState("");
  const [filtroDias, setFiltroDias] = useState("todos");
  const [gerenciarHorarios, setGerenciarHorarios] = useState(false);
  const [perfilAlunoId, setPerfilAlunoId] = useState<string | null>(null);

  function grupoDosDias(dias: string[] | null) {
    const g = listaGrupos.find((x) => x.dias.length && x.dias.every((d) => (dias ?? []).includes(d)));
    return g?.label ?? "";
  }

  async function adicionarGrupo(e: React.FormEvent) {
    e.preventDefault();
    const label = novoGrupo.trim();
    if (!label) return;
    const ordem = (grupos.at(-1)?.ordem ?? 0) + 1;
    const { error } = await supabase
      .from("grupos_dias")
      .insert({ label, dias: diasDoLabel(label), ordem });
    if (error) return toast.error(error.message);
    setNovoGrupo("");
    toast.success("Dias adicionados");
    void recarregarGrupos();
    return;
  }

  async function removerGrupo(id: string) {
    const { error } = await supabase.from("grupos_dias").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dias removidos");
    void recarregarGrupos();
    return;
  }

  const [novoHorario, setNovoHorario] = useState("");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Turma | null>(null);
  const [modalidade, setModalidade] = useState<string>(MODALIDADE_PADRAO);
  const [professor, setProfessor] = useState("");
  const [grupo, setGrupo] = useState("");
  const [horario, setHorario] = useState("");
  const [capacidade, setCapacidade] = useState("40");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [filtroHorario, setFiltroHorario] = useState("todos");
  const [filtroTurno, setFiltroTurno] = useState("todos");

  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [statusPresenca, setStatusPresenca] = useState<Record<string, StatusPresenca>>({});
  const [licencasTurma, setLicencasTurma] = useState<LicencaMedica[]>([]);
  const [observacoesPresenca, setObservacoesPresenca] = useState<Record<string, string>>({});
  const [editandoObservacao, setEditandoObservacao] = useState<{ alunoId: string; nome: string; texto: string } | null>(null);
  const [turmaAberta, setTurmaAberta] = useState<Turma | null>(null);
  const [buscaAluno, setBuscaAluno] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; nome: string } | null>(null);
  const diaHoje = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date().getDay()];
  function temAulaHoje(t: Turma) {
    return (t.dias_semana ?? []).some((d) => normalizarTexto(d).slice(0, 3) === diaHoje);
  }
  const [alunosTurma, setAlunosTurma] = useState<AlunoTurma[] | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Turma | null>(null);

  async function carregar() {
    const [t, m] = await Promise.all([
      supabase.from("turmas").select("*").order("nome"),
      supabase.from("matriculas").select("turma_id"),
    ]);
    if (t.data) setTurmas(t.data as Turma[]);
    if (m.data) {
      const c: Record<string, number> = {};
      for (const row of m.data as { turma_id: string }[]) c[row.turma_id] = (c[row.turma_id] ?? 0) + 1;
      setContagem(c);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const { turma: turmaInicial } = Route.useSearch();
  const [turmaInicialAberta, setTurmaInicialAberta] = useState(false);
  useEffect(() => {
    if (!turmaInicial || turmaInicialAberta) return;
    const t = turmas.find((x) => x.id === turmaInicial);
    if (t) {
      setTurmaInicialAberta(true);
      void abrirTurma(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaInicial, turmas]);

  function abrirNova() {
    setEditando(null);
    setModalidade(MODALIDADE_PADRAO);
    setProfessor("");
    setGrupo("");
    setHorario("");
    setCapacidade("40");
    setAberto(true);
  }

  function abrirEdicao(t: Turma) {
    setEditando(t);
    setModalidade(t.modalidade);
    setProfessor(t.professor ?? "");
    setGrupo(grupoDosDias(t.dias_semana));
    setHorario(t.horario ?? "");
    setCapacidade(String(t.capacidade ?? 40));
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dias = listaGrupos.find((g) => g.label === grupo)?.dias ?? [];
    if (!dias.length) return toast.error("Selecione os dias da semana");
    if (!horario) return toast.error("Selecione o horário");
    const payload = {
      nome: `${modalidade} — ${grupo} — ${horario}`,
      modalidade,
      professor: professor || null,
      dias_semana: [...dias],
      horario,
      capacidade: Number(capacidade) || 40,
    };
    const { error } = editando
      ? await supabase.from("turmas").update(payload).eq("id", editando.id)
      : await supabase.from("turmas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editando ? "Turma atualizada" : "Turma criada");
    setAberto(false);
    void carregar();
    return;
  }

  async function adicionarHorario(e: React.FormEvent) {
    e.preventDefault();
    const valor = novoHorario.trim();
    if (!valor) return;
    const ordem = (horarios.at(-1)?.ordem ?? 0) + 1;
    const { error } = await supabase.from("horarios").insert({ horario: valor, ordem });
    if (error) return toast.error(error.message);
    setNovoHorario("");
    toast.success("Horário adicionado");
    void recarregarHorarios();
    return;
  }

  async function removerHorario(id: string) {
    const { error } = await supabase.from("horarios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Horário removido");
    void recarregarHorarios();
    return;
  }

  async function excluirTurma(t: Turma) {
    const { error: e1 } = await supabase.from("matriculas").delete().eq("turma_id", t.id);
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("turmas").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Turma excluída");
    setConfirmarExclusao(null);
    void carregar();
    return;
  }

  async function abrirTurma(t: Turma) {
    setTurmaAberta(t);
    setBuscaAluno("");
    setAlunosTurma(null);
    setStatusPresenca({});
    setLicencasTurma([]);
    const { data, error } = await supabase
      .from("matriculas")
      .select("id,status,modalidade,alunos(id,nome,codigo,pcd,foto_path,ativo,atestado_entregue,atestado_data)")
      .eq("turma_id", t.id);
    if (error) {
      toast.error(error.message);
      setAlunosTurma([]);
      return;
    }
    const lista = (data ?? [])
      .map((m) => {
        const a = m.alunos as {
          id: string;
          nome: string;
          codigo: string;
          pcd: boolean;
          foto_path: string | null;
          ativo: boolean;
          atestado_entregue: boolean | null;
          atestado_data: string | null;
        } | null;
        return a
          ? {
              id: a.id,
              nome: a.nome,
               codigo: a.codigo,
              pcd: a.pcd,
              foto_path: a.foto_path,
              ativo: a.ativo,
              atestado_entregue: a.atestado_entregue,
              atestado_data: a.atestado_data,
              modalidade: m.modalidade as string,
              status: m.status as string,
            }
          : null;
      })
      .filter(Boolean) as AlunoTurma[];
    lista.sort((x, y) => x.nome.localeCompare(y.nome));
    setAlunosTurma(lista);
    if (lista.length) {
      const lic = await supabase.from("licencas_medicas").select("*").eq("status", "ativa").in("aluno_id", lista.map((a) => a.id));
      if (lic.data) setLicencasTurma(lic.data as LicencaMedica[]);
    }

    const caminhos = lista.map((a) => a.foto_path).filter(Boolean) as string[];
    if (caminhos.length) {
      const { data: signed } = await supabase.storage.from("fotos-alunos").createSignedUrls(caminhos, 3600);
      const mapa: Record<string, string> = {};
      let i = 0;
      for (const a of lista) {
        if (!a.foto_path) continue;
        const url = signed?.[i]?.signedUrl;
        if (url) mapa[a.id] = url;
        i++;
      }
      setFotos(mapa);
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const pres = await supabase
      .from("presencas")
      .select("aluno_id,status,observacoes")
      .eq("data", hoje)
      .in("aluno_id", lista.map((a) => a.id));
    if (pres.data) {
      const mapa: Record<string, StatusPresenca> = {};
      const mapaObs: Record<string, string> = {};
      for (const r of pres.data as { aluno_id: string; status: string; observacoes: string | null }[]) {
        mapa[r.aluno_id] = (r.status as StatusPresenca) ?? "presente";
        mapaObs[r.aluno_id] = r.observacoes ?? "";
      }
      setStatusPresenca(mapa);
      setObservacoesPresenca(mapaObs);
    }
  }

  async function registrarPresenca(alunoId: string, status: StatusPresenca) {
    const hoje = new Date().toISOString().slice(0, 10);
    const existente = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", alunoId)
      .eq("data", hoje)
      .maybeSingle();
    const { error } = existente.data
      ? await supabase
          .from("presencas")
          .update({ status, metodo: "manual", turma_id: turmaAberta?.id ?? null, horario: new Date().toISOString() })
          .eq("id", existente.data.id)
      : await supabase.from("presencas").insert({
          aluno_id: alunoId,
          turma_id: turmaAberta?.id ?? null,
          data: hoje,
          metodo: "manual",
          status,
        });
    if (error) return toast.error(error.message);
    setStatusPresenca((s) => ({ ...s, [alunoId]: status }));
    toast.success(ROTULO_PRESENCA[status] + " registrada");
    return;
  }

  /** Marca como presentes só quem ainda não tem registro hoje; quem está em licença fica de fora. */
  async function marcarTodosPresentes(ids: string[]) {
    if (!ids.length) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: existentes, error: erroConsulta } = await supabase
      .from("presencas")
      .select("aluno_id")
      .eq("data", hoje)
      .in("aluno_id", ids);
    if (erroConsulta) return void toast.error(erroConsulta.message);
    const jaTem = new Set((existentes ?? []).map((r) => String(r.aluno_id)));
    const novos = ids.filter((id) => !jaTem.has(id));
    if (novos.length) {
      const { error } = await supabase.from("presencas").insert(
        novos.map((id) => ({ aluno_id: id, turma_id: turmaAberta?.id ?? null, data: hoje, metodo: "manual", status: "presente" })),
      );
      if (error) return void toast.error(error.message);
    }
    setStatusPresenca((s) => ({ ...s, ...Object.fromEntries(novos.map((id) => [id, "presente" as StatusPresenca])) }));
    toast.success(`${novos.length} aluno(s) marcados como presentes`);
  }

  async function salvarObservacao() {
    if (!editandoObservacao) return;
    const { alunoId, texto } = editandoObservacao;
    const hoje = new Date().toISOString().slice(0, 10);
    const existente = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", alunoId)
      .eq("data", hoje)
      .maybeSingle();
    const { error } = existente.data
      ? await supabase
          .from("presencas")
          .update({ observacoes: texto || null, metodo: "manual", turma_id: turmaAberta?.id ?? null, horario: new Date().toISOString() })
          .eq("id", existente.data.id)
      : await supabase.from("presencas").insert({
          aluno_id: alunoId,
          turma_id: turmaAberta?.id ?? null,
          data: hoje,
          metodo: "manual",
          status: "falta_justificada",
          observacoes: texto || null,
        });
    if (error) return toast.error(error.message);
    setObservacoesPresenca((o) => ({ ...o, [alunoId]: texto }));
    setEditandoObservacao(null);
    toast.success("Observação salva");
    return;
  }

  const visiveis = turmas.filter(
    (t) =>
      (filtroModalidade === "todas" || t.modalidade === filtroModalidade) &&
      (filtroHorario === "todos" || t.horario === filtroHorario) &&
      (filtroTurno === "todos" || turnoDoHorario(t.horario) === filtroTurno) &&
      (filtroDias === "todos" || grupoDosDias(t.dias_semana) === filtroDias),
  ).sort((a, b) => {
    const ma = minhasTurmas.has(a.id), mb = minhasTurmas.has(b.id);
    if (ma !== mb) return ma ? -1 : 1;
    const ha = temAulaHoje(a), hb = temAulaHoje(b);
    if (ha !== hb) return ha ? -1 : 1;
    return ha ? (a.horario ?? "99").localeCompare(b.horario ?? "99") : 0;
  });

  const alunosVisiveis = (alunosTurma ?? []).filter((a) => {
    const b = normalizarTexto(buscaAluno);
    return !b || normalizarTexto(a.nome).includes(b) || normalizarTexto(a.codigo).includes(b);
  });

  const hojeChamada = new Date().toISOString().slice(0, 10);
  const licencaDoAluno = (id: string) => licencasTurma.find((l) => l.aluno_id === id && licencaVigente(l, hojeChamada));
  const chamada = resumoChamada(
    (alunosTurma ?? []).filter((a) => a.status === "ativa").map((a) => a.id),
    (id) => Boolean(statusPresenca[id]),
    (id) => Boolean(licencaDoAluno(id)),
  );

  async function imprimirLista(t: Turma) {
    const { data, error } = await supabase
      .from("matriculas")
      .select("alunos(nome,codigo)")
      .eq("turma_id", t.id)
      .eq("status", "ativa");
    if (error) return toast.error(error.message);
    const lista = (data ?? [])
      .map((m) => m.alunos as { nome: string; codigo: string } | null)
      .filter((a): a is { nome: string; codigo: string } => !!a)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    const colunas = 8;
    const larguraNome = 110;
    const larguraCol = (277 - 10 - 25 - larguraNome) / colunas;
    let y = 15;
    doc.setFontSize(14);
    doc.text(t.nome, 10, y);
    doc.setFontSize(9);
    doc.text(`${t.professor ? `Professor: ${t.professor} · ` : ""}${lista.length} aluno(s)`, 10, y + 6);
    y += 14;
    const cabecalho = () => {
      doc.setFont("helvetica", "bold");
      doc.rect(10, y, 277, 8);
      doc.text("Nº", 12, y + 5.5);
      doc.text("Aluno", 22, y + 5.5);
      doc.text("Matrícula", 22 + larguraNome, y + 5.5);
      for (let i = 0; i < colunas; i++) doc.text("___/___", 10 + 25 + larguraNome + i * larguraCol + 1, y + 5.5);
      doc.setFont("helvetica", "normal");
      y += 8;
    };
    cabecalho();
    lista.forEach((a, i) => {
      if (y > 195) { doc.addPage(); y = 15; cabecalho(); }
      doc.rect(10, y, 277, 8);
      doc.text(String(i + 1), 12, y + 5.5);
      doc.text(a.nome.slice(0, 60), 22, y + 5.5);
      doc.text(a.codigo ?? "", 22 + larguraNome, y + 5.5);
      for (let c = 0; c < colunas; c++) doc.rect(10 + 25 + larguraNome + c * larguraCol, y, larguraCol, 8);
      y += 8;
    });
    window.open(doc.output("bloburl"), "_blank");
    return;
  }


  return (
    <AppShell title="Turmas" subtitle="Modalidades, horários e professores">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as modalidades</SelectItem>
              {MODALIDADES.map((modalidade) => (
                <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroDias} onValueChange={setFiltroDias}>
            <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="todos">Todos os dias</SelectItem>
              {listaGrupos.map((g) => (
                <SelectItem key={g.label} value={g.label}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroTurno} onValueChange={setFiltroTurno}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os turnos</SelectItem>
              {TURNOS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroHorario} onValueChange={setFiltroHorario}>

            <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="todos">Todos os horários</SelectItem>
              {listaHorarios.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setGerenciarDias(true)}><CalendarDays className="size-4" /> Editar dias</Button>
          <Button variant="outline" onClick={() => setGerenciarHorarios(true)}><Clock className="size-4" /> Editar horários</Button>
          <Button onClick={abrirNova}><Plus className="size-4" /> Nova turma</Button>
        </div>
      </div>


      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editando ? "Editar turma" : "Nova turma"}</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da turma</Label>
              <Input readOnly value={grupo && horario ? `${modalidade} — ${grupo} — ${horario}` : "Definido após selecionar modalidade, dias e horário"} />
              <p className="text-xs text-muted-foreground">Gerado automaticamente a partir da modalidade, dos dias e do horário.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((modalidade) => (
                      <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Professor(a)</Label>
                <Input value={professor} onChange={(e) => setProfessor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger><SelectValue placeholder="Selecione os dias" /></SelectTrigger>
                <SelectContent>
                  {listaGrupos.map((g) => (
                    <SelectItem key={g.label} value={g.label}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Horário</Label>
                <Select value={horario} onValueChange={setHorario}>
                  <SelectTrigger><SelectValue placeholder="Selecione o horário" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {listaHorarios.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input type="number" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full">{editando ? "Salvar alterações" : "Criar turma"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((t) => (
          <Card
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => void abrirTurma(t)}
            onKeyDown={(e) => { if (e.key === "Enter") void abrirTurma(t); }}
            className="cursor-pointer overflow-hidden border-border/70 transition hover:border-primary/60 hover:shadow-pool"
          >
            <div className="h-1.5 bg-pool" />
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold">{t.nome}</h3>
                  <p className="text-sm text-muted-foreground">{t.modalidade}{t.professor ? ` · ${t.professor}` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{t.horario ?? "s/ horário"}</Badge>
                  {turnoDoHorario(t.horario) ? <Badge variant="outline">{turnoDoHorario(t.horario)}</Badge> : null}
                  {temAulaHoje(t) ? <Badge>Aula hoje</Badge> : null}
                </div>

              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.dias_semana.map((d) => (
                  <span key={d} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{d}</span>
                ))}
              </div>
              {(() => {
                const ocupados = contagem[t.id] ?? 0;
                const pct = t.capacidade ? (ocupados / t.capacidade) * 100 : 0;
                const cor = pct <= 70 ? "bg-success" : pct <= 90 ? "bg-warning" : "bg-destructive";
                return (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{Math.max(0, t.capacidade - ocupados)} vaga(s) livre(s)</p>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" /> {contagem[t.id] ?? 0} de {t.capacidade} vagas
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Imprimir/PDF"
                    aria-label="Imprimir/PDF"
                    onClick={(e) => { e.stopPropagation(); void imprimirLista(t); }}
                  >
                    <Printer className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Editar turma"
                    onClick={(e) => { e.stopPropagation(); abrirEdicao(t); }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    title="Excluir turma"
                    onClick={(e) => { e.stopPropagation(); setConfirmarExclusao(t); }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!visiveis.length && (
          <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhuma turma para este filtro.
          </p>
        )}
      </div>

      <PerfilAluno alunoId={perfilAlunoId} onFechar={() => setPerfilAlunoId(null)} />

      <Dialog open={!!turmaAberta} onOpenChange={(o) => !o && setTurmaAberta(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{turmaAberta?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {turmaAberta?.horario ?? "Sem horário"} · {alunosTurma?.length ?? 0} de {turmaAberta?.capacidade ?? 40} vagas
          </p>
          {alunosTurma?.length ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/40 p-3">
              <ProgressoChamada marcados={chamada.marcados} total={chamada.total} />
              <MarcarTodosPresentes
                pendentes={chamada.pendentes.length}
                emLicenca={chamada.emLicenca}
                onConfirmar={() => marcarTodosPresentes(chamada.pendentes)}
              />
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou matrícula" value={buscaAluno} onChange={(e) => setBuscaAluno(e.target.value)} />
          </div>
          <div className="space-y-2">
            {alunosTurma === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando alunos...</p>
            ) : alunosTurma.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno matriculado nesta turma.</p>
            ) : (
              alunosVisiveis.map((a) => {
                const lic = licencaDoAluno(a.id);
                return (
                <div key={a.id} className="space-y-3 rounded-xl border border-border/70 bg-card px-3 py-3">
                  <div className="flex items-center gap-3">
                    {fotos[a.id] ? (
                      <button type="button" title="Ampliar foto" className="shrink-0" onClick={() => setFotoAmpliada({ url: fotos[a.id]!, nome: a.nome })}>
                        <img src={fotos[a.id]} alt={`Foto de ${a.nome}`} className="size-14 rounded-full border border-border object-cover" />
                      </button>
                    ) : (
                      <div className="grid size-14 shrink-0 place-items-center rounded-full border border-border bg-secondary text-sm font-semibold text-muted-foreground">
                        {a.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => setPerfilAlunoId(a.id)}
                        className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                        title={`Ver perfil de ${a.nome}`}
                      >
                        {a.nome}
                      </button>
                      <p className="font-mono text-xs text-muted-foreground">Matrícula {a.codigo}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EtiquetaSituacao
                          situacao={situacaoDoAluno(a, Boolean(lic))}
                          texto={lic ? `Licença até ${formatarDataCurta(lic.data_retorno)}` : undefined}
                        />
                        {a.pcd ? <Badge variant="outline">PCD</Badge> : null}
                        {a.status !== "ativa" ? <Badge variant="secondary">Matrícula {a.status}</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{a.modalidade}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="shrink-0 self-start"
                      title="Editar observação"
                      aria-label="Editar observação"
                      onClick={() => setEditandoObservacao({ alunoId: a.id, nome: a.nome, texto: observacoesPresenca[a.id] ?? "" })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                  <BotoesChamada
                    className="sm:w-full"
                    atual={statusPresenca[a.id]}
                    onEscolher={(status) => void registrarPresenca(a.id, status)}
                  />
                </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!fotoAmpliada} onOpenChange={(o) => !o && setFotoAmpliada(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">{fotoAmpliada?.nome}</DialogTitle></DialogHeader>
          {fotoAmpliada ? <img src={fotoAmpliada.url} alt={`Foto de ${fotoAmpliada.nome}`} className="w-full rounded-lg object-contain" /> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editandoObservacao} onOpenChange={(o) => !o && setEditandoObservacao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Observação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{editandoObservacao?.nome}</p>
            <Textarea
              value={editandoObservacao?.texto ?? ""}
              onChange={(e) => setEditandoObservacao((prev) => (prev ? { ...prev, texto: e.target.value } : null))}
              placeholder="Motivo da falta justificada..."
              rows={4}
            />
            <Button onClick={() => void salvarObservacao()} className="w-full">Salvar observação</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={gerenciarDias} onOpenChange={setGerenciarDias}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Dias disponíveis</DialogTitle></DialogHeader>
          <form onSubmit={adicionarGrupo} className="flex gap-2">
            <Input
              value={novoGrupo}
              onChange={(e) => setNovoGrupo(e.target.value)}
              placeholder="Segunda e Quarta"
            />
            <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
          </form>
          <div className="space-y-2">
            {grupos.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <span className="text-sm">{g.label} <span className="text-muted-foreground">({g.dias.join(", ")})</span></span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  title="Remover dias"
                  onClick={() => void removerGrupo(g.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!grupos.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum grupo de dias cadastrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gerenciarHorarios} onOpenChange={setGerenciarHorarios}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Horários disponíveis</DialogTitle></DialogHeader>
          <form onSubmit={adicionarHorario} className="flex gap-2">
            <Input
              value={novoHorario}
              onChange={(e) => setNovoHorario(e.target.value)}
              placeholder="06:00 às 06:50"
            />
            <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
          </form>
          <div className="space-y-2">
            {horarios.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <span className="text-sm">{h.horario}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  title="Remover horário"
                  onClick={() => void removerHorario(h.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!horarios.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum horário cadastrado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => !o && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarExclusao?.nome} e as matrículas vinculadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmarExclusao && void excluirTurma(confirmarExclusao)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
