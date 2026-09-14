import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Search, X, FileCheck, CalendarIcon } from "lucide-react";
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
import { TURNOS, turnoDoHorario } from "@/lib/turnos";
import { enfileirar, estaOnline, lerCache, salvarCache } from "@/lib/offline";
import { correspondeBusca, relevanciaBusca } from "@/lib/formatacao";
import { useGruposDias } from "@/lib/dias";



export const Route = createFileRoute("/presenca")({
  component: PresencaPage,
  head: () => ({
    meta: [
      { title: "Registro de presença | Arena Aquática" },
      { name: "description", content: "Registre a presença dos alunos por leitura de QR Code ou pela lista da turma." },
      { property: "og:title", content: "Registro de presença | Arena Aquática" },
      { property: "og:description", content: "Presença por QR Code na Arena Aquática." },
    ],
  }),
});

type Turma = { id: string; nome: string; horario: string | null; modalidade: string; dias_semana: string[] | null };
type Aluno = { id: string; nome: string; codigo: string; foto_path: string | null };

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
  const { lista: listaGrupos } = useGruposDias();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [matriculas, setMatriculas] = useState<{ aluno_id: string; turma_id: string }[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [filtroTurno, setFiltroTurno] = useState("todos");
  const [filtroDias, setFiltroDias] = useState("todos");
  const [scanning, setScanning] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusPorAluno, setStatusPorAluno] = useState<Record<string, StatusPresenca>>({});
  const [observacao, setObservacao] = useState("");
  const [registros, setRegistros] = useState<{ nome: string; hora: string; status: StatusPresenca; obs: string | null }[]>([]);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [confirmacao, setConfirmacao] = useState<{ aluno: Aluno; jaRegistrado: StatusPresenca | null } | null>(null);
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
        supabase.from("alunos").select("id,nome,codigo,foto_path").eq("ativo", true).order("nome"),
        supabase.from("matriculas").select("aluno_id,turma_id").eq("status", "ativa"),
      ]);
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


  async function carregarPresencasDoDia() {
    if (!estaOnline()) return;
    const { data } = await supabase
      .from("presencas")
      .select("aluno_id,horario,status,observacoes,alunos(nome)")
      .eq("data", hoje)
      .order("horario", { ascending: false });
    if (!data) return;
    const mapa: Record<string, StatusPresenca> = {};
    data.forEach((r) => {
      mapa[r.aluno_id as string] = (r.status as StatusPresenca) ?? "presente";
    });
    setStatusPorAluno(mapa);
    setRegistros(
      data.map((r) => ({
        nome: (r.alunos as { nome: string } | null)?.nome ?? "Aluno",
        hora: new Date(r.horario as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status: (r.status as StatusPresenca) ?? "presente",
        obs: (r.observacoes as string | null) ?? null,
      })),
    );
  }

  useEffect(() => {
    void carregarPresencasDoDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje]);

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
      setStatusPorAluno((s) => ({ ...s, [aluno.id]: status }));
      setRegistros((r) => [
        { nome: aluno.nome, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), status, obs },
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

  const turmaDoAluno = (id: string) => {
    const m = matriculas.find((x) => x.aluno_id === id);
    return m ? turmas.find((t) => t.id === m.turma_id) ?? null : null;
  };

  const filtrados = alunos
    .filter((a) => {
      if (!correspondeBusca(a, busca)) return false;
      const t = turmaDoAluno(a.id);
      if (turmaId && t?.id !== turmaId) return false;
      if (filtroModalidade !== "todas" && (t?.modalidade ?? "") !== filtroModalidade) return false;
      if (filtroTurno !== "todos" && turnoDoHorario(t?.horario) !== filtroTurno) return false;
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        const diasTurma = t?.dias_semana ?? [];
        if (!diasEsperados.length || !diasEsperados.every((d) => diasTurma.includes(d))) return false;
      }
      return true;
    })
    .sort((a, b) => relevanciaBusca(a.nome, busca) - relevanciaBusca(b.nome, busca) || a.nome.localeCompare(b.nome));
  const turmasVisiveis = turmas.filter(
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

  return (
    <AppShell title="Presença" subtitle={`Registros de ${data.toLocaleDateString("pt-BR")}`}>
      <div className="mb-6 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <SelectItem value="Natação">Natação</SelectItem>
              <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
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


      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} />
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
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {filtrados.map((a) => {
                    const atual = statusPorAluno[a.id];
                    return (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                        <div className="flex min-w-32 flex-1 items-center gap-2.5">
                          {fotos[a.id] ? (
                            <img
                              src={fotos[a.id]}
                              alt={`Foto de ${a.nome}`}
                              loading="lazy"
                              className="size-10 shrink-0 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-muted-foreground">
                              {iniciais(a.nome)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="text-sm">{a.nome}</span>
                            {atual ? <p className="text-xs text-muted-foreground">{rotuloStatus[atual]}</p> : null}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant={atual === "presente" ? "default" : "outline"} onClick={() => void registrar(a, "manual", "presente")}>
                            <Check className="size-4" /> Presença
                          </Button>
                          <Button size="sm" variant={atual === "falta" ? "destructive" : "outline"} onClick={() => void registrar(a, "manual", "falta")}>
                            <X className="size-4" /> Falta
                          </Button>
                          <Button size="sm" variant={atual === "falta_justificada" ? "secondary" : "outline"} onClick={() => void registrar(a, "manual", "falta_justificada")}>
                            <FileCheck className="size-4" /> Justificada
                          </Button>
                        </div>
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
          <CardContent className="space-y-2">
            {registros.map((r, i) => (
              <div key={i} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{r.nome}</span>
                  <span className="text-muted-foreground">{rotuloStatus[r.status]} · {r.hora}</span>
                </div>
                {r.obs ? <p className="mt-0.5 text-xs text-muted-foreground">Obs.: {r.obs}</p> : null}
              </div>
            ))}
            {!registros.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro nesta data.</p>}
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
    </AppShell>

  );
}
