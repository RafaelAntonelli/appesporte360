import { describe, it, expect, vi } from "vitest";
import { exigirPermissaoIA } from "./permissao";
describe("proteção das ações de IA", () => {
  for (const chave of ["cadastrar_alunos", "editar_alunos", "ver_relatorios"])
    it(`recusa acesso direto sem ${chave}`, async () => {
      const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
      await expect(exigirPermissaoIA({ rpc }, "usuario", [chave])).rejects.toMatchObject({
        status: 403,
      });
      expect(rpc).toHaveBeenCalledWith("pode", { _user_id: "usuario", _permissao: chave });
    });
  it("importação que atualiza exige também editar alunos", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await expect(
      exigirPermissaoIA({ rpc }, "usuario", ["cadastrar_alunos", "editar_alunos"]),
    ).rejects.toThrow("permissão");
  });
  it("falha na consulta não concede acesso", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: { message: "offline" } });
    await expect(exigirPermissaoIA({ rpc }, "usuario", ["ver_relatorios"])).rejects.toThrow(
      "permissão",
    );
  });
});
