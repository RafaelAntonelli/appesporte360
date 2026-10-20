import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tempo em que as permissões dos professores ficam liberadas após confirmar a senha. */
export const DESBLOQUEIO_PERMISSOES_MIN = 15;

/**
 * Confirma a senha do administrador conectado e libera a alteração das permissões dos professores
 * por alguns minutos. A liberação é exigida também pelas regras do banco.
 */
export const desbloquearPermissoesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ senha: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ehAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!ehAdmin) throw new Error("Apenas administradores podem acessar as permissões dos professores.");

    const email = (context.claims as { email?: string }).email;
    const url = process.env["SUPABASE_URL"];
    const chave = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!email || !url || !chave) throw new Error("Não foi possível confirmar a senha agora.");

    const resp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: chave, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: data.senha }),
    });
    if (!resp.ok) {
      if (resp.status === 429) throw new Error("Muitas tentativas. Aguarde alguns minutos.");
      if (resp.status === 400 || resp.status === 401) throw new Error("Senha incorreta.");
      console.error(`[permissoes] confirmação de senha falhou [${resp.status}]: ${(await resp.text()).slice(0, 200)}`);
      throw new Error("Não foi possível confirmar a senha agora.");
    }
    const sessao = (await resp.json()) as { access_token?: string; user?: { id?: string } };
    // Encerra a sessão extra criada só para conferir a senha.
    if (sessao.access_token) {
      await fetch(`${url}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { apikey: chave, Authorization: `Bearer ${sessao.access_token}` },
      }).catch(() => undefined);
    }
    if (sessao.user?.id !== context.userId) throw new Error("Senha incorreta.");

    const validoAte = new Date(Date.now() + DESBLOQUEIO_PERMISSOES_MIN * 60_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("desbloqueios_permissoes").upsert({ user_id: context.userId, valido_ate: validoAte });
    if (error) throw new Error("Não foi possível liberar as permissões.");
    return { validoAte };
  });

/** Bloqueia de novo as permissões (ao sair da aba ou da tela). */
export const bloquearPermissoesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("desbloqueios_permissoes").delete().eq("user_id", context.userId);
    return { ok: true };
  });
