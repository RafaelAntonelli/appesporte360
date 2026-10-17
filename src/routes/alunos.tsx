import { createFileRoute } from "@tanstack/react-router";

import { useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, Image as ImageIcon, AlertTriangle, Bell, Trash2, UserX, UserCheck, Download, Camera, Upload, IdCard, FileDown, FileSpreadsheet, ChevronDown, ChevronUp, FileWarning, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CONDICOES_PCD } from "@/lib/pcd";
import { useHorarios } from "@/lib/horarios";
import { useGruposDias } from "@/lib/dias";
import { capitalizarNome, formatarCelular, formatarCPF, cpfValido, correspondeBusca, relevanciaBusca } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { encontrarAlunoDuplicado } from "@/lib/duplicidade";
import { TURNOS, turnoDoHorario, idadePorNascimento, faixaEtariaECA } from "@/lib/turnos";
import { MODALIDADES, MODALIDADE_PADRAO } from "@/lib/modalidades";
import { gerarCrachaPreviewImagem, gerarCrachasPdfFielAoPreview, type DadosCracha } from "@/lib/cracha";
import { atestadoVencido, notificarAtestadoVencido, notificarAtestadoVencendo, diasParaVencer } from "@/lib/atestado";
import { usePrazoAvisoAtestado } from "@/lib/configuracoes";
import { useAuth } from "@/lib/auth";
import { montarPlanilhaAlunos, ExportacaoCancelada, DOCUMENTOS_PLANILHA, type AlunoPlanilha } from "@/lib/planilha-alunos";
import { linksArquivosFn } from "@/lib/links-arquivos.functions";


import { AppShell } from "@/components/AppShell";
import { LerFicha } from "@/components/AiRevisao";
import { ImportarAlunos } from "@/components/ImportarAlunos";
import { ConversarWhatsApp } from "@/components/ConversarWhatsApp";
import { SelecionarEscola } from "@/components/SelecionarEscola";
import { LicencaMedicaSecao } from "@/components/LicencaMedica";
import { dataISO, formatarDataCurta, ignorarNoAlertaFaltas, licencaTerminada, type LicencaMedica } from "@/lib/licenca";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { enfileirar, estaOnline, lerCache, salvarCache } from "@/lib/offline";
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

export const Route = createFileRoute("/alunos")({
  validateSearch: (s: Record<string, unknown>): { novo?: boolean } => (s['novo'] ? { novo: true } : {}),
  component: AlunosPage,
  head: () => ({
    meta: [
      { title: "Alunos e matrículas | Arena Aquática" },
      { name: "description", content: "Cadastre alunos, faça matrículas em turmas e gere o QR Code de presença." },
      { property: "og:title", content: "Alunos e matrículas | Arena Aquática" },
      { property: "og:description", content: "Cadastro de alunos e matrículas da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Aluno = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  responsavel: string | null;
  email: string | null;
  observacoes: string | null;
  codigo: string;
  ativo: boolean;
  pcd: boolean;
  pcd_descricao: string | null;
  pcd_condicoes: string[] | null;
  rg: string | null;
  cpf: string | null;
  foto_path: string | null;
  atestado_entregue: boolean;
  atestado_data: string | null;
  telefone2: string | null;
  rede_ensino: string | null;
  escola: string | null;
  idade: number | null;
  sexo: string | null;
  doc_atestado_path: string | null;
  doc_residencia_path: string | null;
  doc_matricula_path: string | null;
  doc_identidade_path: string | null;
  doc_ficha_path: string | null;
  motivo_inativacao: string | null;
  inativado_em: string | null;
  inativado_por: string | null;
  inativado_por_nome?: string | null;
};

const DOCUMENTOS = DOCUMENTOS_PLANILHA;

type CampoDoc = (typeof DOCUMENTOS)[number]["campo"];

const CAPACIDADE_TURMA = 40;

const ROTULO_STATUS = {
  presente: "Presenças",
  falta: "Faltas",
  falta_justificada: "Faltas justificadas",
} as const;

type Turma = { id: string; nome: string; horario: string | null; dias_semana: string[] | null; modalidade: string | null; capacidade: number | null };
type Matricula = { id: string; aluno_id: string; turma_id: string; status: string; modalidade: string; data_inicio: string | null; created_at: string | null; registrado_por: string | null; registrado_por_nome?: string | null };
type Presenca = { id: string; data: string; status: string; turma_id: string | null; observacoes: string | null };
type EscolhaMatricula = { modalidade: string; turmaId: string; turno: string };


type FormAluno = {
  nome: string;
  data_nascimento: string;
  telefone: string;
  responsavel: string;
  email: string;
  observacoes: string;
  modalidade: string;
  pcd: boolean;
  pcd_descricao: string;
  pcd_condicoes: string[];
  rg: string;
  cpf: string;
  atestado_entregue: boolean;
  atestado_data: string;
  telefone2: string;
  rede_ensino: string;
  escola: string;
  idade: string;
  sexo: string;
};

const vazio: FormAluno = {
  nome: "",
  data_nascimento: "",
  telefone: "",
  responsavel: "",
  email: "",
  observacoes: "",
  modalidade: MODALIDADE_PADRAO,
  pcd: false,
  pcd_descricao: "",
  pcd_condicoes: [] as string[],
  rg: "",
  cpf: "",
  atestado_entregue: false,
  atestado_data: "",
  telefone2: "",
  rede_ensino: "",
  escola: "",
  idade: "",
  sexo: "",
};


function AlunosPage() {
  const { lista: listaHorarios } = useHorarios();
  const { lista: listaGrupos } = useGruposDias();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroPcd, setFiltroPcd] = useState("todos");
  const [filtroSexo, setFiltroSexo] = useState("todos");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [filtroHorario, setFiltroHorario] = useState("todos");
  const [filtroDias, setFiltroDias] = useState("todos");
  const [filtroTurno, setFiltroTurno] = useState("todos");
  const [filtroNotificacao, setFiltroNotificacao] = useState<
    "todos" | "ativos" | "inativos" | "sem_atestado" | "atestado_vencido" | "atestado_vencer" | "excesso_faltas"
  >("todos");
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState<Record<string, boolean>>({
    inativos: true,
    sem_atestado: true,
    atestado_vencido: true,
    atestado_vencer: true,
    excesso_faltas: true,
  });
  const { valor: prazoAviso } = usePrazoAvisoAtestado();
  const [gerandoCrachas, setGerandoCrachas] = useState(false);
  const [mostrarGuias, setMostrarGuias] = useState(false);
  const { user } = useAuth();
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});

  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [docs, setDocs] = useState<Record<CampoDoc, File | null>>({
    doc_atestado_path: null,
    doc_residencia_path: null,
    doc_matricula_path: null,
    doc_identidade_path: null,
    doc_ficha_path: null,
  });
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Aluno | null>(null);
  const [form, setForm] = useState(vazio);
  const [escolhasMatricula, setEscolhasMatricula] = useState<EscolhaMatricula[]>([
    { modalidade: MODALIDADE_PADRAO, turmaId: "", turno: "todos" },
  ]);
  const [qrAluno, setQrAluno] = useState<Aluno | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<Aluno | null>(null);
  const [docsUrls, setDocsUrls] = useState<Record<string, string>>({});
  const atestadoAnexadoSemConfirmacao = !!docs.doc_atestado_path && !form.atestado_entregue;
  const atestadoAnexadoSemData = !!docs.doc_atestado_path && !form.atestado_data;

  const [historico, setHistorico] = useState<Presenca[] | null>(null);
  const [faltasPorAluno, setFaltasPorAluno] = useState<Record<string, number>>({});
  const [licencas, setLicencas] = useState<LicencaMedica[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Aluno[] | null>(null);
  const [inativando, setInativando] = useState<Aluno[] | null>(null);
  const [motivoInativacao, setMotivoInativacao] = useState("");
  const [exportandoPlanilha, setExportandoPlanilha] = useState(false);
  const [progressoPlanilha, setProgressoPlanilha] = useState<{ etapa: string; feitos: number; total: number } | null>(null);
  const cancelarPlanilhaRef = useRef<AbortController | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    if (!estaOnline()) {
      const c = await lerCache<{ alunos: Aluno[]; turmas: Turma[]; matriculas: Matricula[] }>("alunos");
      if (c) {
        setAlunos(c.alunos ?? []);
        setTurmas(c.turmas ?? []);
        setMatriculas(c.matriculas ?? []);
      } else {
        setErro("Sem conexão e sem dados salvos neste aparelho.");
      }
      setCarregando(false);
      return;
    }
    try {
      const [a, t, m] = await Promise.all([
        supabase.from("alunos").select("*").order("nome"),
        supabase.from("turmas").select("id,nome,horario,dias_semana,modalidade,capacidade").order("nome"),
        supabase.from("matriculas").select("*"),
      ]);
      if (a.error) throw a.error;
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      setAlunos(a.data as Aluno[]);
      setTurmas(t.data as Turma[]);
      setMatriculas(m.data as Matricula[]);
      void salvarCache("alunos", { alunos: a.data, turmas: t.data, matriculas: m.data });
      const perfis = await supabase.from("profiles").select("id,nome,email");
      if (perfis.data) {
        const mapa: Record<string, string> = {};
        for (const p of perfis.data as { id: string; nome: string | null; email: string | null }[]) {
          mapa[p.id] = p.nome || p.email || "Usuário";
        }
        setNomesUsuarios(mapa);
      }
      const f = await supabase.from("presencas").select("aluno_id").eq("status", "falta");
      if (f.data) {
        const contagem: Record<string, number> = {};
        for (const row of f.data as { aluno_id: string }[]) {
          contagem[row.aluno_id] = (contagem[row.aluno_id] ?? 0) + 1;
        }
        setFaltasPorAluno(contagem);
      }
      const lic = await supabase.from("licencas_medicas").select("*").eq("status", "ativa");
      if (lic.data) setLicencas(lic.data as LicencaMedica[]);
      const comFoto = (a.data as Aluno[]).filter((x) => x.foto_path);
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
    } catch (err: any) {
      setErro(err?.message ?? "Erro ao carregar dados");
      toast.error(err?.message ?? "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const { novo: abrirNovaMatricula } = Route.useSearch();
  useEffect(() => {
    if (abrirNovaMatricula) abrirNovo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirNovaMatricula]);


  function limparDocs() {
    setDocs({ doc_atestado_path: null, doc_residencia_path: null, doc_matricula_path: null, doc_identidade_path: null, doc_ficha_path: null });
  }

  async function excluirDocumento(campo: CampoDoc, rotulo: string) {
    const enviado = editando?.[campo] ?? null;
    if (!confirm(`Excluir ${rotulo.toLowerCase()}?`)) return;
    setDocs((s) => ({ ...s, [campo]: null }));
    const input = document.getElementById(`doc-${campo}`) as HTMLInputElement | null;
    if (input) input.value = "";
    if (!enviado || !editando) return toast.success("Arquivo selecionado removido");
    const patch = { [campo]: null } as Partial<Record<CampoDoc, string | null>>;
    const { error } = await supabase.from("alunos").update(patch).eq("id", editando.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("fotos-alunos").remove([enviado]);
    setEditando({ ...editando, [campo]: null });
    toast.success("Documento excluído");
    void carregar();
    return;
  }

  async function excluirFoto() {
    const enviada = editando?.foto_path ?? null;
    if (!foto && !enviada) return;
    if (!confirm("Excluir a foto do aluno?")) return;
    setFoto(null);
    setFotoPreview(null);
    (document.getElementById("foto-aluno-arquivo") as HTMLInputElement | null) && ((document.getElementById("foto-aluno-arquivo") as HTMLInputElement).value = "");
    (document.getElementById("foto-aluno-camera") as HTMLInputElement | null) && ((document.getElementById("foto-aluno-camera") as HTMLInputElement).value = "");
    if (!enviada || !editando) return toast.success("Foto removida");
    const { error } = await supabase.from("alunos").update({ foto_path: null }).eq("id", editando.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("fotos-alunos").remove([enviada]);
    setEditando({ ...editando, foto_path: null });
    setFotos((m) => { const novo = { ...m }; delete novo[editando.id]; return novo; });
    toast.success("Foto excluída");
    void carregar();
    return;
  }

  function abrirNovo() {
    setEditando(null);
    setForm(vazio);
    setEscolhasMatricula([{ modalidade: MODALIDADE_PADRAO, turmaId: "", turno: "todos" }]);

    setFoto(null);
    setFotoPreview(null);
    limparDocs();
    setAberto(true);
  }

  function abrirEdicao(aluno: Aluno) {
    setEditando(aluno);
    setForm({
      nome: aluno.nome,
      data_nascimento: aluno.data_nascimento ?? "",
      telefone: aluno.telefone ?? "",
      responsavel: aluno.responsavel ?? "",
      email: aluno.email ?? "",
      observacoes: aluno.observacoes ?? "",
      modalidade: MODALIDADE_PADRAO,
      pcd: aluno.pcd ?? false,
      pcd_descricao: aluno.pcd_descricao ?? "",
      pcd_condicoes: aluno.pcd_condicoes ?? [],
      rg: aluno.rg ?? "",
      cpf: aluno.cpf ?? "",
      atestado_entregue: aluno.atestado_entregue ?? false,
      atestado_data: aluno.atestado_data ?? "",
      telefone2: aluno.telefone2 ?? "",
      rede_ensino: aluno.rede_ensino ?? "",
      escola: aluno.escola ?? "",
      idade: aluno.idade != null ? String(aluno.idade) : "",
      sexo: aluno.sexo ?? "",
    });
    setFoto(null);
    limparDocs();
    setFotoPreview(fotos[aluno.id] ?? null);
    const ativas = matriculas.filter((x) => x.aluno_id === aluno.id && x.status === "ativa").slice(0, 3);
    setEscolhasMatricula(
      ativas.length
        ? ativas.map((m) => {
            const turma = turmas.find((t) => t.id === m.turma_id);
            return {
              modalidade: turma?.modalidade ?? m.modalidade ?? MODALIDADE_PADRAO,
              turmaId: m.turma_id,
              turno: turnoDoHorario(turma?.horario) || "todos",
            };
          })
        : [{ modalidade: MODALIDADE_PADRAO, turmaId: "", turno: "todos" }],
    );


    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (atestadoAnexadoSemConfirmacao || atestadoAnexadoSemData) {
      if (atestadoAnexadoSemConfirmacao && atestadoAnexadoSemData) {
        toast.error("Marque que o atestado foi entregue e preencha a data do atestado.");
      } else if (atestadoAnexadoSemConfirmacao) {
        toast.error("Marque que o atestado foi entregue antes de salvar.");
      } else {
        toast.error("Preencha a data do atestado antes de salvar.");
      }
      return;
    }
    if (form.cpf && !cpfValido(form.cpf)) {
      toast.error("CPF inválido. Verifique os números digitados.");
      return;
    }
    // Critério único (mesmo aplicado no banco de dados): CPF ou nome + data de nascimento.
    const duplicado = encontrarAlunoDuplicado(
      { nome: capitalizarNome(form.nome), cpf: form.cpf, data_nascimento: form.data_nascimento },
      alunos,
      editando?.id ?? null,
    );
    if (duplicado) {
      toast.error(`Aluno já cadastrado: ${duplicado.nome}.`);
      return;
    }


    const payload = {
      nome: capitalizarNome(form.nome),
      data_nascimento: form.data_nascimento || null,
      telefone: form.telefone || null,
      responsavel: form.responsavel || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
      pcd: form.pcd,
      pcd_descricao: form.pcd ? form.pcd_descricao || null : null,
      pcd_condicoes: form.pcd ? form.pcd_condicoes : [],
      rg: form.rg || null,
      cpf: form.cpf || null,
      atestado_entregue: form.atestado_entregue,
      atestado_data: form.atestado_entregue ? form.atestado_data || null : null,
      telefone2: form.telefone2 || null,
      rede_ensino: form.rede_ensino || null,
      escola: form.escola || null,
      idade: form.idade ? Number(form.idade) : null,
      sexo: form.sexo || null,
    };

    const escolhasValidas = escolhasMatricula.filter((escolha) => escolha.turmaId);
    if (!escolhasValidas.length) {
      toast.error("Selecione pelo menos uma modalidade e turma.");
      return;
    }
    if (escolhasValidas.length > 3 || new Set(escolhasValidas.map((e) => e.modalidade)).size !== escolhasValidas.length) {
      toast.error("Escolha até 3 modalidades diferentes.");
      return;
    }
    for (const escolha of escolhasValidas) {
      const turma = turmas.find((t) => t.id === escolha.turmaId);
      if (!turma || (turma.modalidade ?? MODALIDADE_PADRAO) !== escolha.modalidade) {
        toast.error("Selecione uma turma válida para cada modalidade.");
        return;
      }
      const jaMatriculado = matriculas.some((m) => m.aluno_id === editando?.id && m.turma_id === escolha.turmaId && m.status === "ativa");
      const ocupadas = matriculas.filter((m) => m.turma_id === escolha.turmaId && m.status === "ativa").length;
      const capacidade = turma.capacidade ?? CAPACIDADE_TURMA;
      if (!jaMatriculado && ocupadas >= capacidade) {
        toast.error(`Turma lotada: ${turma.nome} (${capacidade} vagas).`);
        return;
      }
    }
    setSalvando(true);

    if (!estaOnline()) {
      const idLocal = editando?.id ?? crypto.randomUUID();
      if (editando) {
        await enfileirar({ tipo: "aluno_update", aluno_id: idLocal, dados: payload, foto: foto ?? null, fotoNome: foto?.name ?? null });
        setAlunos((lista) => lista.map((a) => (a.id === idLocal ? ({ ...a, ...payload } as Aluno) : a)));
      } else {
        await enfileirar({ tipo: "aluno_novo", aluno: { id: idLocal, ...payload }, foto: foto ?? null, fotoNome: foto?.name ?? null });
        setAlunos((lista) => [...lista, { id: idLocal, ativo: true, ...payload } as unknown as Aluno]);
      }
      await enfileirar({
        tipo: "matriculas_sync",
        aluno_id: idLocal,
        escolhas: escolhasValidas.map((e) => ({ turma_id: e.turmaId, modalidade: e.modalidade })),
        registrado_por: user?.id ?? null,
      });
      setMatriculas((lista) => [
        ...lista.filter((m) => m.aluno_id !== idLocal || m.status !== "ativa"),
        ...escolhasValidas.map((e) => ({
          id: crypto.randomUUID(), aluno_id: idLocal, turma_id: e.turmaId, status: "ativa", modalidade: e.modalidade,
          data_inicio: new Date().toISOString().slice(0, 10), created_at: new Date().toISOString(), registrado_por: user?.id ?? null,
        })),
      ]);
      setSalvando(false);
      setAberto(false);
      toast.success("Salvo offline. Será enviado quando a internet voltar.");
      return;
    }

    let alunoId = editando?.id;
    try {
      if (editando) {
        const { error } = await supabase.from("alunos").update(payload).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("alunos").insert(payload).select("id").single();
        if (error) throw error;
        alunoId = data.id;
      }

      if (foto && alunoId) {
        const ext = foto.name.split(".").pop() ?? "jpg";
        const caminho = `${alunoId}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("fotos-alunos").upload(caminho, foto, { upsert: true });
        if (up.error) throw up.error;
        const { error } = await supabase.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
        if (error) throw error;
      }

      const atualizacaoDocs: Partial<Record<CampoDoc, string>> = {};
      for (const d of DOCUMENTOS) {
        const arquivo = docs[d.campo];
        if (!arquivo || !alunoId) continue;
        const ext = arquivo.name.split(".").pop() ?? "jpg";
        const caminho = `${alunoId}/${d.campo}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("fotos-alunos").upload(caminho, arquivo, { upsert: true });
        if (up.error) throw up.error;
        atualizacaoDocs[d.campo] = caminho;
      }
      if (Object.keys(atualizacaoDocs).length && alunoId) {
        const { error } = await supabase.from("alunos").update(atualizacaoDocs).eq("id", alunoId);
        if (error) throw error;
      }

    } catch (err: any) {
      setSalvando(false);
      toast.error(err?.message ?? "Erro ao salvar");
      return;
    }

    if (alunoId) {
      const turmasSelecionadas = escolhasValidas.map((e) => e.turmaId);
      let exclusao = supabase.from("matriculas").delete().eq("aluno_id", alunoId).eq("status", "ativa");
      if (turmasSelecionadas.length) exclusao = exclusao.not("turma_id", "in", `(${turmasSelecionadas.join(",")})`);
      const { error: eDel } = await exclusao;
      if (eDel) {
        setSalvando(false);
        return toast.error(eDel.message);
      }
      for (const escolha of escolhasValidas) {
        const { error } = await supabase.from("matriculas").upsert(
          { aluno_id: alunoId, turma_id: escolha.turmaId, status: "ativa", modalidade: escolha.modalidade, registrado_por: user?.id ?? null },
          { onConflict: "aluno_id,turma_id" },
        );
        if (error) {
          setSalvando(false);
          return toast.error(error.message);
        }
      }
    }


    setSalvando(false);
    toast.success(editando ? "Aluno atualizado" : "Aluno matriculado com sucesso");
    setAberto(false);
    void carregar();
    return;
  }

  async function abrirDetalhe(aluno: Aluno) {
    setDetalhe(aluno);
    setHistorico(null);
    setDocsUrls({});
    const caminhos = DOCUMENTOS
      .map((d) => ({ campo: d.campo as string, path: aluno[d.campo] }))
      .filter((d) => d.path) as { campo: string; path: string }[];

    if (caminhos.length) {
      const { data: signed } = await supabase.storage
        .from("fotos-alunos")
        .createSignedUrls(caminhos.map((c) => c.path), 3600);
      const mapa: Record<string, string> = {};
      signed?.forEach((s, i) => {
        const c = caminhos[i];
        if (s.signedUrl && c) mapa[c.campo] = s.signedUrl;
      });
      setDocsUrls(mapa);
    }
    const { data, error } = await supabase
      .from("presencas")
      .select("id,data,status,turma_id,observacoes")
      .eq("aluno_id", aluno.id)
      .order("data", { ascending: false });
    if (error) {
      toast.error(error.message);
      setHistorico([]);
      return;
    }
    setHistorico((data ?? []) as Presenca[]);
  }

  async function baixarDoc(campo: string, rotulo: string, path: string, nomeAluno: string) {
    const { data, error } = await supabase.storage.from("fotos-alunos").download(path);
    if (error || !data) return toast.error(error?.message ?? "Falha ao baixar documento");
    const ext = path.split(".").pop() ?? "jpg";
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nomeAluno} - ${rotulo}.${ext}`.replace(/\//g, "-");
    link.click();
    URL.revokeObjectURL(url);
    return;
  }


  function vagasUsadas(id: string) {
    return matriculas.filter((m) => m.turma_id === id && m.status === "ativa").length;
  }

  function capacidadeTurma(id: string) {
    return turmas.find((t) => t.id === id)?.capacidade ?? CAPACIDADE_TURMA;
  }

  function gruposDeTurmas(escolha: EscolhaMatricula) {
    const porModalidade = turmas.filter(
      (t) =>
        (t.modalidade ?? MODALIDADE_PADRAO) === escolha.modalidade &&
        (escolha.turno === "todos" || turnoDoHorario(t.horario) === escolha.turno),
    );
    const usadas = new Set<string>();
    const grupos = listaGrupos.map((g) => {
      const doGrupo = porModalidade.filter((t) => {
        const dias = t.dias_semana ?? [];
        const casa = g.dias.length
          ? g.dias.every((d) => dias.includes(d))
          : t.nome.toLowerCase().startsWith(g.label.toLowerCase());
        if (casa) usadas.add(t.id);
        return casa;
      });
      return { label: g.label, turmas: doGrupo };
    });
    const restantes = porModalidade.filter((t) => !usadas.has(t.id));
    if (restantes.length) grupos.push({ label: "Outros dias", turmas: restantes });
    return grupos.filter((g) => g.turmas.length);
  }


  async function excluirAlunos(lista: Aluno[]) {
    const ids = lista.map((a) => a.id);
    if (!ids.length) return;
    const caminhos = lista.map((a) => a.foto_path).filter(Boolean) as string[];
    // Lotes pequenos evitam o erro 400 (URL longa demais) ao excluir muitos alunos
    try {
      for (let i = 0; i < ids.length; i += 40) {
        const lote = ids.slice(i, i + 40);
        const p = await supabase.from("presencas").delete().in("aluno_id", lote);
        if (p.error) throw p.error;
        const m = await supabase.from("matriculas").delete().in("aluno_id", lote);
        if (m.error) throw m.error;
        const a = await supabase.from("alunos").delete().in("id", lote);
        if (a.error) throw a.error;
      }
      for (let i = 0; i < caminhos.length; i += 40) {
        await supabase.storage.from("fotos-alunos").remove(caminhos.slice(i, i + 40));
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir alunos");
      return;
    }
    toast.success(ids.length > 1 ? `${ids.length} alunos excluídos` : "Aluno excluído");
    setSelecionados([]);
    setConfirmarExclusao(null);
    void carregar();
    return;
  }



  async function alternarAtivo(lista: Aluno[], ativo: boolean) {
    if (!ativo) {
      setMotivoInativacao("");
      setInativando(lista);
      return;
    }
    const ids = lista.map((a) => a.id);
    const { error } = await supabase
      .from("alunos")
      .update({ ativo: true, motivo_inativacao: null, inativado_em: null, inativado_por: null })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Aluno(s) reativado(s)");
    setSelecionados([]);
    void carregar();
    return;
  }

  async function confirmarInativacao() {
    if (!inativando?.length) return;
    if (!motivoInativacao.trim()) return toast.error("Informe o motivo da inativação.");
    const ids = inativando.map((a) => a.id);
    const { error } = await supabase
      .from("alunos")
      .update({
        ativo: false,
        motivo_inativacao: motivoInativacao.trim(),
        inativado_em: new Date().toISOString(),
        inativado_por: user?.id ?? null,
      })
      .in("id", ids);
    if (error) return toast.error(error.message);
    const { error: erroMatricula } = await supabase.from("matriculas").delete().in("aluno_id", ids);
    if (erroMatricula) return toast.error(erroMatricula.message);
    toast.success(ids.length > 1 ? "Alunos inativados e removidos das turmas" : "Aluno inativado e removido da turma");
    setInativando(null);
    setMotivoInativacao("");
    setSelecionados([]);
    void carregar();
    return;
  }


  function matriculaDoAluno(id: string) {
    return matriculas.find((m) => m.aluno_id === id);
  }

  function turmaDoAluno(id: string) {
    const m = matriculaDoAluno(id);
    return m ? turmas.find((t) => t.id === m.turma_id) : undefined;
  }

  function dadosCracha(a: Aluno): DadosCracha {
    const t = turmaDoAluno(a.id);
    return {
      nome: a.nome,
      rg: a.rg,
      cpf: a.cpf,
      responsavel: a.responsavel,
      telefone: a.telefone,
      pcd: a.pcd,
      modalidade: matriculaDoAluno(a.id)?.modalidade ?? t?.modalidade ?? "",
      horario: t?.horario ?? "",
      dias: t?.dias_semana ?? [],
      fotoUrl: fotos[a.id] ?? null,
      codigo: a.codigo,
    };
  }

  async function abrirPreviewCracha(a: Aluno, guias = mostrarGuias) {
    setQrAluno(a);
    setPreviewUrl(null);
    try {
      const url = await gerarCrachaPreviewImagem(dadosCracha(a), { guias });
      setPreviewUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o crachá");
      setQrAluno(null);
    }
  }

  async function alternarGuias(valor: boolean) {
    setMostrarGuias(valor);
    if (qrAluno) await abrirPreviewCracha(qrAluno, valor);
  }

  async function exportarCrachas(lista: Aluno[], formato: "cartao" | "folha") {
    if (!lista.length) {
      toast.error("Nenhum aluno para gerar crachá");
      return;
    }
    setGerandoCrachas(true);
    const idToast = toast.loading(`Gerando crachás… 0/${lista.length}`);
    try {
      const dados = lista.map(dadosCracha);
      const nome = lista.length === 1 ? `cracha-${lista[0]!.nome.replace(/\s+/g, "-").toLowerCase()}` : "crachas-arena-aquatica";
      // Exportação fiel: mesma renderização (margens e escala) da pré-visualização
      await gerarCrachasPdfFielAoPreview(dados, formato === "folha" ? `${nome}-a4` : nome, {
        formato,
        aoProgredir: (feitos, total) =>
          toast.loading(`Gerando crachás… ${feitos}/${total}`, { id: idToast }),
      });
      toast.success(`${lista.length} crachá(s) gerado(s)`, { id: idToast });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar crachás", { id: idToast });
    } finally {
      setGerandoCrachas(false);
    }

  }

  const CABECALHO_LISTA = ["Matrícula", "Nome", "Idade", "Sexo", "Telefone", "Responsável", "CPF", "RG", "Modalidade", "Turma", "Horário", "PCD", "Situação", "Faltas", "Atestado"];

  function linhasLista(lista: Aluno[]) {
    return lista.map((a) => {
      const turma = turmaDoAluno(a.id);
      const modalidade = matriculaDoAluno(a.id)?.modalidade ?? turma?.modalidade ?? "";
      const atestado = !a.atestado_entregue ? "Não entregue" : atestadoVencido(a.atestado_data) ? "Vencido" : "Em dia";
      return [
        a.codigo,
        a.nome,
        a.idade != null ? String(a.idade) : "",
        a.sexo ?? "",
        a.telefone ?? "",
        a.responsavel ?? "",
        a.cpf ?? "",
        a.rg ?? "",
        modalidade,
        turma?.nome ?? "",
        turma?.horario ?? "",
        a.pcd ? "Sim" : "Não",
        a.ativo ? "Ativo" : "Inativo",
        String(faltasPorAluno[a.id] ?? 0),
        atestado,
      ];
    });
  }

  function exportarListaCsv() {
    if (!filtrados.length) return toast.error("Nenhum aluno na lista filtrada");
    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [CABECALHO_LISTA, ...linhasLista(filtrados)].map((l) => l.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `alunos-filtrados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Lista exportada em CSV (${filtrados.length} aluno${filtrados.length > 1 ? "s" : ""})`);
    return;
  }

  async function exportarListaPdf() {
    if (!filtrados.length) return toast.error("Nenhum aluno na lista filtrada");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const larguras = [18, 38, 10, 16, 24, 30, 22, 18, 22, 28, 16, 10, 14, 10, 18];
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Lista de alunos — Arena Aquática", 12, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${filtrados.length} aluno(s) · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 12, 16.5);

    const escreverLinha = (celulas: string[], negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(7);
      let x = 12;
      celulas.forEach((c, i) => {
        const largura = larguras[i] ?? 20;
        doc.text(doc.splitTextToSize(c, largura - 2)[0] ?? "", x, y);
        x += largura;
      });
      y += 5;
    };

    y += 6;
    escreverLinha(CABECALHO_LISTA, true);
    doc.setDrawColor(200);
    doc.line(12, y - 3.5, 285, y - 3.5);

    for (const linha of linhasLista(filtrados)) {
      if (y > 198) {
        doc.addPage();
        y = 18;
        escreverLinha(CABECALHO_LISTA, true);
      }
      escreverLinha(linha);
    }

    doc.save(`alunos-filtrados-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`Lista exportada em PDF (${filtrados.length} aluno${filtrados.length > 1 ? "s" : ""})`);
    return;
  }

  function turmaDoAlunoPlanilha(id: string): { id: string; nome: string; modalidade: string | null; horario: string | null } | undefined {
    const m = matriculas.find((x) => x.aluno_id === id);
    const t = turmas.find((t) => t.id === (m?.turma_id ?? ""));
    return t ? { id: t.id, nome: t.nome, modalidade: t.modalidade, horario: t.horario } : undefined;
  }

  function modalidadeDoAlunoPlanilha(id: string): string {
    const m = matriculas.find((x) => x.aluno_id === id);
    return m?.modalidade ?? turmaDoAlunoPlanilha(id)?.modalidade ?? "";
  }

  async function exportarPlanilha(): Promise<void> {
    if (!alunos.length) {
      toast.error("Nenhum aluno para exportar");
      return;
    }
    const controle = new AbortController();
    cancelarPlanilhaRef.current = controle;
    setExportandoPlanilha(true);
    setProgressoPlanilha({ etapa: "Preparando planilha...", feitos: 0, total: alunos.length });
    const idToast = toast.loading("Preparando planilha...");
    try {
      const buffer = await montarPlanilhaAlunos({
        alunos: alunos as AlunoPlanilha[],
        turmaDoAluno: turmaDoAlunoPlanilha,
        modalidadeDoAluno: modalidadeDoAlunoPlanilha,
        sinal: controle.signal,
        aoProgredir: (feitos, total) =>
          setProgressoPlanilha({ etapa: "Processando alunos e documentos...", feitos, total }),
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
      toast.success("Planilha exportada em ordem crescente de idade", { id: idToast });
    } catch (err) {
      if (err instanceof ExportacaoCancelada) toast.info("Exportação cancelada", { id: idToast });
      else toast.error(err instanceof Error ? err.message : "Erro ao exportar planilha", { id: idToast });
    } finally {
      cancelarPlanilhaRef.current = null;
      setExportandoPlanilha(false);
      setProgressoPlanilha(null);
    }
  }

  function cancelarExportacaoPlanilha() {
    cancelarPlanilhaRef.current?.abort();
    setProgressoPlanilha((p) => (p ? { ...p, etapa: "Cancelando..." } : p));
  }


  const filtrados = alunos
    .filter((a) => {
      if (!correspondeBusca(a, busca)) return false;
      if (filtroNotificacao === "ativos" && !a.ativo) return false;
      if (filtroNotificacao === "inativos" && a.ativo) return false;
      if (filtroNotificacao === "sem_atestado" && !(a.ativo && !a.atestado_entregue)) return false;
      if (filtroNotificacao === "atestado_vencido" && !notificarAtestadoVencido(a)) return false;
      if (filtroNotificacao === "atestado_vencer" && !notificarAtestadoVencendo(a, prazoAviso)) return false;
      if (filtroNotificacao === "excesso_faltas" && (faltasPorAluno[a.id] ?? 0) < 5) return false;
      if (filtroSexo !== "todos" && (a.sexo ?? "") !== filtroSexo) return false;
      if (idadeMin && (a.idade ?? -1) < Number(idadeMin)) return false;
      if (idadeMax && (a.idade ?? 999) > Number(idadeMax)) return false;
      const turma = turmaDoAluno(a.id);
      const modalidade = matriculaDoAluno(a.id)?.modalidade ?? turma?.modalidade ?? "";
      if (filtroModalidade !== "todas" && modalidade !== filtroModalidade) return false;
      if (filtroHorario !== "todos" && turma?.horario !== filtroHorario) return false;
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        const diasTurma = turma?.dias_semana ?? [];
        if (!diasEsperados.length || !diasEsperados.every((d) => diasTurma.includes(d))) return false;
      }
      if (filtroTurno !== "todos" && turnoDoHorario(turma?.horario) !== filtroTurno) return false;
      if (filtroPcd === "todos") return true;
      if (filtroPcd === "sem") return !a.pcd;
      if (filtroPcd === "com") return a.pcd;
      return (a.pcd_condicoes ?? []).includes(filtroPcd);
    })
    .sort((a, b) => {
      const selA = selecionados.includes(a.id) ? 1 : 0;
      const selB = selecionados.includes(b.id) ? 1 : 0;
      if (selA !== selB) return selB - selA;
      return relevanciaBusca(a.nome, busca) - relevanciaBusca(b.nome, busca) || a.nome.localeCompare(b.nome);
    });





  const vencidos = alunos.filter(notificarAtestadoVencido);
  const proximosVencimento = alunos.filter((a) => notificarAtestadoVencendo(a, prazoAviso));
  const hojeISO = dataISO();
  const excessoFaltas = alunos.filter((a) => (faltasPorAluno[a.id] ?? 0) >= 5 && !ignorarNoAlertaFaltas(licencas, a.id, hojeISO));
  const licencasTerminadas = licencas
    .filter((l) => l.status === "ativa")
    .sort((x, y) => Number(licencaTerminada(y, hojeISO)) - Number(licencaTerminada(x, hojeISO)) || x.data_retorno.localeCompare(y.data_retorno))
    .map((l) => ({ licenca: l, aluno: alunos.find((a) => a.id === l.aluno_id) }))
    .filter((x): x is { licenca: LicencaMedica; aluno: Aluno } => !!x.aluno && x.aluno.ativo);
  const inativos = alunos.filter((a) => !a.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  const semAtestado = alunos.filter((a) => a.ativo && !a.atestado_entregue).sort((a, b) => a.nome.localeCompare(b.nome));

  const totalNotificacoes = vencidos.length + proximosVencimento.length + semAtestado.length + excessoFaltas.length + licencasTerminadas.length;

  function alternarNotificacao(tipo: string) {
    setNotificacoesAbertas((atuais) => ({ ...atuais, [tipo]: !atuais[tipo] }));
  }

  const selecionadosAlunos = alunos.filter((a) => selecionados.includes(a.id));
  const todosSelecionados = filtrados.length > 0 && filtrados.every((a) => selecionados.includes(a.id));

  return (
    <AppShell title="Alunos" subtitle="Cadastro e matrículas da Arena Aquática">
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setMostrarNotificacoes((v) => !v)}>
          <Bell className="size-4" />
          {mostrarNotificacoes ? "Esconder notificações" : "Mostrar notificações"} ({totalNotificacoes})
        </Button>
      </div>
      {mostrarNotificacoes ? (
        <>
      {inativos.length ? (
        <Card
          className={cn(
            "mb-6 border-muted-foreground/30 bg-muted/40 transition-shadow hover:opacity-90",
          )}
        >
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-muted-foreground">
                <UserX className="size-4" /> Notificações · {inativos.length} aluno(s) inativo(s)
              </p>
              <Button variant="ghost" size="icon" aria-label={notificacoesAbertas["inativos"] ? "Esconder alunos inativos" : "Mostrar alunos inativos"} onClick={(e) => { e.stopPropagation(); alternarNotificacao("inativos"); }}>
                {notificacoesAbertas["inativos"] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {notificacoesAbertas["inativos"] ? <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {inativos.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void abrirDetalhe(a);
                  }}
                  className="h-auto min-w-0 flex-1 justify-between gap-2 whitespace-normal px-1 py-1.5 text-left text-sm"
                >
                  <span><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span> · {a.nome}</span>
                  <span className="text-right text-xs text-muted-foreground">
                    {a.motivo_inativacao ?? "Sem turma"}
                    {a.inativado_em ? ` · ${new Date(a.inativado_em).toLocaleDateString("pt-BR")}` : ""}
                  </span>
                </Button>
                <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
      {semAtestado.length ? (
        <Card
          className={cn(
            "mb-6 border-amber-500/40 bg-amber-500/5 transition-shadow hover:opacity-90",
          )}
        >
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-amber-600">
                <FileWarning className="size-4" /> Notificações · {semAtestado.length} aluno(s) sem atestado médico
              </p>
              <Button variant="ghost" size="icon" aria-label={notificacoesAbertas["sem_atestado"] ? "Esconder alunos sem atestado" : "Mostrar alunos sem atestado"} onClick={(e) => { e.stopPropagation(); alternarNotificacao("sem_atestado"); }}>
                {notificacoesAbertas["sem_atestado"] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {notificacoesAbertas["sem_atestado"] ? <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {semAtestado.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicao(a);
                  }}
                  className="h-auto min-w-0 flex-1 justify-between gap-2 whitespace-normal px-1 py-1.5 text-left text-sm"
                >
                  <span><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span> · {a.nome}</span>
                  <span className="text-xs text-muted-foreground">Não entregue</span>
                </Button>
                <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
      {vencidos.length ? (
        <Card
          className={cn(
            "mb-6 border-destructive/40 bg-destructive/5 transition-shadow hover:opacity-90",
          )}
        >
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <Bell className="size-4" /> Notificações · {vencidos.length} atestado(s) vencido(s)
              </p>
              <Button variant="ghost" size="icon" aria-label={notificacoesAbertas["atestado_vencido"] ? "Esconder atestados vencidos" : "Mostrar atestados vencidos"} onClick={(e) => { e.stopPropagation(); alternarNotificacao("atestado_vencido"); }}>
                {notificacoesAbertas["atestado_vencido"] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>

            {notificacoesAbertas["atestado_vencido"] ? <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {vencidos.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicao(a);
                  }}
                  className="h-auto min-w-0 flex-1 justify-between gap-2 whitespace-normal px-1 py-1.5 text-left text-sm"
                >
                  <span><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span> · {a.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    Atestado de {a.atestado_data ? new Date(`${a.atestado_data}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
                  </span>
                </Button>
                <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
      {proximosVencimento.length ? (
        <Card
          className={cn(
            "mb-6 border-orange-500/40 bg-orange-500/5 transition-shadow hover:opacity-90",
          )}
        >
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-orange-600">
                <Bell className="size-4" /> Notificações · {proximosVencimento.length} atestado(s) vencendo em até {prazoAviso} dias
              </p>
              <Button variant="ghost" size="icon" aria-label={notificacoesAbertas["atestado_vencer"] ? "Esconder atestados a vencer" : "Mostrar atestados a vencer"} onClick={(e) => { e.stopPropagation(); alternarNotificacao("atestado_vencer"); }}>
                {notificacoesAbertas["atestado_vencer"] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {notificacoesAbertas["atestado_vencer"] ? <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {proximosVencimento.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicao(a);
                  }}
                  className="h-auto min-w-0 flex-1 justify-between gap-2 whitespace-normal px-1 py-1.5 text-left text-sm"
                >
                  <span><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span> · {a.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    Vence em {diasParaVencer(a.atestado_data)} dia(s)
                  </span>
                </Button>
                <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
      {licencasTerminadas.length ? (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-amber-600">
                <Bell className="size-4" /> Notificações · {licencasTerminadas.length} licença(s) médica(s)
              </p>
              <Button variant="ghost" size="icon" aria-label={notificacoesAbertas["licencas"] ? "Esconder licenças médicas" : "Mostrar licenças médicas"} onClick={() => alternarNotificacao("licencas")}>
                {notificacoesAbertas["licencas"] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {notificacoesAbertas["licencas"] ? <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {licencasTerminadas.map(({ licenca, aluno: a }) => (
                <div key={licenca.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => void abrirDetalhe(a)}
                    className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-1 py-1.5 text-left text-sm"
                  >
                    {licencaTerminada(licenca, hojeISO)
                      ? `Licença de ${a.nome} terminou em ${formatarDataCurta(licenca.data_retorno)} — confirmar retorno ou renovar`
                      : `${a.nome} em licença até ${formatarDataCurta(licenca.data_retorno)}`}
                  </Button>
                  <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
      {excessoFaltas.length ? (
        <Card
          className={cn(
            "mb-6 border-amber-500/40 bg-amber-500/5 transition-shadow hover:opacity-90",
          )}
        >
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium text-amber-600">
                <AlertTriangle className="size-4" /> Notificações · {excessoFaltas.length} aluno(s) com 5 faltas ou mais
              </p>
              <Button variant="ghost" size="icon" aria-label={notificacoesAbertas["excesso_faltas"] ? "Esconder alunos com excesso de faltas" : "Mostrar alunos com excesso de faltas"} onClick={(e) => { e.stopPropagation(); alternarNotificacao("excesso_faltas"); }}>
                {notificacoesAbertas["excesso_faltas"] ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {notificacoesAbertas["excesso_faltas"] ? <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {excessoFaltas.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void abrirDetalhe(a);
                  }}
                  className="h-auto min-w-0 flex-1 justify-between gap-2 whitespace-normal px-1 py-1.5 text-left text-sm"
                >
                  <span><span className="font-mono text-xs text-muted-foreground">{a.codigo}</span> · {a.nome}</span>
                  <span className="text-xs text-muted-foreground">{faltasPorAluno[a.id]} faltas</span>
                </Button>
                <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div> : null}
          </CardContent>
        </Card>
      ) : null}
        </>
      ) : null}
      {filtroNotificacao !== "todos" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">Filtro ativo:</span>
          <Badge variant="secondary">
            {filtroNotificacao === "ativos" && "Ativos"}
            {filtroNotificacao === "inativos" && "Inativos"}
            {filtroNotificacao === "sem_atestado" && "Sem atestado médico"}
            {filtroNotificacao === "atestado_vencido" && "Atestado vencido"}
            {filtroNotificacao === "atestado_vencer" && "Atestado a vencer"}
            {filtroNotificacao === "excesso_faltas" && "Excesso de faltas"}
          </Badge>
          <Button variant="ghost" size="sm" className="ml-auto h-auto px-2 py-1 text-xs" onClick={() => setFiltroNotificacao("todos")}>
            Limpar
          </Button>
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={filtroNotificacao} onValueChange={(v) => setFiltroNotificacao(v as typeof filtroNotificacao)}>
          <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="sem_atestado">Sem atestado médico</SelectItem>
            <SelectItem value="atestado_vencido">Atestado vencido</SelectItem>
            <SelectItem value="atestado_vencer">Atestado a vencer</SelectItem>
            <SelectItem value="excesso_faltas">Excesso de faltas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPcd} onValueChange={setFiltroPcd}>
          <SelectTrigger><SelectValue placeholder="Filtrar PCD" /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="todos">Todos os alunos</SelectItem>
            <SelectItem value="com">Somente PCD</SelectItem>
            <SelectItem value="sem">Sem PCD</SelectItem>
            <SelectGroup>
              <SelectLabel>Categoria PCD</SelectLabel>
              {CONDICOES_PCD.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as modalidades</SelectItem>
            {MODALIDADES.map((modalidade) => (
              <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroHorario} onValueChange={setFiltroHorario}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="todos">Todos os horários</SelectItem>
            {listaHorarios.map((h) => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroDias} onValueChange={setFiltroDias}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="todos">Todos os dias</SelectItem>
            {listaGrupos.map((g) => (
              <SelectItem key={g.id} value={g.label}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroSexo} onValueChange={setFiltroSexo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os sexos</SelectItem>
            <SelectItem value="Masculino">Masculino</SelectItem>
            <SelectItem value="Feminino">Feminino</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTurno} onValueChange={setFiltroTurno}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os turnos</SelectItem>
            {TURNOS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Input className="w-24" type="number" min={0} placeholder="Idade mín." value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} />
          <span className="text-sm text-muted-foreground">a</span>
          <Input className="w-24" type="number" min={0} placeholder="Idade máx." value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por matrícula, nome, responsável, CPF, RG ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>


        <ImportarAlunos
          turmas={turmas}
          matriculas={matriculas}
          alunos={alunos as unknown as { id: string; nome: string; cpf: string | null; telefone: string | null }[]}
          onImportado={() => void carregar()}
        />

        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Nova matrícula
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">{editando ? "Editar aluno" : "Nova matrícula"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: capitalizarNome(e.target.value) })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatarCPF(e.target.value) })}
                  />
                  {form.cpf && !cpfValido(form.cpf) ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3.5" /> CPF inválido
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nascimento</Label>
                  <Input
                    type="date"
                    value={form.data_nascimento}
                    onChange={(e) => {
                      const nasc = e.target.value;
                      const calculada = idadePorNascimento(nasc);
                      setForm((f) => ({ ...f, data_nascimento: nasc, idade: calculada || f.idade }));
                    }}
                  />

                </div>
                <div className="space-y-2">
                  <Label>Celular</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: formatarCelular(e.target.value) })}
                  />
                  <ConversarWhatsApp telefone={form.telefone} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Celular 2</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={form.telefone2}
                    onChange={(e) => setForm({ ...form, telefone2: formatarCelular(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Idade</Label>
                  <Input type="number" min={0} max={120} value={form.idade} onChange={(e) => setForm({ ...form, idade: e.target.value })} />
                  {form.data_nascimento ? (
                    <p className="text-xs text-muted-foreground">Calculada automaticamente pela data de nascimento.</p>
                  ) : null}

                </div>
              </div>
              <div className="space-y-2">
                <Label>Faixa etária</Label>
                <Input readOnly value={faixaEtariaECA(form.data_nascimento, form.idade) || "—"} />
                <p className="text-xs text-muted-foreground">
                  Preenchido automaticamente (ECA): criança até 11 anos, adolescente de 12 a 17, adulto a partir de 18.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estuda na rede</Label>
                  <Select value={form.rede_ensino} onValueChange={(v) => setForm({ ...form, rede_ensino: v, escola: v === form.rede_ensino ? form.escola : "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pública">Pública</SelectItem>
                      <SelectItem value="Privada">Privada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome-escola">Nome da escola</Label>
                  <SelecionarEscola
                    key={form.rede_ensino}
                    rede={form.rede_ensino}
                    value={form.escola}
                    onChange={(escola) => setForm({ ...form, escola })}
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="atestado">Entregou atestado?</Label>
                  <Switch
                    id="atestado"
                    checked={form.atestado_entregue}
                    aria-invalid={atestadoAnexadoSemConfirmacao}
                    onCheckedChange={(v) => setForm({ ...form, atestado_entregue: v })}
                  />
                </div>
                {form.atestado_entregue ? (
                  <div className="space-y-2">
                    <Label>Data do atestado</Label>
                    <Input
                      type="date"
                      required={!!docs.doc_atestado_path}
                      aria-invalid={atestadoAnexadoSemData}
                      value={form.atestado_data}
                      onChange={(e) => setForm({ ...form, atestado_data: e.target.value })}
                    />
                    {atestadoVencido(form.atestado_data) ? (
                      <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                        <AlertTriangle className="size-4" /> Atestado vencido!
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {atestadoAnexadoSemConfirmacao || atestadoAnexadoSemData ? (
                  <p className="flex items-start gap-1.5 text-sm font-medium text-destructive" role="alert">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {atestadoAnexadoSemConfirmacao && atestadoAnexadoSemData
                      ? "Para anexar o atestado, marque a entrega e preencha a data."
                      : atestadoAnexadoSemConfirmacao
                        ? "Marque que o atestado foi entregue."
                        : "Preencha a data do atestado."}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Modalidades e turmas</Label>
                    <p className="text-xs text-muted-foreground">Escolha até 3 modalidades diferentes.</p>
                  </div>
                  <Badge variant="secondary">{escolhasMatricula.length}/3</Badge>
                </div>
                {escolhasMatricula.map((escolha, indice) => {
                  const grupos = gruposDeTurmas(escolha);
                  return (
                    <div key={indice} className="space-y-3 rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Modalidade {indice + 1}</p>
                        {escolhasMatricula.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            title="Remover modalidade"
                            onClick={() => setEscolhasMatricula((lista) => lista.filter((_, i) => i !== indice))}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Modalidade</Label>
                          <Select
                            value={escolha.modalidade}
                            onValueChange={(valor) => setEscolhasMatricula((lista) => lista.map((item, i) =>
                              i === indice ? { modalidade: valor, turmaId: "", turno: "todos" } : item,
                            ))}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {MODALIDADES.map((modalidade) => (
                                <SelectItem
                                  key={modalidade}
                                  value={modalidade}
                                  disabled={escolhasMatricula.some((item, i) => i !== indice && item.modalidade === modalidade)}
                                >
                                  {modalidade}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Turno</Label>
                          <Select
                            value={escolha.turno}
                            onValueChange={(valor) => setEscolhasMatricula((lista) => lista.map((item, i) => {
                              if (i !== indice) return item;
                              const turma = turmas.find((t) => t.id === item.turmaId);
                              return { ...item, turno: valor, turmaId: turma && valor !== "todos" && turnoDoHorario(turma.horario) !== valor ? "" : item.turmaId };
                            }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos os turnos</SelectItem>
                              {TURNOS.map((turno) => <SelectItem key={turno} value={turno}>{turno}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Turma</Label>
                        <Select
                          value={escolha.turmaId}
                          onValueChange={(valor) => setEscolhasMatricula((lista) => lista.map((item, i) => {
                            if (i !== indice) return item;
                            const turno = turnoDoHorario(turmas.find((t) => t.id === valor)?.horario);
                            return { ...item, turmaId: valor, turno: turno || item.turno };
                          }))}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={carregando ? "Carregando turmas..." : grupos.length ? "Selecione a turma" : `Nenhuma turma de ${escolha.modalidade} disponível`} />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            {erro ? (
                              <div className="px-3 py-2 text-sm text-destructive">Erro ao carregar turmas</div>
                            ) : grupos.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma turma de {escolha.modalidade} cadastrada</div>
                            ) : grupos.map((grupo) => (
                              <SelectGroup key={grupo.label}>
                                <SelectLabel>{grupo.label}</SelectLabel>
                                {grupo.turmas.map((turma) => (
                                  <SelectItem key={turma.id} value={turma.id} disabled={vagasUsadas(turma.id) >= capacidadeTurma(turma.id) && turma.id !== escolha.turmaId}>
                                    {turma.nome.replace(`${grupo.label} - `, "")} · {vagasUsadas(turma.id)}/{capacidadeTurma(turma.id)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
                {escolhasMatricula.length < 3 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const modalidade = MODALIDADES.find((item) => !escolhasMatricula.some((escolha) => escolha.modalidade === item));
                      if (modalidade) setEscolhasMatricula((lista) => [...lista, { modalidade, turmaId: "", turno: "todos" }]);
                    }}
                  >
                    <Plus className="size-4" /> Adicionar modalidade
                  </Button>
                ) : null}
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pcd">Pessoa com deficiência (PCD)</Label>
                  <Switch id="pcd" checked={form.pcd} onCheckedChange={(v) => setForm({ ...form, pcd: v })} />
                </div>
                {form.pcd ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Condições</Label>
                      {CONDICOES_PCD.map((c) => (
                        <label key={c} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={form.pcd_condicoes.includes(c)}
                            onCheckedChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                pcd_condicoes: v
                                  ? [...f.pcd_condicoes, c]
                                  : f.pcd_condicoes.filter((x) => x !== c),
                              }))
                            }
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                    <Input
                      placeholder="Outras observações sobre a deficiência / apoio"
                      value={form.pcd_descricao}
                      onChange={(e) => setForm({ ...form, pcd_descricao: e.target.value })}
                    />
                  </div>
                ) : null}

              </div>
              <div className="space-y-2">
                <Label>Foto do aluno</Label>
                <div className="flex items-center gap-3">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto do aluno" className="size-16 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-16 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-wrap gap-2">
                    <input
                      id="foto-aluno-arquivo"
                      className="hidden"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFoto(f);
                        setFotoPreview(f ? URL.createObjectURL(f) : null);
                      }}
                    />
                    <input
                      id="foto-aluno-camera"
                      className="hidden"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFoto(f);
                        setFotoPreview(f ? URL.createObjectURL(f) : null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("foto-aluno-arquivo")?.click()}
                    >
                      <Upload className="mr-2 size-4" /> Escolher arquivo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("foto-aluno-camera")?.click()}
                    >
                      <Camera className="mr-2 size-4" /> Usar câmera
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={!foto && !editando?.foto_path}
                      onClick={() => void excluirFoto()}
                    >
                      <Trash2 className="mr-2 size-4" /> Excluir foto
                    </Button>
                    {foto ? (
                      <span className="w-full truncate text-xs text-muted-foreground">{foto.name}</span>
                    ) : null}
                  </div>

                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <Label>Fotos dos documentos</Label>
                {DOCUMENTOS.map((d) => (
                  <div key={d.campo} className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {d.rotulo}
                      {editando?.[d.campo] ? " · já enviado" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`doc-${d.campo}`}
                        aria-label={d.rotulo}
                        type="file"
                        accept="image/*,application/pdf"
                        aria-invalid={d.campo === "doc_atestado_path" && (atestadoAnexadoSemConfirmacao || atestadoAnexadoSemData)}
                        onChange={(e) => setDocs((s) => ({ ...s, [d.campo]: e.target.files?.[0] ?? null }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        title="Excluir documento"
                        disabled={!docs[d.campo] && !editando?.[d.campo]}
                        onClick={() => void excluirDocumento(d.campo, d.rotulo)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {d.campo === "doc_ficha_path" ? <LerFicha arquivo={docs.doc_ficha_path} alunoId={editando?.id ?? null} caminho={editando?.doc_ficha_path ?? null} edicao={!!editando} aoAplicar={(campos) => {
                      const patch = { ...campos };
                      if (patch.cpf) patch.cpf = formatarCPF(patch.cpf);
                      if (patch.telefone) patch.telefone = formatarCelular(patch.telefone);
                      if (patch.telefone2) patch.telefone2 = formatarCelular(patch.telefone2);
                      if (patch.sexo && !["Masculino", "Feminino"].includes(patch.sexo)) { toast.error("Revise o sexo: Masculino ou Feminino."); return; }
                      if (patch.rede_ensino && !["Pública", "Privada"].includes(patch.rede_ensino)) { toast.error("Revise a rede de ensino: Pública ou Privada."); return; }
                      if (patch.cpf && !cpfValido(patch.cpf)) { toast.error("O CPF sugerido é inválido. Corrija antes de aplicar."); return; }
                      for (const tel of [campos.telefone, campos.telefone2]) if (tel && tel.replace(/\D/g, "").length !== 11) { toast.error("Revise o celular com DDD e 11 dígitos."); return; }
                      if (patch.data_nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(patch.data_nascimento)) { toast.error("Revise a data no formato AAAA-MM-DD."); return; }
                      setForm((atual) => ({ ...atual, ...patch }));
                      toast.success("Dados aplicados ao formulário. Revise antes de salvar.");
                    }} /> : null}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={salvando || carregando || escolhasMatricula.some((escolha) => !escolha.turmaId)}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtrados.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={todosSelecionados}
              onCheckedChange={(v) =>
                setSelecionados((s) => {
                  const idsFiltrados = filtrados.map((a) => a.id);
                  if (v) {
                    const conjunto = new Set([...s, ...idsFiltrados]);
                    return Array.from(conjunto);
                  }
                  return s.filter((id) => !idsFiltrados.includes(id));
                })
              }
            />
            Selecionar todos
          </label>
          <span className="text-sm text-muted-foreground">{selecionados.length} selecionado(s)</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!selecionados.length} onClick={() => void alternarAtivo(selecionadosAlunos, false)}>
              <UserX className="size-4" /> Inativar
            </Button>
            <Button variant="outline" size="sm" disabled={!selecionados.length} onClick={() => void alternarAtivo(selecionadosAlunos, true)}>
              <UserCheck className="size-4" /> Reativar
            </Button>
            <Button variant="destructive" size="sm" disabled={!selecionados.length} onClick={() => setConfirmarExclusao(selecionadosAlunos)}>
              <Trash2 className="size-4" /> Excluir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={gerandoCrachas || !filtrados.length}>
                  <IdCard className="size-4" /> {gerandoCrachas ? "Gerando..." : "Crachás"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Exportar crachás CR-80 (PDF)</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!selecionados.length}
                  onClick={() => void exportarCrachas(selecionadosAlunos, "cartao")}
                >
                  Selecionados ({selecionados.length}) — 1 por página
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!selecionados.length}
                  onClick={() => void exportarCrachas(selecionadosAlunos, "folha")}
                >
                  Selecionados ({selecionados.length}) — folha A4
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void exportarCrachas(filtrados, "cartao")}>
                  Todos os alunos da lista ({filtrados.length}) — 1 por página
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarCrachas(filtrados, "folha")}>
                  Todos os alunos da lista ({filtrados.length}) — folha A4
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!filtrados.length}>
                  <FileDown className="size-4" /> Exportar lista
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Lista filtrada ({filtrados.length} aluno{filtrados.length !== 1 ? "s" : ""})</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportarListaCsv()}>
                  Exportar em CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarListaPdf()}>
                  Exportar em PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              disabled={exportandoPlanilha || !alunos.length}
              onClick={() => void exportarPlanilha()}
            >
              <FileSpreadsheet className="size-4" /> {exportandoPlanilha ? "Exportando..." : "Exportar planilha"}
            </Button>
            {exportandoPlanilha ? (
              <Button variant="destructive" size="sm" onClick={cancelarExportacaoPlanilha}>
                Cancelar exportação
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {progressoPlanilha ? (
        <Card className="mb-3">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{progressoPlanilha.etapa}</span>
              <span className="text-muted-foreground">
                {progressoPlanilha.feitos} de {progressoPlanilha.total}
              </span>
            </div>
            <Progress
              value={
                progressoPlanilha.total > 0
                  ? Math.round((progressoPlanilha.feitos / progressoPlanilha.total) * 100)
                  : 0
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {filtrados.map((aluno) => {
          const turmasDoAluno = matriculas
            .filter((m) => m.aluno_id === aluno.id)
            .map((m) => turmas.find((t) => t.id === m.turma_id)?.nome)
            .filter(Boolean);
          return (
            <Card key={aluno.id} className="border-border/70">
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <Checkbox
                  checked={selecionados.includes(aluno.id)}
                  onCheckedChange={(v) =>
                    setSelecionados((s) => (v ? [...s, aluno.id] : s.filter((x) => x !== aluno.id)))
                  }
                  aria-label={`Selecionar ${aluno.nome}`}
                />
                {fotos[aluno.id] ? (
                  <img src={fotos[aluno.id]} alt={`Foto de ${aluno.nome}`} className="size-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-pool font-display text-sm font-semibold text-primary-foreground">
                    {aluno.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-40 flex-1">
                  <button type="button" onClick={() => void abrirDetalhe(aluno)} className="text-left font-medium text-foreground hover:text-primary hover:underline">
                    {aluno.nome}
                  </button>
                   <p className="font-mono text-xs text-muted-foreground">Matrícula {aluno.codigo}</p>
                  <p className="text-sm text-muted-foreground">
                    {turmasDoAluno.length ? turmasDoAluno.join(", ") : "Sem turma"}
                    {aluno.telefone ? ` · ${aluno.telefone}` : ""}
                  </p>
                </div>
                {aluno.pcd ? <Badge variant="outline">PCD</Badge> : null}
                <Badge variant={aluno.ativo ? "default" : "secondary"}>{aluno.ativo ? "Ativo" : "Inativo"}</Badge>
                <Button variant="ghost" size="icon" onClick={() => abrirEdicao(aluno)}><Pencil className="size-4" /></Button>
                <Button variant="outline" size="sm" title="Registrar Licença Médica" onClick={() => void abrirDetalhe(aluno)}>
                  <Stethoscope className="size-4" /> Licença médica
                </Button>
                <Button variant="outline" size="icon" title="Visualizar crachá" onClick={() => void abrirPreviewCracha(aluno)}><IdCard className="size-4" /></Button>
                <Button variant="ghost" size="icon" title={aluno.ativo ? "Inativar" : "Reativar"} onClick={() => void alternarAtivo([aluno], !aluno.ativo)}>
                  {aluno.ativo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" title="Excluir" onClick={() => setConfirmarExclusao([aluno])}>
                  <Trash2 className="size-4" />
                </Button>

              </CardContent>
            </Card>
          );
        })}
        {!filtrados.length && (
          <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Nenhum aluno cadastrado ainda.
          </p>
        )}
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{detalhe?.nome}</DialogTitle>
          </DialogHeader>
          {detalhe ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {fotos[detalhe.id] ? (
                  <img src={fotos[detalhe.id]} alt={`Foto de ${detalhe.nome}`} className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="grid size-16 place-items-center rounded-full bg-pool font-display text-primary-foreground">
                    {detalhe.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">
                    Matrícula: <span className="break-all font-mono">{detalhe.codigo}</span>
                  </p>
                  <p>{detalhe.telefone ?? "Sem telefone"}</p>
                  <p>{detalhe.email ?? "Sem e-mail"}</p>
                  <p>{detalhe.responsavel ? `Responsável: ${detalhe.responsavel}` : "Sem responsável"}</p>
                  <p>
                    Idade: {detalhe.idade ?? (idadePorNascimento(detalhe.data_nascimento) || "-")}
                    {turmaDoAluno(detalhe.id)?.horario
                      ? ` · Turno: ${turnoDoHorario(turmaDoAluno(detalhe.id)?.horario)}`
                      : ""}
                  </p>
                </div>
              </div>

              <ConversarWhatsApp telefone={detalhe.telefone} />

              <LicencaMedicaSecao key={detalhe.id} alunoId={detalhe.id} />

              <Button
                variant="outline"
                disabled={gerandoCrachas}
                onClick={() => void exportarCrachas([detalhe], "cartao")}
              >
                <IdCard className="size-4" /> {gerandoCrachas ? "Gerando..." : "Gerar crachá CR-80 (PDF)"}
              </Button>

              {detalhe.observacoes ? (
                <div className="rounded-lg border border-border/70 p-3 text-sm">
                  <p className="mb-1 font-medium">Observações</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detalhe.observacoes}</p>
                </div>
              ) : null}



              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="mb-1 font-medium">Documentos</p>
                <p className="mb-3 text-muted-foreground">
                  RG: {detalhe.rg ?? "-"} · CPF: {detalhe.cpf ?? "-"}
                </p>
                <div className="mb-3 space-y-2">
                  {DOCUMENTOS.map((d) => {
                    const path = detalhe[d.campo];
                    const url = docsUrls[d.campo];
                    return (
                      <div key={d.campo} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={d.rotulo} className="size-12 rounded object-cover" />
                          </a>
                        ) : (
                          <div className="grid size-12 place-items-center rounded bg-muted text-xs text-muted-foreground">—</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{d.rotulo}</p>
                          <p className="text-xs text-muted-foreground">{path ? "Enviado" : "Não enviado"}</p>
                        </div>
                        {path ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void baixarDoc(d.campo, d.rotulo, path, detalhe.nome)}
                          >
                            Baixar
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <p className="mb-1 font-medium">PCD</p>
                <p className="text-muted-foreground">
                  {detalhe.pcd ? detalhe.pcd_descricao || "Sim" : "Não"}
                </p>
                {detalhe.pcd && (detalhe.pcd_condicoes ?? []).length ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {(detalhe.pcd_condicoes ?? []).map((c) => <li key={c}>{c}</li>)}
                  </ul>
                ) : null}
              </div>

              {!detalhe.ativo ? (
                <div className="space-y-1 text-sm">
                  <p className="text-sm font-medium">Inativação</p>
                  <p className="text-muted-foreground">
                    {detalhe.motivo_inativacao ?? "Motivo não informado"}
                  </p>
                  {detalhe.inativado_em ? (
                    <p className="text-xs text-muted-foreground">
                      Inativado em {new Date(detalhe.inativado_em).toLocaleDateString("pt-BR")} às {new Date(detalhe.inativado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {detalhe.inativado_por || detalhe.inativado_por_nome ? ` por ${(detalhe.inativado_por && nomesUsuarios[detalhe.inativado_por]) || detalhe.inativado_por_nome || "usuário"}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium">Matrículas</p>
                {matriculas.filter((m) => m.aluno_id === detalhe.id).length ? (
                  matriculas
                    .filter((m) => m.aluno_id === detalhe.id)
                    .map((m) => (
                      <div key={m.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                        <p className="font-medium">{turmas.find((t) => t.id === m.turma_id)?.nome ?? "Turma"}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.modalidade} · {m.status}
                          {m.data_inicio ? ` · início ${new Date(`${m.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                        {m.created_at ? (
                          <p className="text-xs text-muted-foreground">
                            Matriculado em {new Date(m.created_at).toLocaleDateString("pt-BR")} às {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {m.registrado_por || m.registrado_por_nome ? ` por ${(m.registrado_por && nomesUsuarios[m.registrado_por]) || m.registrado_por_nome || "usuário"}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem matrícula ativa.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Histórico de frequência</p>
                {historico === null ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : historico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro de frequência.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {(["presente", "falta", "falta_justificada"] as const).map((st) => (
                        <div key={st} className="rounded-lg border border-border/70 py-2">
                          <p className="font-display text-lg">{historico.filter((h) => h.status === st).length}</p>
                          <p className="text-xs text-muted-foreground">{ROTULO_STATUS[st]}</p>
                        </div>
                      ))}
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {historico.map((h) => (
                        <div key={h.id} className="rounded-lg bg-secondary/50 px-3 py-1.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span>{new Date(`${h.data}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                            <span className="text-muted-foreground">{ROTULO_STATUS[h.status as keyof typeof ROTULO_STATUS] ?? h.status}</span>
                          </div>
                          {h.observacoes ? <p className="mt-0.5 text-xs text-muted-foreground">Obs.: {h.observacoes}</p> : null}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!qrAluno}
        onOpenChange={(o) => {
          if (!o) {
            setQrAluno(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Crachá de {qrAluno?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="guias-cracha" className="text-sm">
                Guias de alinhamento (grade)
              </Label>
              <Switch id="guias-cracha" checked={mostrarGuias} onCheckedChange={(v) => void alternarGuias(v)} />
            </div>
            {previewUrl ? (
              <img alt="Pré-visualização do crachá" src={previewUrl} className="w-full rounded-lg border border-border" />
            ) : (
              <p className="py-12 text-sm text-muted-foreground">Gerando pré-visualização...</p>
            )}

            <Button
              variant="outline"
              disabled={!qrAluno || gerandoCrachas}
              onClick={() => qrAluno && void exportarCrachas([qrAluno], "cartao")}
            >
              <IdCard className="size-4" /> Baixar crachá (PDF)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => !o && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarExclusao?.length === 1
                ? `${confirmarExclusao[0]?.nome} será removido junto com matrículas e histórico de presença.`
                : `${confirmarExclusao?.length ?? 0} alunos serão removidos junto com matrículas e histórico de presença.`}
              {" "}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void excluirAlunos(confirmarExclusao ?? [])}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!inativando} onOpenChange={(o) => !o && setInativando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar {inativando && inativando.length > 1 ? `${inativando.length} alunos` : "aluno"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {inativando?.length === 1
                ? `${inativando[0]?.nome} será inativado e removido da turma.`
                : `${inativando?.length ?? 0} alunos serão inativados e removidos das turmas.`}
            </p>
            <div className="space-y-1">
              <Label htmlFor="motivo-inativacao">Motivo da inativação *</Label>
              <Textarea
                id="motivo-inativacao"
                value={motivoInativacao}
                onChange={(e) => setMotivoInativacao(e.target.value)}
                placeholder="Ex.: desistência, mudança de cidade, questões de saúde..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInativando(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={!motivoInativacao.trim()} onClick={() => void confirmarInativacao()}>
                <UserX className="size-4" /> Inativar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </AppShell>
  );
}
