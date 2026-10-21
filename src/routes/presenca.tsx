import { ordenarTurmasDoProfessor, usePermissoes } from "@/lib/permissoes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Search, CalendarIcon, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PerfilAluno } from "@/components/PerfilAluno";
import { formatarDataCurta, licencaVigente, type LicencaMedica } from "@/lib/licenca";
import { FAIXAS_ETARIAS, faixaEtariaECA, TURNOS, turnoDoHorario, type FaixaEtaria } from "@/lib/turnos";
import { enfileirar, estaOnline, lerCache, salvarCache } from "@/lib/offline";
import { correspondeBusca, relevanciaBusca } from "@/lib/formatacao";
import { useGruposDias } from "@/lib/dias";
import { MODALIDADES } from "@/lib/modalidades";
import { BotoesChamada, MarcarTodosPresentes, ProgressoChamada } from "@/components/Chamada";
import { EtiquetaSituacao } from "@/components/EtiquetaSituacao";
import { situacaoDoAluno } from "@/lib/situacao";
import { resumoChamada } from "@/lib/chamada";



export const Route = createFileRoute("/presenca")({
  component: PresencaPage,
  head: () => ({
    meta: [
      { title: "Registro de presença | Arena Aquática" },
      { name: "description", content: "Registre a presença dos alunos por leitura de QR Code ou pela lista da turma." },
      { property: "og:title", content: "Registro de presença | Arena Aquática" },
      { property: "og:description", content: "Presença por QR Code na Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Turma = { id: string; nome: string; horario: string | null; modalidade: string; dias_semana: string[] | null };
type Aluno = {
  id: string;
  nome: string;
  codigo: string;
  foto_path: string | null;
  data_nascimento: string | null;
  idade: number | null;
  atestado_entregue?: boolean | null;
  atestado_data?: string | null;
};

/** Iniciais do aluno (primeira e última letra do nome) para quando não há foto. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}
type StatusPresenca = "presente" | "falta" | "falta_justificada";

const rotuloStatus: Record<StatusPresenca, string> = {
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
};

const GRUPOS_DIAS = [
  { rotulo: "Terça e Quinta", prefixo: "terça e quinta", remover: "Terça e Quinta - " },
  { rotulo: "Terça e Quinta", prefixo: "terca e quinta", remover: "Terca e Quinta - " },
  { rotulo: "Quarta e Sexta", prefixo: "quarta e sexta", remover: "Quarta e Sexta - " },
];

function PresencaPage() {
  const { minhasTurmas } = usePermissoes();
  const { lista: listaGrupos } = useGruposDias();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [matriculas, setMatriculas] = useState<{ aluno_id: string; turma_id: string }[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [filtroTurno, setFiltroTurno] = useState("todos");
  const [filtroDias, setFiltroDias] = useState("todos");
  const [faixasEtarias, setFaixasEtarias] = useState<FaixaEtaria[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusPorAluno, setStatusPorAluno] = useState<Record<string, StatusPresenca>>({});
  const [observacao, setObservacao] = useState("");
  const [registros, setRegistros] = useState<{ nome: string; codigo: string; hora: string; status: StatusPresenca; obs: string | null }[]>([]);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [confirmacao, setConfirmacao] = useState<{ aluno: Aluno; jaRegistrado: StatusPresenca | null } | null>(null);
  const [perfilAlunoId, setPerfilAlunoId] = useState<string | null>(null);
  const [licencas, setLicencas] = useState<LicencaMedica[]>([]);
  const statusRef = useRef<Record<string, StatusPresenca>>({});
  statusRef.current = statusPorAluno;



  const [data, setData] = useState<Date>(new Date());
  const hoje = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    void (async () => {
      if (!estaOnline()) {
        const c = await lerCache<{ turmas: Turma[]; alunos: Aluno[]; matriculas: { aluno_id: string; turma_id: string }[] }>("presenca");
        if (c) {
          setTurmas(c.turmas ?? []);
          setAlunos(c.alunos ?? []);
          setMatriculas(c.matriculas ?? []);
        }
        return;
      }
      const [t, a, m] = await Promise.all([
        supabase.from("turmas").select("id,nome,horario,modalidade,dias_semana").order("nome"),
        supabase.from("alunos").select("id,nome,codigo,foto_path,data_nascimento,idade,atestado_entregue,atestado_data").eq("ativo", true).order("nome"),
        supabase.from("matriculas").select("aluno_id,turma_id").eq("status", "ativa"),
      ]);
      const lic = await supabase.from("licencas_medicas").select("*").eq("status", "ativa");
      if (lic.data) setLicencas(lic.data as LicencaMedica[]);
      if (t.data) setTurmas(t.data as Turma[]);
      const listaAlunos = (a.data ?? []) as Aluno[];
      if (a.data) setAlunos(listaAlunos);
      if (m.data) setMatriculas(m.data as { aluno_id: string; turma_id: string }[]);
      void salvarCache("presenca", { turmas: t.data ?? [], alunos: a.data ?? [], matriculas: m.data ?? [] });
      const comFoto = listaAlunos.filter((x) => x.foto_path);
      if (comFoto.length) {
        const { data: signed } = await supabase.storage
          .from("fotos-alunos")
          .createSignedUrls(comFoto.map((x) => x.foto_path as string), 3600);
        const mapa: Record<string, string> = {};
        comFoto.forEach((x, i) => {
          const url = signed?.[i]?.signedUrl;
          if (url) mapa[x.id] = url;
        });
        setFotos(mapa);
      }
    })();
  }, []);


  async function carregarPresencasDoDia(autoLicenca = false): Promise<void> {
    if (!estaOnline()) return;
    let consulta = supabase
      .from("presencas")
      .select("aluno_id,turma_id,horario,status,observacoes,alunos(nome,codigo)")
      .eq("data", hoje)
      .order("horario", { ascending: false });
    if (turmaId) consulta = consulta.eq("turma_id", turmaId);
    const { data } = await consulta;
    if (!data) return;
    if (turmaId && !autoLicenca) {
      const registrados = new Set(data.map((r) => String(r.aluno_id)));
      const pendentes = licencas.filter(
        (l) =>
          licencaVigente(l, hoje) &&
          !registrados.has(l.aluno_id) &&
          matriculas.some((m) => m.aluno_id === l.aluno_id && m.turma_id === turmaId),
      );
      if (pendentes.length) {
        await supabase.from("presencas").insert(
          pendentes.map((l) => ({
            aluno_id: l.aluno_id,
            turma_id: turmaId,
            data: hoje,
            metodo: "licenca",
            status: "falta_justificada",
            observacoes: `Licença médica até ${formatarDataCurta(l.data_retorno)}`,
          })),
        );
        return carregarPresencasDoDia(true);
      }
    }
    const mapa: Record<string, StatusPresenca> = {};
    data.forEach((r) => {
      mapa[`${String(r.aluno_id)}:${String(r.turma_id ?? "")}`] = (r.status as StatusPresenca) ?? "presente";
    });
    setStatusPorAluno(mapa);
    setRegistros(
      data.map((r) => ({
        nome: (r.alunos as { nome: string; codigo: string } | null)?.nome ?? "Aluno",
        codigo: (r.alunos as { nome: string; codigo: string } | null)?.codigo ?? "",
        hora: new Date(r.horario as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status: (r.status as StatusPresenca) ?? "presente",
        obs: (r.observacoes as string | null) ?? null,
      })),
    );
  }

  useEffect(() => {
    void carregarPresencasDoDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, turmaId, licencas, matriculas]);

  async function registrar(aluno: Aluno, metodo: "qrcode" | "manual", status: StatusPresenca = "presente") {
    const obs = observacao.trim() ? observacao.trim() : null;
    const agoraIso = new Date().toISOString();

    if (!estaOnline()) {
      await enfileirar({
        tipo: "presenca",
        aluno_id: aluno.id,
        turma_id: turmaId || null,
        data: hoje,
        status,
        metodo,
        observacoes: obs,
        horario: agoraIso,
      });
      setStatusPorAluno((s) => ({ ...s, [`${aluno.id}:${turmaId}`]: status }));
      setRegistros((r) => [
        { nome: aluno.nome, codigo: aluno.codigo, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), status, obs },
        ...r.filter((x) => x.nome !== aluno.nome),
      ]);
      setObservacao("");
      toast.success(`${rotuloStatus[status]}: ${aluno.nome} (salvo offline)`);
      return;
    }

    const existente = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", aluno.id)
      .eq("data", hoje)
      .eq("turma_id", turmaId)
      .maybeSingle();

    if (existente.data) {
      const { error } = await supabase
        .from("presencas")
        .update({ status, metodo, turma_id: turmaId || null, horario: agoraIso, observacoes: obs })
        .eq("id", existente.data.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("presencas").insert({
        aluno_id: aluno.id,
        turma_id: turmaId || null,
        data: hoje,
        metodo,
        status,
        observacoes: obs,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success(`${rotuloStatus[status]}: ${aluno.nome}`);
    setObservacao("");
    void carregarPresencasDoDia();
  }

  /** Segundo clique no botão já ativo: desmarca e apaga o registro do dia. */
  async function removerRegistro(aluno: Aluno) {
    const chave = `${aluno.id}:${turmaId}`;
    setStatusPorAluno((s) => {
      const copia = { ...s };
      delete copia[chave];
      return copia;
    });
    setRegistros((r) => r.filter((x) => !(x.nome === aluno.nome && x.codigo === aluno.codigo)));
    if (!estaOnline()) {
      toast.success(`Registro removido: ${aluno.nome} (salvo offline)`);
      return;
    }
    const existente = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", aluno.id)
      .eq("data", hoje)
      .eq("turma_id", turmaId)
      .maybeSingle();
    if (existente.data) {
      const { error } = await supabase.from("presencas").delete().eq("id", existente.data.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success(`Registro removido: ${aluno.nome}`);
    void carregarPresencasDoDia();
  }

  /** Marca como presentes só os alunos da turma ainda sem registro (quem está em licença fica de fora). */
  async function marcarTodosPresentes(ids: string[]) {
    if (!turmaId || !ids.length) return;
    const agoraIso = new Date().toISOString();
    if (!estaOnline()) {
      for (const id of ids) {
        await enfileirar({ tipo: "presenca", aluno_id: id, turma_id: turmaId, data: hoje, status: "presente", metodo: "manual", observacoes: null, horario: agoraIso });
      }
      setStatusPorAluno((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [`${id}:${turmaId}`, "presente" as StatusPresenca])) }));
      toast.success(`${ids.length} aluno(s) marcados como presentes (salvo offline)`);
      return;
    }
    // Confere de novo no servidor para nunca sobrescrever um registro já lançado.
    const { data: existentes, error: erroConsulta } = await supabase
      .from("presencas")
      .select("aluno_id")
      .eq("data", hoje)
      .eq("turma_id", turmaId)
      .in("aluno_id", ids);
    if (erroConsulta) return void toast.error(erroConsulta.message);
    const jaTem = new Set((existentes ?? []).map((r) => String(r.aluno_id)));
    const novos = ids.filter((id) => !jaTem.has(id));
    if (novos.length) {
      const { error } = await supabase.from("presencas").insert(
        novos.map((id) => ({ aluno_id: id, turma_id: turmaId, data: hoje, metodo: "manual", status: "presente", observacoes: null })),
      );
      if (error) return void toast.error(error.message);
    }
    toast.success(`${novos.length} aluno(s) marcados como presentes`);
    void carregarPresencasDoDia();
  }

  function onScan(texto: string) {
    const agora = Date.now();
    
    if (lastRef.current.code === texto && agora - lastRef.current.at < 4000) return;
    lastRef.current = { code: texto, at: agora };
    const aluno = alunos.find((a) => a.codigo === texto.trim());
    if (!aluno) {
      toast.error("QR Code não reconhecido.");
      return;
    }
    setConfirmacao((atual) => atual ?? { aluno, jaRegistrado: statusRef.current[aluno.id] ?? null });
  }


  async function iniciarScanner() {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("leitor-qr");
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto) => void onScan(texto),
        () => {},
      );
      setScanning(true);
    } catch {
      toast.error("Não foi possível acessar a câmera.");
    }
  }

  async function pararScanner() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* ignora */
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const turmasDoAluno = (id: string) => matriculas
    .filter((matricula) => matricula.aluno_id === id)
    .map((matricula) => turmas.find((turma) => turma.id === matricula.turma_id))
    .filter((turma): turma is Turma => Boolean(turma));

  const filtrados = alunos
    .filter((a) => {
      if (!correspondeBusca(a, busca)) return false;
      const faixa = faixaEtariaECA(a.data_nascimento, a.idade);
      if (faixasEtarias.length && (!faixa || !faixasEtarias.includes(faixa))) return false;
      const turmasAluno = turmasDoAluno(a.id);
      if (turmaId && !turmasAluno.some((turma) => turma.id === turmaId)) return false;
      if (filtroModalidade !== "todas" && !turmasAluno.some((turma) => (turma.modalidade ?? "") === filtroModalidade)) return false;
      if (filtroTurno !== "todos" && !turmasAluno.some((turma) => turnoDoHorario(turma.horario) === filtroTurno)) return false;
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        if (!diasEsperados.length || !turmasAluno.some((turma) => diasEsperados.every((dia) => (turma.dias_semana ?? []).includes(dia)))) return false;
      }
      return true;
    })
    .sort((a, b) => relevanciaBusca(a.nome, busca) - relevanciaBusca(b.nome, busca) || a.nome.localeCompare(b.nome));
  const turmasVisiveis = ordenarTurmasDoProfessor(turmas, minhasTurmas).filter(
    (t) => {
      if (filtroModalidade !== "todas" && t.modalidade !== filtroModalidade) return false;
      if (filtroTurno !== "todos" && turnoDoHorario(t.horario) !== filtroTurno) return false;
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        const diasTurma = t.dias_semana ?? [];
        if (!diasEsperados.length || !diasEsperados.every((d) => diasTurma.includes(d))) return false;
      }
      return true;
    },
  );

  const licencaDoAluno = (id: string) => licencas.find((l) => l.aluno_id === id && licencaVigente(l, hoje));
  const idsDaTurma = turmaId
    ? alunos.filter((a) => matriculas.some((m) => m.aluno_id === a.id && m.turma_id === turmaId)).map((a) => a.id)
    : [];
  const chamada = resumoChamada(idsDaTurma, (id) => Boolean(statusPorAluno[`${id}:${turmaId}`]), (id) => Boolean(licencaDoAluno(id)));

  return (
    <AppShell title="Presença" subtitle={`Registros de ${data.toLocaleDateString("pt-BR")}`}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 [&>*]:min-w-0">
        <div className="space-y-2">

          <Label>Data do registro</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="size-4" />
                {format(data, "PPP", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={data}
                onSelect={(d) => d && setData(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Turno</Label>
          <Select
            value={filtroTurno}
            onValueChange={(v) => {
              setFiltroTurno(v);
              setTurmaId("");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os turnos</SelectItem>
              {TURNOS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">

          <Label>Modalidade</Label>
          <Select
            value={filtroModalidade}
            onValueChange={(v) => {
              setFiltroModalidade(v);
              setTurmaId("");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as modalidades</SelectItem>
              {MODALIDADES.map((modalidade) => (
                <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dias</Label>
          <Select
            value={filtroDias}
            onValueChange={(v) => {
              setFiltroDias(v);
              setTurmaId("");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="todos">Todos os dias</SelectItem>
              {listaGrupos.map((g) => (
                <SelectItem key={g.id} value={g.label}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Faixa etária</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                <span className="truncate">
                  {faixasEtarias.length === 0
                    ? "Todas as faixas"
                    : faixasEtarias.length === 1
                      ? faixasEtarias[0]
                      : `${faixasEtarias.length} faixas selecionadas`}
                </span>
                <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              {FAIXAS_ETARIAS.map((faixa) => (
                <DropdownMenuCheckboxItem
                  key={faixa}
                  checked={faixasEtarias.includes(faixa)}
                  onSelect={(evento) => evento.preventDefault()}
                  onCheckedChange={(marcada) =>
                    setFaixasEtarias((atuais) =>
                      marcada ? [...atuais, faixa] : atuais.filter((item) => item !== faixa),
                    )
                  }
                >
                  {faixa}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-2">
          <Label>Turma da aula</Label>
          <Select value={turmaId} onValueChange={setTurmaId}>
            <SelectTrigger><SelectValue placeholder="Selecione a turma (opcional)" /></SelectTrigger>
            <SelectContent className="max-h-80">
              {GRUPOS_DIAS.map((g) => {
                const doGrupo = turmasVisiveis.filter((t) => t.nome.toLowerCase().startsWith(g.prefixo));
                if (!doGrupo.length) return null;
                return (
                  <SelectGroup key={g.rotulo}>
                    <SelectLabel>{g.rotulo}</SelectLabel>
                    {doGrupo.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome.replace(g.remover, "")}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
              {turmasVisiveis.filter((t) => !GRUPOS_DIAS.some((g) => t.nome.toLowerCase().startsWith(g.prefixo))).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}{t.horario ? ` · ${t.horario}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
        <Tabs defaultValue="qr">
          <TabsList>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="lista">Lista manual</TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="pt-4">
            <Card className="border-border/70">
              <CardContent className="space-y-4 pt-6">
                <div id="leitor-qr" className="overflow-hidden rounded-xl bg-secondary [&_video]:w-full" />
                {!scanning ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Aponte a câmera para o QR Code da carteirinha do aluno.
                  </div>
                ) : null}
                {scanning ? (
                  <Button variant="outline" className="w-full" onClick={() => void pararScanner()}>
                    <CameraOff className="size-4" /> Parar leitura
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => void iniciarScanner()}>
                    <Camera className="size-4" /> Iniciar leitura
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lista" className="pt-4">
            <Card className="border-border/70">
              <CardContent className="space-y-3 pt-6">
                {turmaId ? (
                  <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/40 p-3">
                    <ProgressoChamada marcados={chamada.marcados} total={chamada.total} />
                    <MarcarTodosPresentes
                      pendentes={chamada.pendentes.length}
                      emLicenca={chamada.emLicenca}
                      onConfirmar={() => marcarTodosPresentes(chamada.pendentes)}
                    />
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Escolha a turma da aula para ver o progresso da chamada e marcar todos de uma vez.
                  </p>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por matrícula ou nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações (justificativa)</Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex.: apresentou atestado médico"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">O texto é salvo no histórico do aluno junto com o registro.</p>
                </div>
                <div className="max-h-[38rem] space-y-2 overflow-y-auto pr-1">
                  {filtrados.map((a) => {
                    const atual = statusPorAluno[`${a.id}:${turmaId}`];
                    const lic = licencaDoAluno(a.id);
                    const situacao = situacaoDoAluno({ ativo: true, atestado_entregue: a.atestado_entregue, atestado_data: a.atestado_data }, Boolean(lic));
                    return (
                      <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {fotos[a.id] ? (
                            <img
                              src={fotos[a.id]}
                              alt={`Foto de ${a.nome}`}
                              loading="lazy"
                              className="size-14 shrink-0 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-muted-foreground">
                              {iniciais(a.nome)}
                            </span>
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <button type="button" className="block max-w-full truncate text-left font-medium hover:underline" title="Abrir perfil do aluno" onClick={() => setPerfilAlunoId(a.id)}>{a.nome}</button>
                            <p className="font-mono text-xs text-muted-foreground">Matrícula {a.codigo}</p>
                            <EtiquetaSituacao situacao={situacao} texto={lic ? `Licença até ${formatarDataCurta(lic.data_retorno)}` : undefined} />
                          </div>
                        </div>
                        <BotoesChamada
                          atual={atual}
                          onEscolher={(status) => void (atual === status ? removerRegistro(a) : registrar(a, "manual", status))}
                        />
                      </div>
                    );
                  })}
                  {!filtrados.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-border/70">
          <CardHeader><CardTitle className="font-display text-lg">Registros do dia ({registros.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
            {registros.map((r, i) => (
              <div key={i} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span><span className="font-mono text-xs text-muted-foreground">{r.codigo}</span> · {r.nome}</span>
                  <span className="text-muted-foreground">{rotuloStatus[r.status]} · {r.hora}</span>
                </div>
                {r.obs ? <p className="mt-0.5 text-xs text-muted-foreground">Obs.: {r.obs}</p> : null}
              </div>
            ))}
            {!registros.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro nesta data.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(confirmacao)} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.jaRegistrado ? "Presença já registrada hoje" : "Confirmar presença?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.jaRegistrado ? (
                <>
                  <strong>{confirmacao.aluno.nome}</strong> já tem registro de{" "}
                  {rotuloStatus[confirmacao.jaRegistrado].toLowerCase()} em{" "}
                  {format(data, "dd/MM/yyyy", { locale: ptBR })}. Deseja registrar novamente (o registro anterior será
                  substituído)?
                </>
              ) : (
                <>
                  Registrar presença de <strong>{confirmacao?.aluno.nome}</strong> em{" "}
                  {format(data, "dd/MM/yyyy", { locale: ptBR })}?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                lastRef.current = { code: "", at: 0 };
                setConfirmacao(null);
              }}
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const alvo = confirmacao;
                setConfirmacao(null);
                if (alvo) void registrar(alvo.aluno, "qrcode");
              }}
            >
              {confirmacao?.jaRegistrado ? "Registrar mesmo assim" : "Sim"}
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>
      <PerfilAluno alunoId={perfilAlunoId} onFechar={() => setPerfilAlunoId(null)} />
    </AppShell>

  );
}
