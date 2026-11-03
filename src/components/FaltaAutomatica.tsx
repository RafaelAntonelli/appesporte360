import { useEffect, useState } from "react";
import { AlarmClockOff, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dataISO } from "@/lib/licenca";
import { estaOnline } from "@/lib/offline";
import { cn } from "@/lib/utils";
import {
  CONFIG_PADRAO,
  OPCOES_MINUTOS,
  textoConfirmacaoFaltaAutomatica,
  textoEstadoFaltaAutomatica,
  type ConfigFaltaAutomatica,
} from "@/lib/falta-automatica";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/**
 * Cartão "Falta automática" da Presença. Só administradores ligam, desligam ou mudam o prazo
 * (o banco também recusa para os demais); professores apenas veem o estado.
 */
export function FaltaAutomatica() {
  const { isAdmin, loading } = useAuth();
  const [config, setConfig] = useState<ConfigFaltaAutomatica | null>(null);
  const [horarios, setHorarios] = useState<number | null>(null);
  const [hoje, setHoje] = useState<{ turmas: number; faltas: number } | null>(null);
  const [confirmarLigar, setConfirmarLigar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    if (!estaOnline()) return;
    const [c, a, e] = await Promise.all([
      supabase.from("falta_automatica").select("ativa,minutos").maybeSingle(),
      supabase.from("falta_automatica_agenda").select("nome", { count: "exact", head: true }),
      supabase.from("faltas_automaticas_execucoes").select("faltas").eq("data", dataISO()),
    ]);
    setConfig(c.data ? { ativa: c.data.ativa, minutos: c.data.minutos } : CONFIG_PADRAO);
    setHorarios(a.count ?? 0);
    const linhas = (e.data ?? []) as { faltas: number }[];
    setHoje({ turmas: linhas.length, faltas: linhas.reduce((s, l) => s + (l.faltas ?? 0), 0) });
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar(novo: ConfigFaltaAutomatica, mensagem: string) {
    if (!estaOnline()) return void toast.error("Sem internet. Tente de novo quando a conexão voltar.");
    setSalvando(true);
    const { error } = await supabase.from("falta_automatica").upsert({ id: true, ...novo }, { onConflict: "id" });
    setSalvando(false);
    if (error) return void toast.error("Não foi possível salvar. Só administradores podem alterar a falta automática.");
    toast.success(mensagem);
    void carregar();
  }

  const atual = config ?? CONFIG_PADRAO;
  const podeAlterar = isAdmin && !loading && config !== null && !salvando;

  return (
    <Card className="mb-6 border-border/70">
      <CardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg",
              atual.ativa ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            <AlarmClockOff className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold">Falta automática</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  config === null
                    ? "bg-secondary text-muted-foreground"
                    : atual.ativa
                      ? "bg-success/15 text-success-strong"
                      : "bg-secondary text-muted-foreground",
                )}
              >
                {config === null ? "—" : atual.ativa ? "Ligada" : "Desligada"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {config === null ? "Carregando..." : textoEstadoFaltaAutomatica(atual)}
            </p>
            {config && atual.ativa ? (
              <p className="text-xs text-muted-foreground">
                {horarios ? `${horarios} horário(s) de verificação programado(s) conforme as turmas.` : "Nenhuma turma com horário para verificar."}
                {hoje && hoje.turmas ? ` Hoje: ${hoje.faltas} falta(s) automática(s) em ${hoje.turmas} turma(s).` : ""}
              </p>
            ) : null}
            {!loading && !isAdmin ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" aria-hidden /> Só administradores podem alterar.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Marcar falta após</span>
            <Select
              value={String(atual.minutos)}
              disabled={!podeAlterar}
              onValueChange={(v) => {
                const minutos = Number(v);
                void salvar(
                  { ativa: atual.ativa, minutos },
                  atual.ativa
                    ? `Prazo alterado para ${minutos} minutos. As verificações foram reprogramadas.`
                    : `Prazo alterado para ${minutos} minutos.`,
                );
              }}
            >
              <SelectTrigger className="h-9 w-32" aria-label="Minutos após o início da aula">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_MINUTOS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>do início da aula</span>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={atual.ativa}
              disabled={!podeAlterar}
              aria-label="Ligar ou desligar a falta automática"
              onCheckedChange={(ligar) => {
                if (ligar) setConfirmarLigar(true);
                else void salvar({ ativa: false, minutos: atual.minutos }, "Falta automática desligada.");
              }}
            />
            {atual.ativa ? "Ligada" : "Desligada"}
          </label>
        </div>
      </CardContent>

      <AlertDialog open={confirmarLigar} onOpenChange={setConfirmarLigar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ligar a falta automática ({atual.minutos} minutos)?</AlertDialogTitle>
            <AlertDialogDescription>{textoConfirmacaoFaltaAutomatica(atual.minutos)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void salvar(
                  { ativa: true, minutos: atual.minutos },
                  `Falta automática ligada: ${atual.minutos} minutos após o início de cada aula.`,
                )
              }
            >
              Ligar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
