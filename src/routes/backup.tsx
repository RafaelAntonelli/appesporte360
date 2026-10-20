import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, AtSign, CalendarClock, CheckCircle2, CloudUpload, FolderCog, FolderTree, KeyRound, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useConfiguracaoTexto } from "@/lib/configuracoes";
import {
  CHAVE_PASTA_DOCUMENTOS,
  CHAVE_PASTA_IMAGENS,
  CHAVE_PASTA_PLANILHAS,
  TIPOS_DOCUMENTO,
  chaveSubpastaDocumento,
  extrairIdPastaDrive,
  limparNomeSubpasta,
} from "@/lib/configuracoes-chaves";
import { useAuth } from "@/lib/auth";
import {
  validarPastasDriveFn,
  statusBackupFn,
  salvarAgendamentoFn,
  contaDriveFn,
  historicoBackupFn,
  reenviarFalhasFn,
} from "@/lib/backup.functions";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RestaurarDrive } from "@/components/RestaurarDrive";
import { ValidadeLinks } from "@/components/ValidadeLinks";

function duracao(inicio: string, fim: string | null) {
  if (!fim) return "—";
  const seg = Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000));
  return seg >= 60 ? `${Math.floor(seg / 60)} min ${seg % 60} s` : `${seg} s`;
}

import { assinarBackup, estadoBackupAtual, executarBackupGlobal, notificar, type EstadoBackup } from "@/lib/backup-execucao";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Dias da semana no formato usado pelo agendador (0 = domingo). */
const DIAS_SEMANA = [
  { valor: 0, rotulo: "Domingo" },
  { valor: 1, rotulo: "Segunda-feira" },
  { valor: 2, rotulo: "Terça-feira" },
  { valor: 3, rotulo: "Quarta-feira" },
  { valor: 4, rotulo: "Quinta-feira" },
  { valor: 5, rotulo: "Sexta-feira" },
  { valor: 6, rotulo: "Sábado" },
] as const;


type ChecagemPasta = {
  chave: string;
  rotulo: string;
  id: string;
  padrao: boolean;
  ok: boolean;
  nome?: string | undefined;
  erro?: string | undefined;
};

/** Campo de subpasta (dentro da pasta de documentos) para um tipo de documento. */
function CampoSubpasta({ campo, rotulo, padrao }: { campo: string; rotulo: string; padrao: string }) {
  const config = useConfiguracaoTexto(chaveSubpastaDocumento(campo));
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config.carregando) setTexto(config.valor);
  }, [config.carregando, config.valor]);

  async function salvar() {
    const limpo = limparNomeSubpasta(texto);
    if (limpo === config.valor) return;
    setSalvando(true);
    try {
      await config.salvar(limpo);
      setTexto(limpo);
      toast.success(`Subpasta de ${rotulo.toLowerCase()} atualizada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a subpasta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`sub-${campo}`}>{rotulo}</Label>
      <Input
        id={`sub-${campo}`}
        value={texto}
        disabled={salvando}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => void salvar()}
        placeholder={`Ex.: ${padrao} (em branco = pasta principal)`}
      />
    </div>
  );
}

export const Route = createFileRoute("/backup")({
  component: BackupPage,
  head: () => ({
    meta: [
      { title: "Backup no Google Drive | Arena Aquática" },
      {
        name: "description",
        content: "Envie a planilha de alunos e os documentos para o Google Drive. Acesso restrito a administradores.",
      },
      { property: "og:title", content: "Backup no Google Drive | Arena Aquática" },
      { property: "og:description", content: "Backup manual e automático dos dados da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function formatarTempo(segundos: number) {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}min ${String(s % 60).padStart(2, "0")}s`;
}

/** Chave de sessão: a senha só é pedida uma vez por sessão do navegador. */
const CHAVE_LIBERADO = "arena:backup-liberado";

/** Pede a senha do administrador (a mesma do login) antes de liberar a tela. */
function SenhaAdmin({ email, onLiberar }: { email: string; onLiberar: () => void }) {
  const [senha, setSenha] = useState("");
  const [verificando, setVerificando] = useState(false);

  async function conferir() {
    if (!senha) {
      toast.error("Informe a senha de administrador.");
      return;
    }
    setVerificando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        toast.error("Senha incorreta.");
        return;
      }
      sessionStorage.setItem(CHAVE_LIBERADO, "1");
      setSenha("");
      onLiberar();
    } finally {
      setVerificando(false);
    }
  }

  return (
    <AppShell title="Backup" subtitle="Confirmação de segurança">
      <Card className="max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <KeyRound className="size-4" /> Senha de administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para acessar a tela de Backup, confirme a senha da sua conta de administrador.
          </p>
          <div className="space-y-2">
            <Label htmlFor="senha-backup">Senha</Label>
            <Input
              id="senha-backup"
              type="password"
              value={senha}
              maxLength={128}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void conferir();
              }}
            />
          </div>
          <Button disabled={verificando} onClick={() => void conferir()}>
            {verificando ? "Verificando..." : "Acessar"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function BackupPage() {
  const { isAdmin, user } = useAuth();
  const [liberado, setLiberado] = useState(false);
  // Estado global: o backup continua rodando mesmo ao trocar de tela.
  const [estadoBackup, setEstadoBackup] = useState<EstadoBackup>(() => estadoBackupAtual());
  const backupando = estadoBackup.executando;
  const progresso = estadoBackup.progresso;
  const [ultimo, setUltimo] = useState<{ ultimo_backup: string | null; ultimo_resultado: string | null } | null>(null);
  const pastaPlanilhas = useConfiguracaoTexto(CHAVE_PASTA_PLANILHAS);
  const pastaImagens = useConfiguracaoTexto(CHAVE_PASTA_IMAGENS);
  const pastaDocumentos = useConfiguracaoTexto(CHAVE_PASTA_DOCUMENTOS);
  const [formPlanilhas, setFormPlanilhas] = useState("");
  const [formImagens, setFormImagens] = useState("");
  const [formDocumentos, setFormDocumentos] = useState("");
  const [salvandoPastas, setSalvandoPastas] = useState(false);
  const [checagens, setChecagens] = useState<ChecagemPasta[] | null>(null);
  const [verificando, setVerificando] = useState(false);
  const validarPastas = useServerFn(validarPastasDriveFn);
  const lerConta = useServerFn(contaDriveFn);
  const [conta, setConta] = useState<{ email: string | null; nome: string | null; erro?: string } | null>(null);
  const [lendoConta, setLendoConta] = useState(false);

  const carregarConta = useCallback(async () => {
    setLendoConta(true);
    try {
      const dados = await lerConta({ data: undefined });
      setConta(dados);
      return dados;
    } catch {
      setConta({ email: null, nome: null, erro: "Não foi possível consultar a conta conectada." });
      return null;
    } finally {
      setLendoConta(false);
    }
  }, [lerConta]);

  async function verificarConta() {
    const dados = await carregarConta();
    if (dados?.email) toast.success(`Backup guardado na conta ${dados.email}.`);
    else toast.error(dados?.erro ?? "Não foi possível identificar a conta conectada.");
  }


  async function verificarPastas() {
    setVerificando(true);
    try {
      const resultado = (await validarPastas({ data: undefined })) as ChecagemPasta[];
      setChecagens(resultado);
      const ruins = resultado.filter((c) => !c.ok);
      if (ruins.length === 0) toast.success("Todas as pastas do Drive estão acessíveis.");
      else toast.error(`${ruins.length} pasta(s) com problema. Confira os detalhes abaixo.`);
      return resultado;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível verificar as pastas.");
      return null;
    } finally {
      setVerificando(false);
    }
  }

  useEffect(() => {
    if (!pastaPlanilhas.carregando) setFormPlanilhas(pastaPlanilhas.valor);
  }, [pastaPlanilhas.carregando, pastaPlanilhas.valor]);

  useEffect(() => {
    if (!pastaImagens.carregando) setFormImagens(pastaImagens.valor);
  }, [pastaImagens.carregando, pastaImagens.valor]);

  useEffect(() => {
    if (!pastaDocumentos.carregando) setFormDocumentos(pastaDocumentos.valor);
  }, [pastaDocumentos.carregando, pastaDocumentos.valor]);

  async function salvarPastas() {
    const idPlanilhas = extrairIdPastaDrive(formPlanilhas);
    const idImagens = extrairIdPastaDrive(formImagens);
    const idDocumentos = extrairIdPastaDrive(formDocumentos);
    if (formPlanilhas.trim() && !idPlanilhas) {
      toast.error("Link ou ID inválido para a pasta da planilha.");
      return;
    }
    if (formImagens.trim() && !idImagens) {
      toast.error("Link ou ID inválido para a pasta das fotos.");
      return;
    }
    if (formDocumentos.trim() && !idDocumentos) {
      toast.error("Link ou ID inválido para a pasta dos documentos.");
      return;
    }
    setSalvandoPastas(true);
    try {
      await pastaPlanilhas.salvar(idPlanilhas);
      await pastaImagens.salvar(idImagens);
      await pastaDocumentos.salvar(idDocumentos);
      setFormPlanilhas(idPlanilhas);
      setFormImagens(idImagens);
      setFormDocumentos(idDocumentos);
      toast.success("Pastas de destino atualizadas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar as pastas.");
    } finally {
      setSalvandoPastas(false);
    }
  }

  const lerStatus = useServerFn(statusBackupFn);
  const salvarAgendamento = useServerFn(salvarAgendamentoFn);
  const [agenda, setAgenda] = useState({ dia_semana: 1, hora: 3, minuto: 0, ativo: true });
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const ultimoAvisadoRef = useRef<string | null>(null);
  const lerHistorico = useServerFn(historicoBackupFn);
  const reenviarFalhas = useServerFn(reenviarFalhasFn);
  const [historico, setHistorico] = useState<Awaited<ReturnType<typeof historicoBackupFn>>>([]);
  const [vendoFalhas, setVendoFalhas] = useState<(typeof historico)[number] | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const carregarHistorico = useCallback(async () => {
    try {
      setHistorico(await lerHistorico({ data: undefined }));
    } catch {
      /* leitura opcional */
    }
  }, [lerHistorico]);
  useEffect(() => {
    if (isAdmin && !backupando) void carregarHistorico();
  }, [isAdmin, backupando, carregarHistorico]);

  const atualizarStatus = useCallback(
    async (avisar: boolean) => {
      try {
        const dados = await lerStatus({ data: undefined });
        if (!dados) return;
        setUltimo({ ultimo_backup: dados.ultimo_backup, ultimo_resultado: dados.ultimo_resultado });
        setAgenda({
          dia_semana: dados.dia_semana ?? 1,
          hora: dados.hora ?? 3,
          minuto: dados.minuto ?? 0,
          ativo: dados.ativo ?? true,
        });
        const marca = dados.ultimo_backup ?? "";
        if (!avisar || !marca) {
          ultimoAvisadoRef.current = marca;
          return;
        }
        if (ultimoAvisadoRef.current && marca !== ultimoAvisadoRef.current) {
          notificar(
            dados.ultimo_status === "falha" ? "Backup automático falhou" : "Backup automático concluído",
            dados.ultimo_resultado ?? "",
            dados.ultimo_status === "falha",
          );
        }
        ultimoAvisadoRef.current = marca;
      } catch {
        /* silencioso: apenas leitura de status */
      }
    },
    [lerStatus],
  );

  useEffect(() => {
    if (!isAdmin) return;
    void atualizarStatus(false);
    void carregarConta();

    const t = window.setInterval(() => void atualizarStatus(true), 60_000);
    return () => window.clearInterval(t);
  }, [isAdmin, atualizarStatus, carregarConta]);

  async function gravarAgendamento() {
    setSalvandoAgenda(true);
    try {
      await salvarAgendamento({ data: agenda });
      toast.success(
        agenda.ativo
          ? `Backup automático agendado para ${DIAS_SEMANA[agenda.dia_semana]?.rotulo} às ${String(agenda.hora).padStart(2, "0")}:${String(agenda.minuto).padStart(2, "0")}.`
          : "Backup automático desativado.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o agendamento.");
    } finally {
      setSalvandoAgenda(false);
    }
  }


  // Assina o estado global do backup: ao voltar para esta tela, o progresso aparece.
  useEffect(() => assinarBackup(setEstadoBackup), []);

  async function backupAgora() {
    if (estadoBackupAtual().executando) {
      toast.info("Já existe um backup em andamento.");
      return;
    }
    const checagem = await verificarPastas();
    if (!checagem || checagem.some((c) => !c.ok)) {
      toast.error("Corrija as pastas do Google Drive antes de rodar o backup.");
      return;
    }
    // O envio roda fora da tela: trocar de página não interrompe o backup.
    void executarBackupGlobal().then(() => void atualizarStatus(false));
  }

  const jaLiberado = liberado || (typeof sessionStorage !== "undefined" && sessionStorage.getItem(CHAVE_LIBERADO) === "1");

  if (isAdmin && !jaLiberado) {
    return <SenhaAdmin email={user?.email ?? ""} onLiberar={() => setLiberado(true)} />;
  }

  if (!isAdmin) {
    return (
      <AppShell title="Backup" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <ShieldAlert className="size-5 text-destructive" />
            Somente administradores podem acessar e executar o backup.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  async function reenviar(id: string) {
    setReenviando(id);
    try {
      const r = await reenviarFalhas({ data: { id } });
      if (r.falhas) toast.error(`${r.enviados} arquivo(s) reenviado(s); ${r.falhas} ainda com falha.`);
      else toast.success(`${r.enviados} arquivo(s) reenviado(s) com sucesso.`);
      await carregarHistorico();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reenviar");
    } finally {
      setReenviando(null);
    }
  }

  const pct = progresso && progresso.total > 0 ? Math.round((progresso.enviados / progresso.total) * 100) : 0;

  return (
    <AppShell title="Backup" subtitle="Envio da planilha e dos documentos para o Google Drive">
      <Tabs defaultValue="backup">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="backup">Backup e histórico</TabsTrigger>
          <TabsTrigger value="agenda">Agendamento</TabsTrigger>
          <TabsTrigger value="destino">Destino no Drive</TabsTrigger>
          <TabsTrigger value="restaurar">Restauração</TabsTrigger>
          <TabsTrigger value="links">Links e privacidade</TabsTrigger>
        </TabsList>
        <TabsContent value="backup">
      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CloudUpload className="size-4" /> Backup no Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O backup envia a planilha de alunos do dia (com todos os dados e o código de matrícula) e todas as fotos e
            documentos para as pastas configuradas no Google Drive. Cada arquivo recebe o nome no padrão
            CÓDIGO_TIPO.extensão, como A7B92K1_foto.jpg. Ele também roda sozinho no dia e horário definidos.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Último backup: </span>
              {ultimo?.ultimo_backup ? new Date(ultimo.ultimo_backup).toLocaleString("pt-BR") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Resultado: </span>
              {ultimo?.ultimo_resultado ?? "—"}
            </p>
          </div>

          {progresso ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span>{progresso.etapa}</span>
                <span className="tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <Progress value={progresso.total > 0 ? pct : undefined} />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {progresso.total > 0
                    ? `${progresso.enviados} de ${progresso.total} enviados · faltam ${progresso.total - progresso.enviados}`
                    : "Preparando arquivos…"}
                </span>
                <span>
                  Tempo estimado: {progresso.restante === null ? "calculando…" : formatarTempo(progresso.restante)}
                </span>
              </div>
              {progresso.falhas > 0 && (
                <p className="text-xs text-destructive">{progresso.falhas} arquivo(s) não puderam ser enviados.</p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={backupando || verificando} onClick={() => void backupAgora()}>
              <CloudUpload className="size-4" /> {backupando ? "Enviando..." : "Fazer Backup"}
            </Button>
            <Button variant="outline" disabled={verificando || backupando} onClick={() => void verificarPastas()}>
              <CheckCircle2 className="size-4" /> {verificando ? "Verificando..." : "Verificar pastas"}
            </Button>
            {backupando ? (
              <span className="text-xs text-muted-foreground">
                Você pode trocar de tela: o backup continua em segundo plano.
              </span>
            ) : null}
          </div>

          {checagens ? (
            <ul className="space-y-2 rounded-lg border border-border p-3 text-sm">
              {checagens.map((c) => (
                <li key={c.chave} className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span>
                    <strong>{c.rotulo}</strong>
                    {c.padrao ? " (padrão)" : ""}:{" "}
                    {c.ok ? `acessível — ${c.nome ?? c.id}` : (c.erro ?? "indisponível")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <History className="size-4" /> Histórico dos últimos 30 backups
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Data e hora</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Quem fez</th>
                <th className="py-2 pr-3 font-medium">Arquivos</th>
                <th className="py-2 pr-3 font-medium">Duração</th>
                <th className="py-2 pr-3 font-medium">Situação</th>
                <th className="py-2 pr-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{new Date(h.iniciado_em).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-3">{h.tipo === "automatico" ? "Automático" : "Manual"}</td>
                  <td className="py-2 pr-3">{h.usuario_nome ?? "—"}</td>
                  <td className="py-2 pr-3">{h.enviados}/{h.total}</td>
                  <td className="py-2 pr-3">{duracao(h.iniciado_em, h.concluido_em)}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={h.status === "sucesso" ? "secondary" : "destructive"}>
                      {h.status === "sucesso" ? "Sucesso" : "Com falhas"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {h.planilha_id ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={`https://drive.google.com/file/d/${h.planilha_id}/view`} target="_blank" rel="noopener noreferrer">Abrir planilha</a>
                        </Button>
                      ) : null}
                      {h.falhas.length ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setVendoFalhas(h)}>Ver falhas</Button>
                          <Button size="sm" disabled={reenviando === h.id} onClick={() => void reenviar(h.id)}>
                            {reenviando === h.id ? "Reenviando..." : "Reenviar arquivos com falha"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!historico.length && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum backup registrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!vendoFalhas} onOpenChange={(o) => !o && setVendoFalhas(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Arquivos que não subiram</DialogTitle></DialogHeader>
          <ul className="space-y-2 text-sm">
            {vendoFalhas?.falhas.map((f) => (
              <li key={f.caminho} className="rounded-lg border border-border/70 p-2">
                <p className="font-medium">{f.nome}</p>
                <p className="text-xs text-muted-foreground">{f.motivo}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="agenda">
      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CalendarClock className="size-4" /> Backup automático
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha o dia da semana e o horário (Brasília) em que o backup deve rodar sozinho. Ao terminar, você recebe
            uma notificação com o resultado — inclusive se algo falhar.
          </p>
          <div className="flex items-center gap-3">
            <Switch
              id="backup-ativo"
              checked={agenda.ativo}
              onCheckedChange={(v) => setAgenda((a) => ({ ...a, ativo: v }))}
            />
            <Label htmlFor="backup-ativo">Backup automático ativado</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select
                value={String(agenda.dia_semana)}
                onValueChange={(v) => setAgenda((a) => ({ ...a, dia_semana: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem key={d.valor} value={String(d.valor)}>
                      {d.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-hora">Horário</Label>
              <Input
                id="backup-hora"
                type="time"
                value={`${String(agenda.hora).padStart(2, "0")}:${String(agenda.minuto).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":");
                  setAgenda((a) => ({ ...a, hora: Number(h ?? 0) || 0, minuto: Number(m ?? 0) || 0 }));
                }}
              />
            </div>
          </div>
          <Button variant="secondary" disabled={salvandoAgenda} onClick={() => void gravarAgendamento()}>
            {salvandoAgenda ? "Salvando..." : "Salvar agendamento"}
          </Button>
        </CardContent>
      </Card>


        </TabsContent>
        <TabsContent value="destino">
      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <FolderCog className="size-4" /> Pastas de destino no Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cole o link (ou o ID) da pasta do Google Drive. Deixe em branco para usar as pastas padrão.
          </p>
          <div className="space-y-2">
            <Label htmlFor="pasta-planilha">Pasta da planilha</Label>
            <Input
              id="pasta-planilha"
              value={formPlanilhas}
              onChange={(e) => setFormPlanilhas(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pasta-imagens">Pasta das fotos dos alunos</Label>
            <Input
              id="pasta-imagens"
              value={formImagens}
              onChange={(e) => setFormImagens(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pasta-documentos">Pasta das imagens dos documentos</Label>
            <Input
              id="pasta-documentos"
              value={formDocumentos}
              onChange={(e) => setFormDocumentos(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <Button variant="secondary" disabled={salvandoPastas} onClick={() => void salvarPastas()}>
            {salvandoPastas ? "Salvando..." : "Salvar pastas"}
          </Button>
        </CardContent>
      </Card>
      <Card className="mt-4 max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <AtSign className="size-4" /> Conta Google do backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Email em uso: </span>
              {conta === null ? "—" : (conta.email ?? "não identificado")}
            </p>
            {conta?.nome ? (
              <p>
                <span className="text-muted-foreground">Conta: </span>
                {conta.nome}
              </p>
            ) : null}
            {conta?.erro ? <p className="text-destructive">{conta.erro}</p> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Para guardar os backups em outro email, é preciso trocar a conta Google conectada ao sistema. Peça essa
            troca ao responsável pelo aplicativo: a nova conta precisa entrar e autorizar o acesso ao Google Drive, e
            depois as pastas de destino acima devem ser atualizadas com pastas dessa conta.
          </p>
          <Button variant="outline" disabled={lendoConta} onClick={() => void verificarConta()}>
            <AtSign className="size-4" /> {lendoConta ? "Consultando..." : "Verificar conta conectada"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl">

        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <FolderTree className="size-4" /> Subpastas por tipo de documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Informe o nome da subpasta (dentro da pasta de documentos) para cada tipo. As subpastas são criadas
            automaticamente no backup. Em branco, o arquivo vai direto para a pasta de documentos.
          </p>
          {TIPOS_DOCUMENTO.map((tipo) => (
            <CampoSubpasta key={tipo.campo} campo={tipo.campo} rotulo={tipo.rotulo} padrao={tipo.padrao} />
          ))}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="restaurar">
          <RestaurarDrive />
        </TabsContent>
        <TabsContent value="links">
          <ValidadeLinks />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
