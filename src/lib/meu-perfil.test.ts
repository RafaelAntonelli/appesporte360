import { describe, expect, it } from "vitest";
import { iniciaisDoNome, nomeDoUsuario, rotuloPapel } from "./meu-perfil";

describe("iniciaisDoNome", () => {
  it("usa a primeira letra do primeiro e do último nome", () => {
    expect(iniciaisDoNome("Telma Maria Aragão Silva")).toBe("TS");
  });
  it("nome único mostra uma letra", () => {
    expect(iniciaisDoNome("Rafael")).toBe("R");
  });
});

describe("nomeDoUsuario", () => {
  it("prefere o nome da conta, o mesmo usado nos registros", () => {
    expect(nomeDoUsuario({ id: "1", email: "a@b.com", user_metadata: { nome: "Rafael" } }, "Outro")).toBe("Rafael");
  });
  it("sem nome na conta, usa o do perfil e depois o e-mail", () => {
    expect(nomeDoUsuario({ id: "1", email: "ana@b.com", user_metadata: {} }, "Ana Lima")).toBe("Ana Lima");
    expect(nomeDoUsuario({ id: "1", email: "ana@b.com", user_metadata: {} }, null)).toBe("ana");
  });
});

describe("rotuloPapel", () => {
  it("mostra Administrador ou Professor", () => {
    expect(rotuloPapel(true)).toBe("Administrador");
    expect(rotuloPapel(false)).toBe("Professor");
  });
});
