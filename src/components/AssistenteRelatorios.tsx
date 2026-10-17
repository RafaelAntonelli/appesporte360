import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, LoaderCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { perguntarRelatorioIA } from "@/lib/ai.functions";
import { ROTULOS } from "@/lib/ai/contracts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AiErro } from "./AiRevisao";
export function AssistenteRelatorios() {
  const perguntar = useServerFn(perguntarRelatorioIA);
  const [pergunta, setPergunta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState<
    Extract<Awaited<ReturnType<typeof perguntarRelatorioIA>>, { ok: true }>["resultado"] | null
  >(null);
  const [erro, setErro] = useState<{ erro: string; bloqueado?: boolean } | null>(null);
  return (
    <section className="space-y-4 border-b border-border pb-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles className="size-5" />
        Assistente de relatórios
      </h2>
      <Label htmlFor="pergunta-relatorio">Pergunta</Label>
      <Textarea
        id="pergunta-relatorio"
        rows={3}
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
        maxLength={2500}
        placeholder="Qual a média de idade dos alunos ativos?"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={ocupado || pergunta.trim().length < 5}
          onClick={async () => {
            setOcupado(true);
            setErro(null);
            setResposta(null);
            try {
              const r = await perguntar({ data: { pergunta } });
              if (!r.ok) setErro(r);
              else setResposta(r.resultado);
            } catch {
              setErro({ erro: "Não foi possível consultar a IA. Nenhum resultado foi estimado." });
            } finally {
              setOcupado(false);
            }
          }}
        >
          {ocupado ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {ocupado ? "Consultando e calculando…" : "Consultar"}
        </Button>
        <span className="text-xs text-muted-foreground">IA · Consome créditos do workspace.</span>
      </div>
      {erro ? <AiErro {...erro} aoRetomar={() => setErro(null)} /> : null}
      {resposta ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Filtros:{" "}
            {resposta.plano.filtros.length
              ? resposta.plano.filtros
                  .map((f) => `${ROTULOS[f.campo]}: ${f.valores.join(", ")}`)
                  .join(" · ")
              : "Toda a base autorizada"}
            {resposta.plano.idadeMin !== null ? ` · Idade mínima: ${resposta.plano.idadeMin}` : ""}
            {resposta.plano.idadeMax !== null ? ` · Idade máxima: ${resposta.plano.idadeMax}` : ""}
          </div>
          <div className="space-y-3 overflow-x-auto text-sm [&_table]:w-full [&_th]:border-b [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_td]:border-b [&_td]:border-border [&_td]:p-2 [&_p]:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resposta.texto}</ReactMarkdown>
          </div>
          {resposta.agregados ? (
            <details className="text-sm">
              <summary className="cursor-pointer">Conferir cálculos do sistema</summary>
              <p className="my-2">
                Total único: {resposta.agregados.resumo.total} · Sem idade válida:{" "}
                {resposta.agregados.resumo.semIdadeValida} · Referência:{" "}
                {resposta.agregados.dataReferencia}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {["Grupo", "Total", "%", "Média", "Mediana", "Mín.", "Máx.", "Sem idade"].map(
                        (t) => (
                          <th key={t} className="border-b border-border p-2">
                            {t}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {resposta.agregados.grupos.map((g, i) => (
                      <tr key={i}>
                        {[
                          g.valores.join(" / ") || "Todos",
                          g.total,
                          g.percentual.toFixed(2),
                          g.media?.toFixed(2) ?? "—",
                          g.mediana ?? "—",
                          g.minima ?? "—",
                          g.maxima ?? "—",
                          g.semIdadeValida,
                        ].map((v, j) => (
                          <td key={j} className="border-b border-border p-2">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-muted-foreground">{resposta.agregados.nota}</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
