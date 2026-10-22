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

type UsuarioBasico = { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined;

/** Nome do cadastro da conta (mesma ordem usada nos registros), depois o do perfil, depois o e-mail. */
export function nomeDoUsuario(user: UsuarioBasico, nomePerfil?: string | null) {
  const meta = user?.user_metadata ?? {};
  const candidatos = [meta["nome"], meta["full_name"], nomePerfil, user?.email?.split("@")[0]];
  for (const c of candidatos) if (typeof c === "string" && c.trim()) return c.trim();
  return "Usuário";
}

/** Nome, foto (link temporário de 1 hora) e caminho da foto de quem entrou. */
export function useMeuPerfil(user: UsuarioBasico) {
  const userId = user?.id;
  const [nomePerfil, setNomePerfil] = useState<string | null>(null);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("nome,foto_path").eq("id", userId).maybeSingle();
    setNomePerfil(data?.nome ?? null);
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

  return { nome: nomeDoUsuario(user, nomePerfil), fotoPath, fotoUrl, carregando, recarregar: carregar };
}
