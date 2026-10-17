/** Shared server guard, independent of UI and auth storage. */
export async function exigirPermissaoIA(
  db: {
    rpc: (
      nome: "pode",
      args: { _user_id: string; _permissao: string },
    ) => PromiseLike<{ data: boolean | null; error: unknown }>;
  },
  id: string,
  chaves: string[],
) {
  for (const chave of chaves) {
    const { data, error } = await db.rpc("pode", { _user_id: id, _permissao: chave });
    if (error || data !== true)
      throw Object.assign(new Error("Você não tem permissão para esta ação de IA."), {
        status: 403,
      });
  }
}
