import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { toast } from "sonner";
import loginImagem from "@/assets/login-esporte-360.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar | Arena Aquática" },
      { name: "description", content: "Acesso da equipe da Arena Aquática ao sistema de matrículas e presença." },
      { property: "og:title", content: "Entrar | Arena Aquática" },
      { property: "og:description", content: "Acesso da equipe ao sistema de matrículas e presença." },
    ],
  }),
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [redefinindo, setRedefinindo] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");

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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
    setRecuperando(false);
  }

  async function definirNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada com sucesso!");
    setRedefinindo(false);
    setNovaSenha("");
    navigate({ to: "/" });
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/" });
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin, data: { nome } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Conta criada! Confirme o e-mail para acessar.");
      return;
    }
    navigate({ to: "/" });
  }


  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex">
        <img
          src={loginImagem.url}
          alt="Programa Esporte 360"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-transparent to-primary/60" />
        <div className="relative z-10 flex items-center gap-3">
          <Waves className="size-7" />
          <span className="font-display text-xl font-semibold">Arena Aquática</span>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-primary-foreground/80">Acesso exclusivo da equipe</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/70 shadow-pool">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Acesso da equipe</CardTitle>
            <CardDescription>Entre para gerenciar alunos, turmas e presenças.</CardDescription>
          </CardHeader>
          <CardContent>
            {redefinindo ? (
              <form onSubmit={definirNovaSenha} className="space-y-4">
                <p className="text-sm text-muted-foreground">Defina uma nova senha para a sua conta.</p>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    required
                    minLength={6}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>Salvar nova senha</Button>
              </form>
            ) : recuperando ? (
              <form onSubmit={enviarRecuperacao} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email-recuperacao">E-mail</Label>
                  <Input
                    id="email-recuperacao"
                    type="email"
                    required
                    value={emailRecuperacao}
                    onChange={(e) => setEmailRecuperacao(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>Enviar link de recuperação</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setRecuperando(false)}>
                  Voltar para o login
                </Button>
              </form>
            ) : (
            <Tabs defaultValue="entrar">
              <TabsList className="w-full">
                <TabsTrigger value="entrar" className="flex-1">Entrar</TabsTrigger>
                <TabsTrigger value="criar" className="flex-1">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={entrar} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>Entrar</Button>
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
                </form>
              </TabsContent>

              <TabsContent value="criar">
                <form onSubmit={cadastrar} className="space-y-4 pt-4">
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
                    <Input id="senha2" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>Criar conta</Button>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
