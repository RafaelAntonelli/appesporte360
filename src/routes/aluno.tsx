import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Camera, CheckCheck, Download, FileText, ImageIcon, KeyRound, LogOut, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  atualizarContatoAlunoFn,
  configNotificacoesAlunoFn,
  enviarFotoAlunoFn,
  marcarAvisoLidoFn,
  meusDadosAlunoFn,
  preferenciasAcessoAlunoFn,
  registrarNotificacoesAlunoFn,
  sairAlunoFn,
  statusAparelhoFn,
  type AvisoDoAluno,
  type DadosAreaAluno,
  type TurmaDoAluno,
} from "@/lib/aluno.functions";
import { FOTO_TIPOS, validarEmail, validarFoto, validarTelefone } from "@/lib/aluno-acesso";
import { consentimentoLocal, salvarConsentimentoLocal, tokenLocal } from "@/lib/aluno-local";
import { obterTokenNotificacao } from "@/lib/push-aluno";
import { formatarCelular } from "@/lib/formatacao";
import { gerarCrachaPreviewImagem, gerarCrachasPdfFielAoPreview, type DadosCracha } from "@/lib/cracha";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/aluno")({
  component: AreaAluno,
  head: () => ({
    meta: [
      { title: "Área do aluno | Esporte 360" },
      { name: "description", content: "Turmas, crachá digital e avisos do aluno do Programa Esporte 360." },
      { property: "og:title", content: "Área do aluno | Esporte 360" },
      { property: "og:description", content: "Suas turmas, seu crachá e os avisos do Esporte 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DIAS: Record<string, string> = { dom: "Domingo", seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", sáb: "Sábado" };
const nomeDia = (d: string) => DIAS[d.trim().slice(0, 3).toLowerCase()] ?? d;
const hojeAbrev = () => ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][new Date().getDay()]!;
const temAulaHoje = (t: TurmaDoAluno) => t.dias.some((d) => d.trim().slice(0, 3).toLowerCase().replace("á", "a") === hojeAbrev());

function dataBR(iso: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
function quando(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

const ATESTADO = {
  valido: { rotulo: "Válido", classe: "bg-secondary text-secondary-foreground" },
  vencendo: { rotulo: "Vencendo", classe: "bg-accent text-accent-foreground" },
  vencido: { rotulo: "Vencido", classe: "bg-destructive text-destructive-foreground" },
  nao_entregue: { rotulo: "Não entregue", classe: "bg-muted text-muted-foreground" },
} as const;

function AreaAluno() {
  const navigate = useNavigate();
  const carregarFn = useServerFn(meusDadosAlunoFn);
  const statusFn = useServerFn(statusAparelhoFn);
  const preferenciasFn = useServerFn(preferenciasAcessoAlunoFn);
  const sairFn = useServerFn(sairAlunoFn);
  const lidoFn = useServerFn(marcarAvisoLidoFn);
  const configFn = useServerFn(configNotificacoesAlunoFn);
  const registrarPushFn = useServerFn(registrarNotificacoesAlunoFn);
  const [dados, setDados] = useState<DadosAreaAluno | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState("dia");
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [consentAberto, setConsentAberto] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const conhecidos = useRef<Set<string> | null>(null);

  async function carregar(silencioso = false) {
    try {
      const d = await carregarFn({ data: { token: tokenLocal() } });
      if (conhecidos.current) {
        const novos = d.avisos.filter((a) => !conhecidos.current!.has(a.id) && !a.lido);
        for (const n of novos.slice(0, 3)) toast.info(n.titulo, { description: n.mensagem.slice(0, 140) });
      }
      conhecidos.current = new Set(d.avisos.map((a) => a.id));
      setDados(d);
      setErro(null);
      if (!silencioso && !d.aparelho.consentimento && consentimentoLocal() === null) setConsentAberto(true);
    } catch {
      const s = await statusFn({ data: { token: tokenLocal() } }).catch(() => null);
      if (!s?.sessaoAtiva) return void navigate({ href: "/auth?aba=aluno" });
      if (!silencioso) setErro("Não foi possível carregar seus dados. Verifique a internet e tente novamente.");
    }
  }

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(true), 30_000);
    const aoMensagem = (e: MessageEvent) => {
      if ((e.data as { tipo?: string } | null)?.tipo === "aviso-aluno") void carregar(true);
    };
    navigator.serviceWorker?.addEventListener("message", aoMensagem);
    return () => {
      clearInterval(t);
      navigator.serviceWorker?.removeEventListener("message", aoMensagem);
    };
  }, []);

  async function responderConsentimento(aceito: boolean) {
    salvarConsentimentoLocal(aceito ? "sim" : "nao");
    setConsentAberto(false);
    const salvarJunto = aceito && salvarAposConsentir.current;
    salvarAposConsentir.current = false;
    try {
      await preferenciasFn({ data: { token: tokenLocal(), consentimento: aceito, ...(salvarJunto ? { salvarLogin: true } : {}) } });
      setDados((d) =>
        d ? { ...d, aparelho: { ...d.aparelho, consentimento: aceito, loginSalvo: salvarJunto ? true : aceito ? d.aparelho.loginSalvo : false } } : d,
      );
      toast.success(
        salvarJunto
          ? "Login salvo neste aparelho. Na próxima vez, você entra direto."
          : aceito
            ? "Pronto! Você pode salvar o login neste aparelho."
            : "Tudo bem. Seus dados de acesso não ficarão salvos.",
      );
    } catch {
      toast.error("Não foi possível registrar sua resposta.");
    }
  }

  async function salvarLogin() {
    if (!dados?.aparelho.consentimento) {
      salvarAposConsentir.current = true;
      return setConsentAberto(true);
    }
    try {
      await preferenciasFn({ data: { token: tokenLocal(), salvarLogin: true } });
      setDados((d) => (d ? { ...d, aparelho: { ...d.aparelho, loginSalvo: true } } : d));
      toast.success("Login salvo neste aparelho. Na próxima vez, você entra direto.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o login.");
    }
  }

  async function sair() {
    await sairFn({ data: { token: tokenLocal() } }).catch(() => undefined);
    navigate({ href: "/auth?aba=aluno", replace: true });
  }

  async function marcarLidos(ids: string[]) {
    if (!ids.length) return;
    setDados((d) => (d ? { ...d, avisos: d.avisos.map((a) => (ids.includes(a.id) ? { ...a, lido: true } : a)) } : d));
    await lidoFn({ data: { token: tokenLocal(), avisoIds: ids } }).catch(() => toast.error("Não foi possível marcar como lido."));
  }

  async function ativarNotificacoes() {
    setAtivando(true);
    try {
      const config = await configFn({ data: { token: tokenLocal() } });
      if (!config) {
        toast.error("As notificações no celular ainda não foram configuradas pela administração.");
        return;
      }
      const fcm = await obterTokenNotificacao(config);
      await registrarPushFn({ data: { token: tokenLocal(), fcmToken: fcm } });
      toast.success("Notificações ativadas neste celular.");
      void carregar(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar as notificações.");
    } finally {
      setAtivando(false);
    }
  }

  if (erro && !dados) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">{erro}</p>
        <Button onClick={() => void carregar()}>Tentar novamente</Button>
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <img src="/icons/icon-192x192.png" alt="Esporte 360" className="size-12 animate-pulse rounded-xl" />
      </div>
    );
  }

  const { aluno } = dados;
  const naoLidos = dados.avisos.filter((a) => !a.lido);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-10">
      <header className="bg-primary px-4 pb-6 pt-5 text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/icons/icon-192x192.png" alt="" className="size-7 rounded-lg" />
            <span className="truncate font-display text-sm font-semibold">Esporte 360</span>
          </div>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => void sair()}>
            <LogOut className="mr-1 size-4" /> Sair
          </Button>
        </div>
        <div className="mx-auto mt-4 flex max-w-lg items-center gap-4">
          {aluno.fotoUrl ? (
            <img src={aluno.fotoUrl} alt={aluno.nome} className="size-20 shrink-0 rounded-2xl border-2 border-primary-foreground/40 object-cover" />
          ) : (
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl border-2 border-primary-foreground/40 bg-primary-foreground/10">
              <UserRound className="size-9" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="break-words font-display text-xl font-semibold leading-tight">{aluno.nome}</h1>
            <p className="mt-1 text-xs uppercase tracking-wide text-primary-foreground/70">Matrícula</p>
            <p className="font-mono text-2xl font-bold tracking-widest">{aluno.codigo}</p>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-lg flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPerfilAberto(true)}>
            <UserRound className="mr-1 size-4" /> Acessar meu perfil
          </Button>
          {!dados.aparelho.loginSalvo ? (
            <Button size="sm" variant="secondary" onClick={() => void salvarLogin()}>
              <KeyRound className="mr-1 size-4" /> Salvar login neste aparelho
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4">
        {naoLidos.length ? (
          <button
            type="button"
            onClick={() => setAba("avisos")}
            className="mt-4 flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-secondary px-4 py-3 text-left text-sm font-medium text-secondary-foreground"
          >
            <BellRing className="size-4 shrink-0" />
            Você tem {naoLidos.length} {naoLidos.length === 1 ? "aviso novo" : "avisos novos"}
          </button>
        ) : null}

        <Tabs value={aba} onValueChange={setAba} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dia">Meu dia</TabsTrigger>
            <TabsTrigger value="cracha">Crachá</TabsTrigger>
            <TabsTrigger value="avisos" className="gap-1">
              Avisos
              {naoLidos.length ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-5 text-destructive-foreground">
                  {naoLidos.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dia" className="space-y-3 pt-2">
            <h2 className="font-display text-base font-semibold text-foreground">Minhas turmas</h2>
            {dados.turmas.length ? (
              dados.turmas.map((t) => (
                <Card key={t.id}>
                  <CardContent className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg font-semibold text-foreground">{t.modalidade}</p>
                      {temAulaHoje(t) ? <Badge>Aula hoje</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{t.dias.map(nomeDia).join(" e ") || "Dias a definir"}</p>
                    <p className="text-sm font-medium text-foreground">{t.horario ?? "Horário a definir"}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Você ainda não está em nenhuma turma.</p>
            )}

            <h2 className="pt-2 font-display text-base font-semibold text-foreground">Atestado médico</h2>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 text-sm">
                  <p className="text-foreground">Situação do atestado</p>
                  <p className="text-xs text-muted-foreground">
                    {dados.atestado.venceEm
                      ? `${dados.atestado.situacao === "vencido" ? "Venceu em" : "Vence em"} ${dataBR(dados.atestado.venceEm)}`
                      : "Entregue o atestado na administração."}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${ATESTADO[dados.atestado.situacao].classe}`}>
                  {ATESTADO[dados.atestado.situacao].rotulo}
                </span>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cracha" className="pt-2">
            <CrachaDigital dados={dados} />
          </TabsContent>

          <TabsContent value="avisos" className="space-y-3 pt-2">
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Bell className="size-4" /> Receba os avisos no celular
                </p>
                <p className="text-xs text-muted-foreground">
                  {dados.aparelho.notificacoesAtivas
                    ? "As notificações estão ativas neste celular."
                    : "Ative para receber uma notificação sempre que a administração enviar um aviso."}
                </p>
                <Button size="sm" variant={dados.aparelho.notificacoesAtivas ? "outline" : "default"} disabled={ativando} onClick={() => void ativarNotificacoes()}>
                  {ativando ? "Ativando…" : dados.aparelho.notificacoesAtivas ? "Ativar novamente" : "Ativar notificações"}
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">Avisos recebidos</h2>
              {naoLidos.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => void marcarLidos(naoLidos.map((a) => a.id))}>
                  <CheckCheck className="mr-1 size-4" /> Marcar todos
                </Button>
              ) : null}
            </div>
            {dados.avisos.length ? (
              dados.avisos.map((a) => <ItemAviso key={a.id} aviso={a} aoLer={() => void marcarLidos([a.id])} />)
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <PerfilDoAluno aberto={perfilAberto} aoFechar={() => setPerfilAberto(false)} dados={dados} aoSalvar={() => void carregar(true)} />

      <Dialog open={consentAberto} onOpenChange={setConsentAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar seus dados de acesso?</DialogTitle>
            <DialogDescription>
              Se aceitar, este aparelho poderá guardar seu acesso para você não precisar digitar o CPF ou a matrícula e a
              data de nascimento toda vez. Você pode sair a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => void responderConsentimento(false)}>Agora não</Button>
            <Button onClick={() => void responderConsentimento(true)}>Aceito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemAviso({ aviso, aoLer }: { aviso: AvisoDoAluno; aoLer: () => void }) {
  return (
    <Card className={aviso.lido ? "" : "border-primary/40"}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-start gap-2">
          {!aviso.lido ? <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Não lido" /> : null}
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium text-foreground">{aviso.titulo}</p>
            <p className="text-xs text-muted-foreground">{quando(aviso.criadoEm)}{aviso.paraTodos ? " · para todos" : ""}</p>
          </div>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{aviso.mensagem}</p>
        {!aviso.lido ? (
          <Button size="sm" variant="ghost" className="px-0 text-primary" onClick={aoLer}>
            Marcar como lido
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CrachaDigital({ dados }: { dados: DadosAreaAluno }) {
  const [turmaId, setTurmaId] = useState(dados.turmas[0]?.id ?? "");
  const [imagem, setImagem] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const turma = dados.turmas.find((t) => t.id === turmaId) ?? dados.turmas[0];
  const cracha: DadosCracha = {
    nome: dados.aluno.nome,
    rg: dados.aluno.rg,
    cpf: dados.aluno.cpf,
    responsavel: dados.aluno.responsavel,
    telefone: dados.aluno.telefone,
    pcd: dados.aluno.pcd,
    modalidade: turma?.modalidade ?? "",
    horario: turma?.horario ?? "",
    dias: turma?.dias ?? [],
    fotoUrl: dados.aluno.fotoUrl,
    codigo: dados.aluno.codigo,
  };
  const chave = `${turmaId}|${dados.aluno.fotoUrl ?? ""}|${dados.aluno.telefone ?? ""}`;

  useEffect(() => {
    let vivo = true;
    setImagem(null);
    void gerarCrachaPreviewImagem(cracha)
      .then((url) => vivo && setImagem(url))
      .catch(() => vivo && toast.error("Não foi possível montar o crachá."));
    return () => {
      vivo = false;
    };
  }, [chave]);

  const nomeArquivo = `cracha-${dados.aluno.nome.toLowerCase().replace(/\s+/g, "-")}`;

  function baixarImagem() {
    if (!imagem) return;
    const a = document.createElement("a");
    a.href = imagem;
    a.download = `${nomeArquivo}.png`;
    a.click();
  }

  async function baixarPdf() {
    setGerando(true);
    try {
      await gerarCrachasPdfFielAoPreview([cracha], nomeArquivo, { formato: "cartao" });
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-3">
      {dados.turmas.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {dados.turmas.map((t) => (
            <Button key={t.id} size="sm" variant={t.id === turmaId ? "default" : "outline"} onClick={() => setTurmaId(t.id)}>
              {t.modalidade}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {imagem ? (
          <img src={imagem} alt={`Crachá de ${dados.aluno.nome}`} className="block h-auto w-full" />
        ) : (
          <div className="grid aspect-[1920/1209] w-full place-items-center text-sm text-muted-foreground">Montando crachá…</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">O QR Code do crachá é usado para registrar sua presença.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={!imagem} onClick={baixarImagem}>
          <Download className="mr-1 size-4" /> Gerar crachá
        </Button>
        <Button disabled={!imagem || gerando} onClick={() => void baixarPdf()}>
          <FileText className="mr-1 size-4" /> {gerando ? "Gerando…" : "Gerar PDF"}
        </Button>
      </div>
    </div>
  );
}

function PerfilDoAluno({ aberto, aoFechar, dados, aoSalvar }: { aberto: boolean; aoFechar: () => void; dados: DadosAreaAluno; aoSalvar: () => void }) {
  const salvarFn = useServerFn(atualizarContatoAlunoFn);
  const fotoFn = useServerFn(enviarFotoAlunoFn);
  const [telefone, setTelefone] = useState("");
  const [telefone2, setTelefone2] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setTelefone(dados.aluno.telefone ?? "");
    setTelefone2(dados.aluno.telefone2 ?? "");
    setEmail(dados.aluno.email ?? "");
  }, [aberto]);

  async function salvar() {
    if (!validarTelefone(telefone) || !validarTelefone(telefone2)) return void toast.error("Telefone inválido. Use DDD + número.");
    if (!validarEmail(email)) return void toast.error("E-mail inválido.");
    setSalvando(true);
    try {
      await salvarFn({ data: { token: tokenLocal(), telefone, telefone2, email } });
      toast.success("Dados atualizados.");
      aoSalvar();
      aoFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    const erro = validarFoto(arquivo.size, arquivo.type);
    if (erro) return void toast.error(erro);
    setEnviandoFoto(true);
    try {
      const fd = new FormData();
      fd.append("foto", arquivo);
      const t = tokenLocal();
      if (t) fd.append("token", t);
      await fotoFn({ data: fd });
      toast.success("Foto atualizada.");
      aoSalvar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(false);
      if (camera.current) camera.current.value = "";
      if (galeria.current) galeria.current.value = "";
    }
  }

  const a = dados.aluno;
  const fixos: [string, string | null][] = [
    ["Nome", a.nome],
    ["Data de nascimento", dataBR(a.dataNascimento)],
    ["Matrícula", a.codigo],
    ["CPF", a.cpf],
    ["RG", a.rg],
    ["Responsável", a.responsavel],
    ["Escola", a.escola],
  ];

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>Você pode alterar telefone, segundo telefone, e-mail e foto.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          {a.fotoUrl ? (
            <img src={a.fotoUrl} alt={a.nome} className="size-20 rounded-xl object-cover" />
          ) : (
            <div className="grid size-20 place-items-center rounded-xl bg-muted">
              <UserRound className="size-8 text-muted-foreground" />
            </div>
          )}
          <div className="grid flex-1 gap-2">
            <Button size="sm" variant="outline" disabled={enviandoFoto} onClick={() => camera.current?.click()}>
              <Camera className="mr-1 size-4" /> Tirar foto
            </Button>
            <Button size="sm" variant="outline" disabled={enviandoFoto} onClick={() => galeria.current?.click()}>
              <ImageIcon className="mr-1 size-4" /> Escolher da galeria
            </Button>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void enviarFoto(e.target.files?.[0])} />
          <input ref={galeria} type="file" accept={FOTO_TIPOS.join(",")} className="hidden" onChange={(e) => void enviarFoto(e.target.files?.[0])} />
        </div>
        <p className="text-xs text-muted-foreground">{enviandoFoto ? "Enviando foto…" : "JPG, PNG ou WebP de até 5 MB."}</p>

        <dl className="grid gap-2 rounded-lg bg-muted p-3 text-sm">
          {fixos.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="min-w-0 break-words text-right font-medium text-foreground">{valor || "—"}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="perfil-tel">Telefone</Label>
            <Input id="perfil-tel" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(formatarCelular(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="perfil-tel2">Segundo telefone</Label>
            <Input id="perfil-tel2" inputMode="numeric" value={telefone2} onChange={(e) => setTelefone2(formatarCelular(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="perfil-email">E-mail</Label>
            <Input id="perfil-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={salvando} onClick={() => void salvar()}>
            <Save className="mr-1 size-4" /> {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
