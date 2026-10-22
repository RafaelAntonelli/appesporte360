import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { otimizarImagem } from "@/lib/imagem";
import { capitalizarNome } from "@/lib/formatacao";
import { BUCKET_FOTOS_EQUIPE, EVENTO_PERFIL_ATUALIZADO, rotuloPapel, useMeuPerfil } from "@/lib/meu-perfil";
import { AppShell } from "@/components/AppShell";
import { FotoUsuario } from "@/components/FotoUsuario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/perfil")({
  component: MeuPerfil,
  head: () => ({
    meta: [
      { title: "Meu perfil | Esporte 360" },
      { name: "description", content: "Foto e nome de quem usa o sistema do Esporte 360." },
      { property: "og:title", content: "Meu perfil | Esporte 360" },
      { property: "og:description", content: "Foto e nome exibidos no menu do Esporte 360." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function avisarMenu() {
  window.dispatchEvent(new Event(EVENTO_PERFIL_ATUALIZADO));
}

function MeuPerfil() {
  const { user, isAdmin } = useAuth();
  const reserva = user?.email?.split("@")[0] ?? "Usuário";
  const perfil = useMeuPerfil(user?.id, reserva);
  const [nome, setNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!perfil.carregando) setNome(perfil.nomeSalvo ?? "");
  }, [perfil.carregando, perfil.nomeSalvo]);

  async function trocarFoto(arquivo: File | undefined) {
    if (!arquivo || !user) return;
    if (!arquivo.type.startsWith("image/")) return toast.error("Escolha uma imagem (JPG, PNG ou WebP).");
    setEnviandoFoto(true);
    try {
      const otimizada = await otimizarImagem(arquivo, { nome: "foto.jpg", ladoMaximo: 512 });
      const caminho = `${user.id}/foto-${Date.now()}.jpg`;
      const { error: erroEnvio } = await supabase.storage
        .from(BUCKET_FOTOS_EQUIPE)
        .upload(caminho, otimizada, { contentType: otimizada.type || "image/jpeg" });
      if (erroEnvio) return toast.error("Não foi possível enviar a foto. Tente de novo.");
      const { data, error } = await supabase.from("profiles").update({ foto_path: caminho }).eq("id", user.id).select("id");
      if (error || !data?.length) {
        await supabase.storage.from(BUCKET_FOTOS_EQUIPE).remove([caminho]);
        return toast.error("Não foi possível salvar a foto no seu cadastro.");
      }
      if (perfil.fotoPath) await supabase.storage.from(BUCKET_FOTOS_EQUIPE).remove([perfil.fotoPath]);
      toast.success("Foto atualizada");
      avisarMenu();
    } finally {
      setEnviandoFoto(false);
      if (entrada.current) entrada.current.value = "";
    }
    return;
  }

  async function removerFoto() {
    if (!user || !perfil.fotoPath) return;
    setEnviandoFoto(true);
    const { error } = await supabase.from("profiles").update({ foto_path: null }).eq("id", user.id);
    if (!error) await supabase.storage.from(BUCKET_FOTOS_EQUIPE).remove([perfil.fotoPath]);
    setEnviandoFoto(false);
    if (error) return toast.error("Não foi possível remover a foto.");
    toast.success("Foto removida");
    avisarMenu();
    return;
  }

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const valor = capitalizarNome(nome.trim());
    if (!valor) return toast.error("Informe seu nome.");
    setSalvandoNome(true);
    const { data, error } = await supabase.from("profiles").update({ nome: valor }).eq("id", user.id).select("id");
    setSalvandoNome(false);
    if (error || !data?.length) return toast.error("Não foi possível salvar o nome.");
    toast.success("Nome atualizado");
    avisarMenu();
    return;
  }

  return (
    <AppShell title="Meu perfil" subtitle="Sua foto e seu nome aparecem no menu">
      <div className="grid max-w-3xl gap-6">
        <Card className="border-border/70">
          <CardHeader><CardTitle className="font-display text-lg">Foto</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <FotoUsuario url={perfil.fotoUrl} nome={perfil.nome} className="size-24 text-2xl ring-4" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Sem foto, o menu mostra as iniciais do seu nome. A foto é reduzida no aparelho antes do envio.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={entrada}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Escolher foto"
                  onChange={(e) => void trocarFoto(e.target.files?.[0])}
                />
                <Button onClick={() => entrada.current?.click()} disabled={enviandoFoto}>
                  {enviandoFoto ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  {perfil.fotoPath ? "Trocar foto" : "Escolher foto"}
                </Button>
                {perfil.fotoPath ? (
                  <Button variant="outline" className="text-destructive-strong" onClick={() => void removerFoto()} disabled={enviandoFoto}>
                    <Trash2 className="size-4" /> Remover foto
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader><CardTitle className="font-display text-lg">Dados</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={salvarNome} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="perfil-nome">Nome</Label>
                <Input id="perfil-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{user?.email ?? "—"}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{rotuloPapel(isAdmin)}</p>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={salvandoNome}>
                  {salvandoNome ? <Loader2 className="size-4 animate-spin" /> : null} Salvar nome
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
