import { CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/hooks/useOffline";

export function StatusOffline() {
  const { online, pendentes, sincronizando, sincronizarAgora } = useOffline();
  const jaSincronizou = useRef(false);

  useEffect(() => {
    if (online && pendentes > 0 && !jaSincronizou.current) {
      jaSincronizou.current = true;
      void sincronizarAgora().then((r) => {
        if (r.enviados) toast.success(`${r.enviados} registro(s) sincronizado(s).`);
      });
    }
    if (!online) jaSincronizou.current = false;
  }, [online, pendentes, sincronizarAgora]);

  if (online && pendentes === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/60 px-5 py-2 text-sm md:px-10">
      {online ? <UploadCloud className="size-4 text-primary" /> : <CloudOff className="size-4 text-destructive" />}
      <span className="text-muted-foreground">
        {online
          ? `${pendentes} registro(s) aguardando envio.`
          : `Modo offline ativo${pendentes ? ` — ${pendentes} registro(s) salvos no aparelho` : ""}. Tudo será enviado quando a internet voltar.`}
      </span>
      {online && pendentes > 0 ? (
        <Button size="sm" variant="outline" disabled={sincronizando} onClick={() => void sincronizarAgora()}>
          <RefreshCw className={`mr-2 size-3.5 ${sincronizando ? "animate-spin" : ""}`} />
          Sincronizar agora
        </Button>
      ) : null}
    </div>
  );
}
