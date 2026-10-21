import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, WifiOff } from "lucide-react";
import { toast } from "sonner";
import loginImagem from "@/assets/login-esporte-360.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";
import { tokenLocal } from "@/lib/aluno-local";
import { AcessoAluno } from "@/components/AcessoAluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NOME_APP = "Esporte 360";

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

/** Ondas decorativas do topo e do painel visual. */
function Ondas({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 200" preserveAspectRatio="none" className={className}>
      <path className="fill-sidebar-primary/15" d="M0,120 C180,60 360,180 540,130 C720,80 900,20 1080,70 C1260,120 1350,150 1440,110 L1440,200 L0,200 Z" />
      <path className="fill-primary/25" d="M0,150 C200,110 400,190 640,150 C880,110 1080,90 1260,130 C1350,150 1400,160 1440,150 L1440,200 L0,200 Z" />
    </svg>
  );
}

function Logo({ className }: { className?: string }) {
  return <img src="/icons/icon-192x192.png" alt={NOME_APP} className={`rounded-xl object-cover ${className ?? ""}`} />;
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
    ? "Criar nova senha"
    : recuperando
      ? "Recuperar senha"
      : modo === "criar"
        ? "Cadastro da equipe"
        : "Acesse sua conta";
  const descricao = redefinindo
    ? "Defina uma nova senha para a sua conta."
    : recuperando
      ? "Enviaremos um link para o seu e-mail."
      : modo === "criar"
        ? "Crie sua conta. Um administrador precisará liberar seu acesso."
        : aba === "aluno"
          ? "Aluno: entre com CPF ou matrícula e data de nascimento."
          : "Entre para gerenciar alunos, turmas e presenças.";

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Painel visual ao lado do formulário (computador) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-sidebar-foreground lg:flex">
        <img src={loginImagem.url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/70 to-sidebar/30" />
        <Ondas className="absolute inset-x-0 bottom-0 h-48 w-full" />
        <div className="relative z-10 flex items-center gap-3">
          <Logo className="size-11" />
          <span className="font-display text-xl font-semibold">{NOME_APP}</span>
        </div>
        <div className="relative z-10 max-w-md pb-16">
          <p className="font-display text-3xl font-semibold leading-tight">Esporte que transforma, gestão que acompanha.</p>
          <p className="mt-3 text-sm text-sidebar-foreground/70">Matrículas, turmas e presença do Programa Esporte 360 em um só lugar.</p>
        </div>
      </div>

      {/* Topo azul-marinho com ondas (celular) */}
      <div className="relative overflow-hidden bg-navy px-6 pb-20 pt-[calc(2.5rem+env(safe-area-inset-top))] text-center text-sidebar-foreground lg:hidden">
        <Ondas className="absolute inset-x-0 bottom-6 h-24 w-full opacity-80" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Logo className="size-16 shadow-pool" />
          <p className="text-sm font-medium text-sidebar-foreground/70">{NOME_APP}</p>
          <h1 className="font-display text-2xl font-semibold">{titulo}</h1>
        </div>
        <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-12 w-full">
          <path className="fill-background" d="M0,64 C240,120 480,8 720,40 C960,72 1200,120 1440,56 L1440,120 L0,120 Z" />
        </svg>
      </div>

      <div className="relative z-10 -mt-4 flex items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 hidden lg:block">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{titulo}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          </div>
        <Card className="w-full border-border/70 shadow-pool">
          <CardHeader className="pb-4 lg:hidden">
            <CardDescription>{descricao}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 lg:pt-6">
            {!online ? (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <WifiOff className="mt-0.5 size-4 shrink-0" />
                <span>Você está sem internet. É preciso estar conectado para entrar no sistema.</span>
              </div>
            ) : null}

            {redefinindo ? (
              <form onSubmit={definirNovaSenha} className="space-y-4">
                <p className="text-sm text-muted-foreground">Defina uma nova senha para a sua conta.</p>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <CampoSenha id="nova-senha" minLength={6} value={novaSenha} onChange={setNovaSenha} />
                </div>
                <Button type="submit" className="w-full" disabled={bloqueado}>Salvar nova senha</Button>
              </form>
            ) : recuperando ? (
              <form onSubmit={enviarRecuperacao} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email-recuperacao">E-mail</Label>
                  <Input id="email-recuperacao" type="email" required value={emailRecuperacao} onChange={(e) => setEmailRecuperacao(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={bloqueado}>Enviar link de recuperação</Button>
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
                <Button type="submit" className="w-full" disabled={bloqueado}>Criar conta</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setModo("entrar")}>
                  Voltar para o login
                </Button>
              </form>
            ) : (
              <Tabs value={aba} onValueChange={(v) => setAba(v as "equipe" | "aluno")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="equipe">Equipe</TabsTrigger>
                  <TabsTrigger value="aluno">Aluno</TabsTrigger>
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
                <label htmlFor="lembrar-email" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox id="lembrar-email" checked={lembrarEmail} onCheckedChange={(v) => setLembrarEmail(v === true)} />
                  Lembrar meu e-mail
                </label>
                <Button type="submit" className="h-11 w-full text-base" disabled={bloqueado}>Entrar</Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => {
                    setEmailRecuperacao(email);
                    setRecuperando(true);
                  }}
                >
                  Esqueci minha senha
                </Button>
                <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
                  Sou novo na equipe?{" "}
                  <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setModo("criar")}>
                    Solicitar acesso
                  </button>
                </p>
              </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
