import { describe, expect, it } from "vitest";
import { ordenarTurmasDoProfessor, temPermissao } from "./permissoes";

describe("permissões dos professores", () => {
  it("administrador pode tudo mesmo com a permissão desligada", () => {
    expect(temPermissao(true, false, { ver_relatorios: false }, "ver_relatorios")).toBe(true);
  });
  it("professor só pode o que estiver ligado", () => {
    expect(temPermissao(false, true, { registrar_presenca: true }, "registrar_presenca")).toBe(true);
    expect(temPermissao(false, true, { ver_relatorios: false }, "ver_relatorios")).toBe(false);
  });
  it("turmas do professor aparecem primeiro", () => {
    const r = ordenarTurmasDoProfessor([{ id: "a" }, { id: "b" }, { id: "c" }], new Set(["c"]));
    expect(r.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });
});
