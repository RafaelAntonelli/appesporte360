import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/auth";

export type MembroEquipe = {
  id: string;
  nome: string | null;
  email: string | null;
  roles: AppRole[];
  criadoEm: string;
  ultimoAcesso: string | null;
};

export const listarEquipeFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error: adminError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (adminError || !admin) throw new Error("Apenas administradores podem consultar a equipe.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usuarios = [];
    let pagina = 1;

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
      if (error) throw new Error("Não foi possível carregar os usuários.");
      usuarios.push(...data.users);
      if (data.users.length < 1000) break;
      pagina += 1;
    }

    const ids = usuarios.map((usuario) => usuario.id);
    const { data: papeis, error: papeisError } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids)
      : { data: [], error: null };
    if (papeisError) throw new Error("Não foi possível carregar os acessos da equipe.");

    const papeisPorUsuario = new Map<string, AppRole[]>();
    for (const papel of papeis ?? []) {
      const role = papel.role as AppRole;
      papeisPorUsuario.set(papel.user_id, [...(papeisPorUsuario.get(papel.user_id) ?? []), role]);
    }

    return usuarios.map((usuario): MembroEquipe => {
      const metadados = usuario.user_metadata;
      const nomeInformado =
        typeof metadados?.["nome"] === "string"
          ? metadados["nome"]
          : typeof metadados?.["full_name"] === "string"
            ? metadados["full_name"]
            : null;

      return {
        id: usuario.id,
        nome: nomeInformado,
        email: usuario.email ?? null,
        roles: papeisPorUsuario.get(usuario.id) ?? [],
        criadoEm: usuario.created_at,
        ultimoAcesso: usuario.last_sign_in_at ?? null,
      };
    });
  });

export const removerContaPendenteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (typeof input?.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.userId)) throw new Error("Conta inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Apenas administradores podem remover contas.");
    if (data.userId === context.userId) throw new Error("Você não pode remover a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: papeis, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (error) throw new Error("Não foi possível verificar a conta.");
    if ((papeis ?? []).length > 0) throw new Error("Só é possível remover contas que ainda não foram liberadas.");
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delError) throw new Error("Não foi possível remover a conta.");
    return { ok: true };
  });
