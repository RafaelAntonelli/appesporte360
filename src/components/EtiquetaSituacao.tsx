import { cn } from "@/lib/utils";
import { ROTULO_SITUACAO, type SituacaoAluno } from "@/lib/situacao";

const ESTILO: Record<SituacaoAluno, string> = {
  ativo: "border-success/30 bg-success/15 text-success-strong",
  licenca: "border-warning/50 bg-warning/20 text-warning-strong",
  atestado_vencido: "border-destructive/30 bg-destructive/12 text-destructive-strong",
  inativo: "border-border bg-muted text-muted-foreground",
};

const PONTO: Record<SituacaoAluno, string> = {
  ativo: "bg-success",
  licenca: "bg-warning",
  atestado_vencido: "bg-destructive",
  inativo: "bg-muted-foreground",
};

/** Etiqueta colorida única da situação do aluno. */
export function EtiquetaSituacao({
  situacao,
  texto,
  className,
}: {
  situacao: SituacaoAluno;
  /** Texto opcional no lugar do padrão (ex.: "Licença até 15/11"). */
  texto?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        ESTILO[situacao],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", PONTO[situacao])} />
      <span className="truncate">{texto ?? ROTULO_SITUACAO[situacao]}</span>
    </span>
  );
}
