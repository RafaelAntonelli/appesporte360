import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HORARIOS_TURMA } from "@/lib/pcd";

export type Horario = { id: string; horario: string; ordem: number };

export function useHorarios() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data } = await supabase.from("horarios").select("id,horario,ordem").order("ordem");
    setHorarios((data as Horario[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const lista = horarios.length ? horarios.map((h) => h.horario) : [...HORARIOS_TURMA];
  return { horarios, lista, carregando, recarregar };
}
