import { AlertTriangle, CloudOff, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/hooks/useOffline";
import type { OperacaoFila } from "@/lib/offline";

const DESCRICAO: Record<OperacaoFila["tipo"], string> = {
  aluno_novo: "Cadastro de aluno",
  aluno_update: "Alteração de aluno",
  matriculas_sync: "Turmas do aluno",
  presenca: "Registro de presença",
};

export function StatusOffline() {
  const { online, pendentes, bloqueado, sincronizando, sincronizarAgora, descartar } = useOffline();
  const jaSincronizou = useRef(false);

  useEffect(() => {
    if (online && pendentes > 0 && !jaSincronizou.current) {
      jaSincronizou.current = true;
      void sincronizarAgora().then((r) => {
        if (r.enviados) toast.success(`${r.enviados} registro(s) sincronizado(s), na ordem em que foram feitos.`);
        if (r.bloqueado) toast.error("Um registro salvo sem internet não pôde ser enviado. Os seguintes estão aguardando.");
      });
    }
    if (!online) jaSincronizou.current = false;
  }, [online, pendentes, sincronizarAgora]);

  if (online && pendentes === 0) return null;

  async function descartarBloqueado() {
    if (!bloqueado) return;
    const quando = new Date(bloqueado.criado_em).toLocaleString("pt-BR");
    if (!window.confirm(`Descartar "${DESCRICAO[bloqueado.tipo]}" feito em ${quando}? Essa ação não será enviada.`)) return;
    await descartar(bloqueado.id);
    toast.info("Registro descartado. Enviando os próximos…");
    void sincronizarAgora();
  }

  return (
    <div className="border-b border-border bg-muted/60 px-5 py-2 text-sm md:px-10">
      <div className="flex flex-wrap items-center gap-3">
        {online ? <UploadCloud className="size-4 text-primary" /> : <CloudOff className="size-4 text-destructive" />}
        <span className="text-muted-foreground">
          {online
            ? `${pendentes} registro(s) aguardando envio.`
            : `Modo offline ativo${pendentes ? ` — ${pendentes} registro(s) salvos no aparelho` : ""}. Tudo será enviado na mesma ordem quando a internet voltar.`}
        </span>
        {online && pendentes > 0 ? (
          <Button size="sm" variant="outline" disabled={sincronizando} onClick={() => void sincronizarAgora()}>
            <RefreshCw className={`mr-2 size-3.5 ${sincronizando ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        ) : null}
      </div>
      {online && bloqueado ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-destructive">
          <AlertTriangle className="size-4" />
          <span>
            {DESCRICAO[bloqueado.tipo]} de {new Date(bloqueado.criado_em).toLocaleString("pt-BR")} não foi aceito
            {bloqueado.ultimo_erro ? `: ${bloqueado.ultimo_erro}` : ""}. Os registros seguintes esperam por ele.
          </span>
          <Button size="sm" variant="outline" disabled={sincronizando} onClick={() => void descartarBloqueado()}>
            <Trash2 className="mr-2 size-3.5" /> Descartar este registro
          </Button>
        </div>
      ) : null}
    </div>
  );
}
