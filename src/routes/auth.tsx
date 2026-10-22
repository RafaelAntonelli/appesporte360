import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import fundoComputador from "@/assets/fundo-ondas-computador.jpg.asset.json";
import fundoCelular from "@/assets/fundo-ondas-celular.jpg.asset.json";
import logoEsporte from "@/assets/logo-esporte-360.png.asset.json";
import seloSeculje from "@/assets/selo-seculje.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";
import { tokenLocal } from "@/lib/aluno-local";
import { AcessoAluno } from "@/components/AcessoAluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar | Esporte 360" },
      { name: "description", content: "Acesso da equipe do Esporte 360 ao sistema de matrículas e presença." },
      { property: "og:title", content: "Entrar | Esporte 360" },
      { property: "og:description", content: "Acesso da equipe ao sistema de matrículas e presença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function traduzirErro(err: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sem conexão com a internet. Verifique sua rede.";
  const e = err as { message?: string; code?: string; status?: number } | null;
  const m = (e?.message ?? "").toLowerCase();
  const c = (e?.code ?? "").toLowerCase();
  if (c === "invalid_credentials" || m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (c === "email_not_confirmed" || m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (c === "user_already_exists" || c === "email_exists" || m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já está cadastrado. Use a opção Entrar.";
  if (c === "weak_password" && (m.includes("pwned") || m.includes("leak") || m.includes("known"))) return "Esta senha é fraca ou já vazou na internet. Escolha outra.";
  if (m.includes("at least 6") || m.includes("should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (c === "weak_password" || m.includes("pwned") || m.includes("weak")) return "Esta senha é fraca ou já vazou na internet. Escolha outra.";
  if (c.includes("rate_limit") || e?.status === 429 || m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (c === "email_address_invalid" || c === "validation_failed" || m.includes("invalid email") || m.includes("is invalid")) return "E-mail inválido.";
  if (c === "same_password" || m.includes("different from the old")) return "A nova senha deve ser diferente da anterior.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com a internet. Verifique sua rede.";
  return "Não foi possível concluir. Tente novamente.";
}

function CampoSenha({ id, value, onChange, minLength }: { id: string; value: string; onChange: (v: string) => void; minLength?: number }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={ver ? "text" : "password"} required minLength={minLength} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** "Lembrar meu e-mail": guarda só o e-mail no aparelho, nunca a senha. */
const CHAVE_EMAIL = "esporte360_email_lembrado";

function emailLembrado() {
  try {
    return localStorage.getItem(CHAVE_EMAIL) ?? "";
  } catch {
    return "";
  }
}

function guardarEmail(valor: string | null) {
  try {
    if (valor) localStorage.setItem(CHAVE_EMAIL, valor.trim());
    else localStorage.removeItem(CHAVE_EMAIL);
  } catch {
    /* aparelho sem armazenamento */
  }
}

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<"entrar" | "criar" | "criada">("entrar");
  const [recuperando, setRecuperando] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [redefinindo, setRedefinindo] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [online, setOnline] = useState(true);
  const [aba, setAba] = useState<"equipe" | "aluno">("equipe");
  const [lembrarEmail, setLembrarEmail] = useState(false);

  useEffect(() => {
    const salvo = emailLembrado();
    if (salvo) {
      setEmail(salvo);
      setLembrarEmail(true);
    }
  }, []);

  useEffect(() => {
    const pedeAluno = new URLSearchParams(window.location.search).get("aba") === "aluno";
    if (pedeAluno || tokenLocal()) setAba("aluno");
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRedefinindo(true);
    });
    if (typeof window !== "undefined" && /type=recovery/.test(window.location.hash)) setRedefinindo(true);
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && session && !redefinindo) navigate({ to: "/" });
  }, [loading, session, navigate, redefinindo]);

  async function enviarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacao, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) return void toast.error(traduzirErro(error));
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
    setRecuperando(false);
  }

  async function definirNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setBusy(false);
    if (error) return void toast.error(traduzirErro(error));
    toast.success("Senha alterada com sucesso!");
    setRedefinindo(false);
    setNovaSenha("");
    navigate({ to: "/" });
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) return void toast.error(traduzirErro(error));
      guardarEmail(lembrarEmail ? email : null);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setBusy(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return void toast.error("A senha deve ter pelo menos 6 caracteres.");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin, data: { nome } },
      });
      if (error) return void toast.error(traduzirErro(error));
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return void toast.error("Este e-mail já está cadastrado. Use a opção Entrar.");
      }
      if (!data.session) {
        setModo("criada");
        return;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setBusy(false);
    }
  }

  const bloqueado = busy || !online;
  const titulo = redefinindo
    ? "Nova senha"
    : recuperando
      ? "Recuperar senha"
      : modo !== "entrar"
        ? "Cadastro da equipe"
        : aba === "aluno"
          ? "Área do aluno"
          : "Bem-vindo(a) de volta";
  const descricao = redefinindo
    ? "Defina uma nova senha para a sua conta."
    : recuperando
      ? "Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
      : modo !== "entrar"
        ? "Crie sua conta. Um administrador precisará liberar seu acesso."
        : aba === "aluno"
          ? "Consulte suas aulas, sua frequência e seu crachá."
          : "Entre para gerenciar alunos, turmas e presenças.";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Fundo de ondas: em pé no celular, deitado a partir de 768 px */}
      <picture aria-hidden className="pointer-events-none fixed inset-0">
        <source media="(min-width: 768px)" srcSet={fundoComputador.url} />
        <img src={fundoCelular.url} alt="" className="h-full w-full object-cover object-center" />
      </picture>
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-veu-login" />

      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
        <div className="relative flex w-full max-w-md flex-col items-center gap-4 sm:gap-5">
          {/* Brilho suave atrás da área de login */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(40rem,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-destaque/20 blur-3xl" />

          {/* Logos lado a lado */}
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <img
              src={logoEsporte.url}
              alt="Programa Esporte 360"
              className="sombra-logo w-auto shrink-0 object-contain"
              style={{ height: "min(clamp(48px, 10vh, 104px), 12.5vw)" }}
            />
            <span aria-hidden className="w-px shrink-0 self-stretch bg-sidebar-foreground/40" />
            <img
              src={seloSeculje.url}
              alt="SECULJE – Prefeitura de Lauro de Freitas"
              className="w-auto shrink-0 object-contain"
              style={{ height: "min(clamp(43px, 9vh, 92px), 11vw)" }}
            />
          </div>

          {/* Área de login */}
          <div className="w-full overflow-hidden rounded-3xl bg-card text-card-foreground shadow-2xl">
            <div aria-hidden className="h-1.5 w-full bg-faixa-login" />
            <div className="space-y-4 p-5 sm:p-7">
              <div className="space-y-1">
                <p className="font-display text-[32px] font-extrabold leading-none tracking-tight text-primary">
                  Esporte <span className="text-destaque">360</span>
                </p>
                <h1 className="pt-1 font-display text-lg font-semibold text-foreground">{titulo}</h1>
                <p className="text-sm text-muted-foreground">{descricao}</p>
              </div>

              {!online ? (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <WifiOff className="mt-0.5 size-4 shrink-0" />
                  <span>Você está sem internet. É preciso estar conectado para entrar no sistema.</span>
                </div>
              ) : null}

              {redefinindo ? (
                <form onSubmit={definirNovaSenha} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nova-senha">Nova senha</Label>
                    <CampoSenha id="nova-senha" minLength={6} value={novaSenha} onChange={setNovaSenha} />
                  </div>
                  <Button type="submit" className="h-11 w-full text-base" disabled={bloqueado}>Salvar nova senha</Button>
                </form>
              ) : recuperando ? (
                <form onSubmit={enviarRecuperacao} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-recuperacao">E-mail</Label>
                    <Input id="email-recuperacao" type="email" required value={emailRecuperacao} onChange={(e) => setEmailRecuperacao(e.target.value)} />
                  </div>
                  <Button type="submit" className="h-11 w-full text-base" disabled={bloqueado}>Enviar link de recuperação</Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setRecuperando(false)}>
                    Voltar para o login
                  </Button>
                </form>
              ) : modo === "criada" ? (
                <div className="space-y-4">
                  <p className="rounded-md bg-muted p-3 text-sm">
                    Conta criada! Confirme seu e-mail pelo link que enviamos. Depois, aguarde um administrador liberar seu acesso.
                  </p>
                  <Button className="w-full" onClick={() => { setSenha(""); setModo("entrar"); }}>Voltar para o login</Button>
                </div>
              ) : modo === "criar" ? (
                <form onSubmit={cadastrar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">E-mail</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha2">Senha</Label>
                    <CampoSenha id="senha2" minLength={6} value={senha} onChange={setSenha} />
                  </div>
                  <Button type="submit" className="h-11 w-full text-base" disabled={bloqueado}>Criar conta</Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setModo("entrar")}>
                    Voltar para o login
                  </Button>
                </form>
              ) : (
                <Tabs value={aba} onValueChange={(v) => setAba(v as "equipe" | "aluno")}>
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted p-1">
                    <TabsTrigger value="equipe" className={ABA}>Equipe</TabsTrigger>
                    <TabsTrigger value="aluno" className={ABA}>Aluno</TabsTrigger>
                  </TabsList>
                  <TabsContent value="aluno" className="pt-2">
                    <AcessoAluno bloqueado={!online} />
                  </TabsContent>
                  <TabsContent value="equipe" className="pt-2">
                    <form onSubmit={entrar} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="senha">Senha</Label>
                        <CampoSenha id="senha" value={senha} onChange={setSenha} />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <label htmlFor="lembrar-email" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox id="lembrar-email" checked={lembrarEmail} onCheckedChange={(v) => setLembrarEmail(v === true)} />
                          Lembrar meu e-mail
                        </label>
                        <button
                          type="button"
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => {
                            setEmailRecuperacao(email);
                            setRecuperando(true);
                          }}
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <Button type="submit" className="h-12 w-full text-base" disabled={bloqueado}>
                        {busy ? (
                          <>
                            <Loader2 className="size-5 animate-spin" />
                            Entrando...
                          </>
                        ) : (
                          <>
                            Entrar
                            <ArrowRight className="size-5" />
                          </>
                        )}
                      </Button>
                      <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
                        Sou novo na equipe?{" "}
                        <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setModo("criar")}>
                          Solicitar acesso
                        </button>
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Aba escolhida: branca (cor dos cartões no escuro), texto azul e uma sombrinha. */
const ABA =
  "h-full rounded-lg text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm";
