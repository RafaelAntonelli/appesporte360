import { useCallback, useEffect, useState } from "react";
import { assinarFila, descartarDaFila, estaOnline, listarFila, sincronizar, type OperacaoFila } from "@/lib/offline";
import { lerDadosOffline, prepararDadosOffline } from "@/lib/offline-dados";

export function useOffline() {
  const [online, setOnline] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [bloqueado, setBloqueado] = useState<OperacaoFila | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const atualizar = useCallback(async () => {
    const fila = await listarFila();
    const dados = await lerDadosOffline();
    setAtualizadoEm(dados?.atualizadoEm ?? null);
    setPendentes(fila.length);
    // O primeiro da fila com erro segura os demais (envio sempre em ordem).
    setBloqueado(fila[0]?.ultimo_erro ? fila[0] : null);
  }, []);

  const sincronizarAgora = useCallback(async () => {
    setSincronizando(true);
    const r = await sincronizar();
    if (!r.bloqueado) await prepararDadosOffline().catch(() => undefined);
    await atualizar();
    setSincronizando(false);
    return r;
  }, [atualizar]);

  const descartar = useCallback(
    async (id: string) => {
      await descartarDaFila(id);
      await atualizar();
    },
    [atualizar],
  );

  useEffect(() => {
    setOnline(estaOnline());
    void atualizar();
    const desassinar = assinarFila(() => void atualizar());
    const aoConectar = () => {
      setOnline(true);
      void sincronizarAgora();
    };
    const aoDesconectar = () => setOnline(false);
    window.addEventListener("online", aoConectar);
    window.addEventListener("offline", aoDesconectar);
    window.addEventListener("listas-offline-atualizadas", atualizar);
    const preparar = () => { if (estaOnline()) void prepararDadosOffline().then(atualizar).catch(() => undefined); };
    preparar();
    window.addEventListener("chamada-sincronizada", preparar);
    return () => {
      desassinar();
      window.removeEventListener("online", aoConectar);
      window.removeEventListener("offline", aoDesconectar);
      window.removeEventListener("listas-offline-atualizadas", atualizar);
      window.removeEventListener("chamada-sincronizada", preparar);
    };
  }, [atualizar, sincronizarAgora]);

  return { online, atualizadoEm, pendentes, bloqueado, sincronizando, sincronizarAgora, descartar, atualizar };
}
