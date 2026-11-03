import { cn } from "@/lib/utils";

/** Um bloco cinza com brilho leve (respeita quem pediu menos animação no aparelho). */
function Bloco({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bloco-carregando rounded-md", className)} />;
}

/**
 * Carregamento das listas: blocos cinza no formato das linhas ou cartões que vão aparecer.
 * - "linhas": lista de alunos (foto, nome, matrícula e situação)
 * - "cartoes": cartões de turma
 * - "chamada": linhas da chamada, com os três botões
 */
export function Carregando({
  formato = "linhas",
  quantidade = 6,
  rotulo = "Carregando...",
  className,
}: {
  formato?: "linhas" | "cartoes" | "chamada";
  quantidade?: number;
  rotulo?: string;
  className?: string;
}) {
  const itens = Array.from({ length: quantidade }, (_, i) => i);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{rotulo}</span>
      {formato === "cartoes" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((i) => (
            <div key={i} className="space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card pb-5">
              <Bloco className="h-1.5 rounded-none" />
              <div className="space-y-3 px-6 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Bloco className="h-5 w-4/5" />
                    <Bloco className="h-3.5 w-1/2" />
                  </div>
                  <Bloco className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex gap-1.5">
                  <Bloco className="h-5 w-10" />
                  <Bloco className="h-5 w-10" />
                </div>
                <Bloco className="h-2 w-full rounded-full" />
                <Bloco className="h-3.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map((i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 rounded-xl border border-border/70 bg-card px-3 py-3",
                formato === "chamada" ? "flex-col sm:flex-row sm:items-center" : "items-center",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Bloco className={cn("shrink-0 rounded-full", formato === "chamada" ? "size-20 sm:size-14" : "size-10")} />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bloco className={cn("h-4", i % 3 === 0 ? "w-3/5" : i % 3 === 1 ? "w-2/5" : "w-1/2")} />
                  <Bloco className="h-3 w-28" />
                  {formato === "linhas" ? null : <Bloco className="h-4 w-16 rounded-full" />}
                </div>
                {formato === "linhas" ? <Bloco className="hidden h-5 w-20 rounded-full sm:block" /> : null}
              </div>
              {formato === "chamada" ? (
                <div className="grid w-full grid-cols-[1fr_1fr_1.3fr] gap-1.5 sm:w-72">
                  <Bloco className="h-11 rounded-lg" />
                  <Bloco className="h-11 rounded-lg" />
                  <Bloco className="h-11 rounded-lg" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Valor de um cartão de resumo: "—" enquanto carrega. */
export function valorOuTraco(carregando: boolean, valor: string) {
  return carregando ? "—" : valor;
}
