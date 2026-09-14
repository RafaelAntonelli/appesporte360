import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRAZO_AVISO_PADRAO } from "@/lib/atestado";

export const CHAVE_PRAZO_ATESTADO = "atestado_aviso_dias";

const CACHE_LOCAL = "arena:configuracoes";

function lerCacheLocal(chave: string) {
  if (typeof localStorage === "undefined") return null;
  try {
    const bruto = JSON.parse(localStorage.getItem(CACHE_LOCAL) ?? "{}") as Record<string, string>;
    return bruto[chave] ?? null;
  } catch {
    return null;
  }
}

function salvarCacheLocal(chave: string, valor: string) {
  if (typeof localStorage === "undefined") return;
  try {
    const bruto = JSON.parse(localStorage.getItem(CACHE_LOCAL) ?? "{}") as Record<string, string>;
    bruto[chave] = valor;
    localStorage.setItem(CACHE_LOCAL, JSON.stringify(bruto));
  } catch {
    /* ignora */
  }
}

/** Lê/atualiza uma configuração numérica do sistema (funciona offline com cache local). */
export function useConfiguracaoNumero(chave: string, padrao: number) {
  const inicial = Number(lerCacheLocal(chave));
  const [valor, setValor] = useState<number>(Number.isFinite(inicial) && inicial > 0 ? inicial : padrao);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
      if (!ativo) return;
      const numero = Number(data?.valor);
      if (Number.isFinite(numero) && numero > 0) {
        setValor(numero);
        salvarCacheLocal(chave, String(numero));
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [chave]);

  const salvar = useCallback(
    async (novo: number) => {
      const { error } = await supabase
        .from("configuracoes")
        .upsert({ chave, valor: String(novo) }, { onConflict: "chave" });
      if (error) throw error;
      setValor(novo);
      salvarCacheLocal(chave, String(novo));
    },
    [chave],
  );

  return { valor, carregando, salvar };
}

/** Lê/atualiza uma configuração de texto do sistema. */
export function useConfiguracaoTexto(chave: string, padrao = "") {
  const [valor, setValor] = useState<string>(lerCacheLocal(chave) ?? padrao);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
      if (!ativo) return;
      if (data?.valor) {
        setValor(data.valor);
        salvarCacheLocal(chave, data.valor);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [chave]);

  const salvar = useCallback(
    async (novo: string) => {
      const { error } = await supabase.from("configuracoes").upsert({ chave, valor: novo }, { onConflict: "chave" });
      if (error) throw error;
      setValor(novo);
      salvarCacheLocal(chave, novo);
    },
    [chave],
  );

  return { valor, carregando, salvar };
}

/** Prazo (em dias) do aviso de vencimento de atestado. */
export function usePrazoAvisoAtestado() {
  return useConfiguracaoNumero(CHAVE_PRAZO_ATESTADO, PRAZO_AVISO_PADRAO);
}
