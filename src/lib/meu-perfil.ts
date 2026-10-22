import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VALIDADE_EXIBICAO_SEGUNDOS } from "@/lib/links-seguros";

/** Avisa o menu que a foto ou o nome mudaram em Meu perfil. */
export const EVENTO_PERFIL_ATUALIZADO = "esporte360:perfil-atualizado";
export const BUCKET_FOTOS_EQUIPE = "fotos-equipe";

/** Até duas iniciais: primeiro e último nome (ex.: "Rafael Antonelli" → "RA"). */
export function iniciaisDoNome(nome: string) {
  const partes = nome
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

export function rotuloPapel(isAdmin: boolean) {
  return isAdmin ? "Administrador" : "Professor";
}

/** Nome, foto (link temporário de 1 hora) e caminho da foto de quem entrou. */
export function useMeuPerfil(userId: string | undefined, nomeReserva: string) {
  const [nome, setNome] = useState<string | null>(null);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("nome,foto_path").eq("id", userId).maybeSingle();
    setNome(data?.nome ?? null);
    setFotoPath(data?.foto_path ?? null);
    if (data?.foto_path) {
      const { data: assinada } = await supabase.storage
        .from(BUCKET_FOTOS_EQUIPE)
        .createSignedUrl(data.foto_path, VALIDADE_EXIBICAO_SEGUNDOS);
      setFotoUrl(assinada?.signedUrl ?? null);
    } else {
      setFotoUrl(null);
    }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    void carregar();
    const aoAtualizar = () => void carregar();
    window.addEventListener(EVENTO_PERFIL_ATUALIZADO, aoAtualizar);
    return () => window.removeEventListener(EVENTO_PERFIL_ATUALIZADO, aoAtualizar);
  }, [carregar]);

  return { nome: nome?.trim() || nomeReserva, nomeSalvo: nome, fotoPath, fotoUrl, carregando, recarregar: carregar };
}
