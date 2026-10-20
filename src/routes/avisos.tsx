import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { enviarAvisoFn } from "@/lib/avisos.functions";
import { AVISO_MENSAGEM_MAX, AVISO_TITULO_MAX, validarAviso } from "@/lib/aluno-acesso";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export const Route = createFileRoute("/avisos")({
  component: AvisosPage,
  head: () => ({
    meta: [
      { title: "Avisos | Esporte 360" },
      { name: "description", content: "Envio de avisos da administração para os alunos do Esporte 360." },
      { property: "og:title", content: "Avisos | Esporte 360" },
      { property: "og:description", content: "Avisos para um aluno ou para todos, com notificação no celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type AlunoOpcao = { id: string; nome: string; codigo: string };
type AvisoEnviado = {
  id: string;
  titulo: string;
  mensagem: string;
  aluno_id: string | null;
  created_at: string;
  notificados: number;
  enviado_por_nome: string | null;
  alunos: { nome: string } | null;
};

function AvisosPage() {
  const { isAdmin, loading } = useAuth();
  const enviar = useServerFn(enviarAvisoFn);
  const [alunos, setAlunos] = useState<AlunoOpcao[]>([]);
  const [historico, setHistorico] = useState<AvisoEnviado[]>([]);
  const [destino, setDestino] = useState<"todos" | "aluno">("todos");
  const [aluno, setAluno] = useState<AlunoOpcao | null>(null);
  const [abrirBusca, setAbrirBusca] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const [a, h] = await Promise.all([
      supabase.from("alunos").select("id,nome,codigo").eq("ativo", true).order("nome"),
      supabase
        .from("avisos")
        .select("id,titulo,mensagem,aluno_id,created_at,notificados,enviado_por_nome,alunos(nome)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setAlunos((a.data ?? []) as AlunoOpcao[]);
    setHistorico((h.data ?? []) as AvisoEnviado[]);
  }

  useEffect(() => {
    if (isAdmin) void carregar();
  }, [isAdmin]);

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarAviso(titulo, mensagem);
    if (erro) return void toast.error(erro);
    if (destino === "aluno" && !aluno) return void toast.error("Escolha o aluno que vai receber o aviso.");
    setEnviando(true);
    try {
      const r = await enviar({ data: { titulo, mensagem, alunoId: destino === "aluno" ? aluno!.id : null } });
      toast.success("Aviso enviado.", {
        description:
          r.celularesCadastrados === 0
            ? "Nenhum aluno ativou as notificações no celular. O aviso aparece na área do aluno."
            : `${r.notificados} de ${r.celularesCadastrados} celular(es) notificado(s).`,
        duration: 8000,
      });
      if (!r.firebaseConfigurado) toast.warning("As notificações no celular ainda não estão configuradas.");
      else if (r.erro) toast.warning(r.erro);
      setTitulo("");
      setMensagem("");
      void carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o aviso.");
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return null;

  return (
    <AppShell title="Avisos" subtitle="Envie avisos para os alunos">
      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Apenas administradores podem enviar avisos.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Novo aviso</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={aoEnviar} className="space-y-4">
                <RadioGroup value={destino} onValueChange={(v) => setDestino(v as "todos" | "aluno")} className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="todos" /> Todos os alunos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="aluno" /> Um aluno específico
                  </label>
                </RadioGroup>
                {destino === "aluno" ? (
                  <Popover open={abrirBusca} onOpenChange={setAbrirBusca}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">{aluno ? `${aluno.nome} · ${aluno.codigo}` : "Escolha o aluno"}</span>
                        <ChevronsUpDown className="size-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou matrícula" />
                        <CommandList>
                          <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                          <CommandGroup>
                            {alunos.map((a) => (
                              <CommandItem
                                key={a.id}
                                value={`${a.nome} ${a.codigo}`}
                                onSelect={() => {
                                  setAluno(a);
                                  setAbrirBusca(false);
                                }}
                              >
                                <Check className={`mr-2 size-4 ${aluno?.id === a.id ? "opacity-100" : "opacity-0"}`} />
                                {a.nome} <span className="ml-auto text-xs text-muted-foreground">{a.codigo}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : null}
                <div className="space-y-1">
                  <Label htmlFor="aviso-titulo">Título</Label>
                  <Input id="aviso-titulo" maxLength={AVISO_TITULO_MAX} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                  <p className="text-right text-xs text-muted-foreground">{titulo.length}/{AVISO_TITULO_MAX}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="aviso-msg">Mensagem</Label>
                  <Textarea id="aviso-msg" rows={6} maxLength={AVISO_MENSAGEM_MAX} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                  <p className="text-right text-xs text-muted-foreground">{mensagem.length}/{AVISO_MENSAGEM_MAX}</p>
                </div>
                <Button type="submit" disabled={enviando}>
                  <Send className="mr-1 size-4" /> {enviando ? "Enviando…" : "Enviar aviso"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Avisos enviados</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-3 overflow-y-auto">
              {historico.length ? (
                historico.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium text-foreground">{h.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")} · {h.aluno_id ? `Para ${h.alunos?.nome ?? "aluno"}` : "Para todos"} ·{" "}
                      {h.notificados} celular(es) notificado(s){h.enviado_por_nome ? ` · por ${h.enviado_por_nome}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{h.mensagem}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum aviso enviado ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
