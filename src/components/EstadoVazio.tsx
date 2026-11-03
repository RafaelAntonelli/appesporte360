import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Lista vazia: ícone, frase com o motivo e os botões do próximo passo. Usado em todas as telas. */
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acoes,
  tom = "neutro",
  compacto = false,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  tom?: "neutro" | "erro";
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed text-center",
        tom === "erro" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/50",
        compacto ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full",
          tom === "erro" ? "bg-destructive/10 text-destructive-strong" : "bg-secondary text-primary",
          compacto ? "size-10" : "size-14",
        )}
      >
        <Icone aria-hidden className={compacto ? "size-5" : "size-7"} />
      </span>
      <div className="max-w-md space-y-1">
        <p className={cn("font-display font-semibold text-foreground", compacto ? "text-sm" : "text-base")}>{titulo}</p>
        {descricao ? <p className="text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{acoes}</div> : null}
    </div>
  );
}
