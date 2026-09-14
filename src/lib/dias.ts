import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GrupoDias = { id: string; label: string; dias: string[]; ordem: number };

export const GRUPOS_DIAS_PADRAO: GrupoDias[] = [
  { id: "padrao-ter-qui", label: "Terça e Quinta", dias: ["Ter", "Qui"], ordem: 1 },
  { id: "padrao-qua-sex", label: "Quarta e Sexta", dias: ["Qua", "Sex"], ordem: 2 },
];

export function useGruposDias() {
  const [grupos, setGrupos] = useState<GrupoDias[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.from("grupos_dias").select("id,label,dias,ordem").order("ordem");
    setGrupos((data as GrupoDias[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const lista = grupos.length ? grupos : GRUPOS_DIAS_PADRAO;
  return { grupos, lista, carregando, recarregar };
}

/** Converte "Terça e Quinta" em ["Ter","Qui"] quando o grupo não define dias. */
export function diasDoLabel(label: string, dias?: string[]) {
  if (dias?.length) return dias;
  return label
    .split(/\s+e\s+|,/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
}
