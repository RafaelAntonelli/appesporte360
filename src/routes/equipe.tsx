import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Lock, LockOpen, Search, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { listarEquipeFn, removerContaPendenteFn, type MembroEquipe } from "@/lib/equipe.functions";
import { bloquearPermissoesFn, desbloquearPermissoesFn } from "@/lib/permissoes-acesso.functions";
import { PERMISSOES } from "@/lib/permissoes";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { AcessosAlunos } from "@/components/AcessosAlunos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
  head: () => ({
    meta: [
      { title: "Equipe | Esporte 360" },
      { name: "description", content: "Controle quem da equipe pode acessar e o que os professores podem fazer." },
      { property: "og:title", content: "Equipe | Esporte 360" },
      { property: "og:description", content: "Gestão de acessos e permissões da equipe do Esporte 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Turma = { id: string; nome: string };
type Confirmacao =
  | { tipo: "papel"; membro: MembroEquipe; role: AppRole | null }
  | { tipo: "remover"; membro: MembroEquipe };

const ROTULO_PAPEL: Record<string, string> = { admin: "Administrador", professor: "Professor" };

function dataHora(v: string | null) {
  if (!v) return "nunca";
  const d = new Date(v);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function EquipePage() {
  const { isAdmin, loading, user } = useAuth();
  const listarEquipe = useServerFn(listarEquipeFn);
  const removerConta = useServerFn(removerContaPendenteFn);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [permissoes, setPermissoes] = useState<Record<string, boolean>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [vinculos, setVinculos] = useState<{ user_id: string; turma_id: string }[]>([]);
  const [turmasDe, setTurmasDe] = useState<MembroEquipe | null>(null);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const desbloquear = useServerFn(desbloquearPermissoesFn);
  const bloquearFn = useServerFn(bloquearPermissoesFn);
  const [aba, setAba] = useState("equipe");
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [liberadoAte, setLiberadoAte] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, p, t, v] = await Promise.all([
        listarEquipe(),
        supabase.from("permissoes_professor").select("chave,ativo"),
        supabase.from("turmas").select("id,nome").order("nome"),
        supabase.from("professor_turmas").select("user_id,turma_id"),
      ]);
      setMembros(lista);
      setPermissoes(Object.fromEntries((p.data ?? []).map((r) => [r.chave, r.ativo])));
      setTurmas((t.data ?? []) as Turma[]);
      setVinculos(v.data ?? []);
    } catch {
      setMembros([]);
      setErro("Não foi possível carregar os usuários e pedidos de liberação.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void carregar();
    else setCarregando(false);
  }, [isAdmin]);

  async function definirPapel(userId: string, role: AppRole | null) {
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) return void toast.error(del.error.message);
    if (role) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return void toast.error(error.message);
    }
    toast.success("Acesso atualizado");
    void carregar();
  }

  async function remover(m: MembroEquipe) {
    try {
      await removerConta({ data: { userId: m.id } });
      toast.success("Conta removida");
      void carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover a conta.");
    }
  }

  async function confirmarSenha() {
    setConferindo(true);
    setErroSenha(null);
    try {
      const r = await desbloquear({ data: { senha } });
      setLiberadoAte(r.validoAte);
      setSenha("");
    } catch (e) {
      setErroSenha(e instanceof Error ? e.message : "Não foi possível confirmar a senha.");
    } finally {
      setConferindo(false);
    }
  }

  async function bloquear(silencioso = false) {
    setLiberadoAte(null);
    setSenha("");
    await bloquearFn().catch(() => undefined);
    if (!silencioso) toast.success("Permissões bloqueadas.");
  }

  // Bloqueia sozinho quando o tempo termina e ao sair da tela.
  useEffect(() => {
    if (!liberadoAte) return;
    const t = window.setTimeout(() => {
      setLiberadoAte(null);
      toast.info("O tempo terminou. Digite a senha novamente para alterar as permissões.");
    }, Math.max(0, new Date(liberadoAte).getTime() - Date.now()));
    return () => window.clearTimeout(t);
  }, [liberadoAte]);

  const bloquearRef = useRef(bloquearFn);
  bloquearRef.current = bloquearFn;
  useEffect(() => () => void bloquearRef.current().catch(() => undefined), []);

  async function alternarPermissao(chave: string, ativo: boolean) {
    if (!liberadoAte || new Date(liberadoAte).getTime() <= Date.now()) {
      setLiberadoAte(null);
      return void toast.error("Digite a senha de administrador para alterar as permissões.");
    }
    setPermissoes((p) => ({ ...p, [chave]: ativo }));
    const { error } = await supabase
      .from("permissoes_professor")
      .upsert({ chave, ativo, updated_at: new Date().toISOString() });
    if (error) {
      setPermissoes((p) => ({ ...p, [chave]: !ativo }));
      toast.error("Não foi possível salvar a permissão. Confirme a senha novamente.");
      setLiberadoAte(null);
    } else toast.success(ativo ? "Permissão ligada" : "Permissão desligada");
  }

  function abrirTurmas(m: MembroEquipe) {
    setTurmasDe(m);
    setSelecao(new Set(vinculos.filter((v) => v.user_id === m.id).map((v) => v.turma_id)));
  }

  async function salvarTurmas() {
    if (!turmasDe) return;
    const atuais = new Set(vinculos.filter((v) => v.user_id === turmasDe.id).map((v) => v.turma_id));
    const remover = [...atuais].filter((id) => !selecao.has(id));
    const incluir = [...selecao].filter((id) => !atuais.has(id));
    if (remover.length) {
      const { error } = await supabase.from("professor_turmas").delete().eq("user_id", turmasDe.id).in("turma_id", remover);
      if (error) return void toast.error("Não foi possível salvar as turmas.");
    }
    if (incluir.length) {
      const { error } = await supabase
        .from("professor_turmas")
        .insert(incluir.map((turma_id) => ({ user_id: turmasDe.id, turma_id })));
      if (error) return void toast.error("Não foi possível salvar as turmas.");
    }
    toast.success("Turmas do professor atualizadas");
    setTurmasDe(null);
    void carregar();
  }

  const filtrados = useMemo(() => {
    const b = normalizar(busca.trim());
    return membros.filter((m) => !b || normalizar(`${m.nome ?? ""} ${m.email ?? ""}`).includes(b));
  }, [membros, busca]);

  const grupos = [
    { titulo: "Administradores", lista: filtrados.filter((m) => m.roles.includes("admin")) },
    { titulo: "Professores", lista: filtrados.filter((m) => !m.roles.includes("admin") && m.roles.includes("professor")) },
    { titulo: "Aguardando liberação", lista: filtrados.filter((m) => m.roles.length === 0) },
  ];

  if (loading) return null;

  function cartao(m: MembroEquipe) {
    const pendente = m.roles.length === 0;
    const ehProfessor = m.roles.includes("professor") && !m.roles.includes("admin");
    const qtdTurmas = vinculos.filter((v) => v.user_id === m.id).length;
    return (
      <Card key={m.id}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">{m.nome || m.email || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{m.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastro em {dataHora(m.criadoEm)} · Último acesso {dataHora(m.ultimoAcesso)}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {pendente ? (
                <Badge variant="outline">Sem acesso</Badge>
              ) : (
                m.roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {ROTULO_PAPEL[r]}
                  </Badge>
                ))
              )}
              {ehProfessor ? <Badge variant="outline">{qtdTurmas} turma(s)</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ehProfessor ? (
              <Button size="sm" variant="outline" onClick={() => abrirTurmas(m)}>
                <BookOpen className="mr-1 size-4" /> Turmas
              </Button>
            ) : null}
            {!m.roles.includes("professor") || m.roles.includes("admin") ? (
              <Button size="sm" variant="outline" disabled={m.id === user?.id} onClick={() => setConfirmacao({ tipo: "papel", membro: m, role: "professor" })}>
                <UserCheck className="mr-1 size-4" /> Professor
              </Button>
            ) : null}
            {!m.roles.includes("admin") ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmacao({ tipo: "papel", membro: m, role: "admin" })}>
                <ShieldCheck className="mr-1 size-4" /> Administrador
              </Button>
            ) : null}
            {pendente ? (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmacao({ tipo: "remover", membro: m })}>
                <Trash2 className="mr-1 size-4" /> Remover
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={m.id === user?.id} onClick={() => setConfirmacao({ tipo: "papel", membro: m, role: null })}>
                <UserX className="mr-1 size-4" /> Tirar acesso
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const nomeConf = confirmacao ? confirmacao.membro.nome || confirmacao.membro.email || "esta conta" : "";

  return (
    <AppShell title="Equipe" subtitle="Defina quem pode acessar os dados do sistema">
      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Apenas administradores podem gerenciar os acessos da equipe.
          </CardContent>
        </Card>
      ) : carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : erro ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground">
            <p>{erro}</p>
            <Button size="sm" variant="outline" onClick={() => void carregar()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={aba}
          onValueChange={(v) => {
            if (aba === "permissoes" && v !== "permissoes" && liberadoAte) void bloquear(true);
            setAba(v);
          }}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="permissoes">Permissões dos professores</TabsTrigger>
            <TabsTrigger value="alunos">Acessos dos alunos</TabsTrigger>
          </TabsList>

          <TabsContent value="alunos">
            <AcessosAlunos />
          </TabsContent>

          <TabsContent value="equipe" className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou email" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {grupos.map((g) => (
              <section key={g.titulo} className="space-y-3">
                <h2 className="font-display text-base font-semibold text-foreground">
                  {g.titulo} <span className="text-sm font-normal text-muted-foreground">({g.lista.length})</span>
                </h2>
                {g.lista.length ? (
                  <div className="grid gap-3">{g.lista.map(cartao)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguém neste grupo.</p>
                )}
              </section>
            ))}
          </TabsContent>

          <TabsContent value="permissoes">
            {!liberadoAte ? (
              <Card className="max-w-md">
                <CardContent className="p-6">
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void confirmarSenha();
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 size-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Área protegida</p>
                        <p className="text-sm text-muted-foreground">
                          Digite a sua senha de administrador para ver e alterar as permissões dos professores.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senha-permissoes">Senha do administrador</Label>
                      <Input
                        id="senha-permissoes"
                        type="password"
                        autoComplete="current-password"
                        value={senha}
                        onChange={(e) => {
                          setSenha(e.target.value);
                          setErroSenha(null);
                        }}
                        aria-invalid={!!erroSenha}
                      />
                      {erroSenha ? (
                        <p role="alert" className="text-sm text-destructive">
                          {erroSenha}
                        </p>
                      ) : null}
                    </div>
                    <Button type="submit" disabled={!senha || conferindo}>
                      {conferindo ? "Conferindo…" : "Liberar acesso"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LockOpen className="size-4 text-primary" /> Liberado até{" "}
                      {new Date(liberadoAte).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void bloquear()}>
                      <Lock className="mr-1 size-4" /> Bloquear agora
                    </Button>
                  </div>
                  {PERMISSOES.map((p) => (
                    <label key={p.chave} className="flex cursor-pointer items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-medium text-foreground">{p.rotulo}</p>
                        <p className="text-xs text-muted-foreground">{p.descricao}</p>
                      </div>
                      <Switch checked={permissoes[p.chave] === true} onCheckedChange={(v) => void alternarPermissao(p.chave, v)} />
                    </label>
                  ))}
                  <p className="p-4 text-xs text-muted-foreground">
                    Excluir alunos, Backup e Equipe são sempre exclusivos dos administradores.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!confirmacao} onOpenChange={(o) => !o && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === "remover" ? "Remover conta?" : "Alterar acesso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === "remover"
                ? `A conta de ${nomeConf} será apagada. Essa pessoa precisará se cadastrar de novo para pedir acesso.`
                : confirmacao?.role
                  ? `${nomeConf} passará a ser ${ROTULO_PAPEL[confirmacao.role]}.`
                  : `${nomeConf} perderá o acesso aos dados do sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const c = confirmacao;
                setConfirmacao(null);
                if (!c) return;
                if (c.tipo === "remover") void remover(c.membro);
                else void definirPapel(c.membro.id, c.role);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!turmasDe} onOpenChange={(o) => !o && setTurmasDe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turmas de {turmasDe?.nome || turmasDe?.email}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {turmas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selecao.has(t.id)}
                  onCheckedChange={(v) =>
                    setSelecao((s) => {
                      const n = new Set(s);
                      if (v) n.add(t.id);
                      else n.delete(t.id);
                      return n;
                    })
                  }
                />
                {t.nome}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTurmasDe(null)}>Cancelar</Button>
            <Button onClick={() => void salvarTurmas()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
