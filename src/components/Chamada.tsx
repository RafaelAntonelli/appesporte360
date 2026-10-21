import { useState } from "react";
import { Check, CheckCheck, FileCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

export type StatusChamada = "presente" | "falta" | "falta_justificada";

const OPCOES: {
  status: StatusChamada;
  rotulo: string;
  Icone: typeof Check;
  ativo: string;
  inativo: string;
}[] = [
  {
    status: "presente",
    rotulo: "Presente",
    Icone: Check,
    ativo: "border-success bg-success text-success-foreground",
    inativo: "border-success/40 text-success-strong hover:bg-success/10",
  },
  {
    status: "falta",
    rotulo: "Falta",
    Icone: X,
    ativo: "border-destructive bg-destructive text-destructive-foreground",
    inativo: "border-destructive/40 text-destructive-strong hover:bg-destructive/10",
  },
  {
    status: "falta_justificada",
    rotulo: "Justificada",
    Icone: FileCheck,
    ativo: "border-warning bg-warning text-warning-foreground",
    inativo: "border-warning/60 text-warning-strong hover:bg-warning/15",
  },
];

/** Botões grandes da chamada: Presente (verde), Falta (vermelho) e Justificada (amarelo, um pouco mais largo). */
export function BotoesChamada({
  atual,
  onEscolher,
  desabilitado,
  className,
}: {
  atual: StatusChamada | undefined | null;
  onEscolher: (status: StatusChamada) => void;
  desabilitado?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid w-full shrink-0 grid-cols-[1fr_1fr_1.3fr] gap-1.5 @xl:w-auto @xl:min-w-[19rem]", className)}>
      {OPCOES.map(({ status, rotulo, Icone, ativo, inativo }) => {
        const marcado = atual === status;
        return (
          <button
            key={status}
            type="button"
            disabled={desabilitado}
            aria-pressed={marcado}
            onClick={() => onEscolher(status)}
            className={cn(
              "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border-2 bg-card px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              marcado ? ativo : inativo,
            )}
          >
            <Icone aria-hidden className="size-4 shrink-0 max-[399px]:hidden" />
            <span className="truncate">{rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Barra "X de Y marcados" no topo da chamada. */
export function ProgressoChamada({ marcados, total, className }: { marcados: number; total: number; className?: string }) {
  const pct = total ? Math.round((Math.min(marcados, total) / total) * 100) : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-foreground">
          {marcados} de {total} marcados
        </span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={marcados}
        aria-label="Progresso da chamada"
      >
        <div className="h-full rounded-full bg-gradiente transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * "Marcar todos como presentes (N)": pede confirmação e marca só quem ainda não tem registro.
 * Quem está em licença médica fica de fora (continua justificado).
 */
export function MarcarTodosPresentes({
  pendentes,
  emLicenca = 0,
  onConfirmar,
  className,
}: {
  pendentes: number;
  emLicenca?: number;
  onConfirmar: () => Promise<void> | void;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (pendentes === 0) {
    return (
      <p className={cn("flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success-strong", className)}>
        <CheckCheck className="size-4 shrink-0" /> Todos já foram marcados
      </p>
    );
  }

  return (
    <>
      <Button className={cn("h-11 w-full", className)} disabled={enviando} onClick={() => setAberto(true)}>
        <CheckCheck className="size-4" />
        {enviando ? "Marcando..." : `Marcar todos como presentes (${pendentes})`}
      </Button>
      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar {pendentes} aluno(s) como presentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Só os alunos ainda sem registro serão marcados. Faltas e justificativas já lançadas não mudam.
              {emLicenca ? ` ${emLicenca} aluno(s) em licença médica continuam justificados.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEnviando(true);
                void Promise.resolve(onConfirmar()).finally(() => setEnviando(false));
              }}
            >
              Marcar presentes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
