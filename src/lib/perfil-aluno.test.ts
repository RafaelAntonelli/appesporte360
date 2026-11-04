import { describe, expect, it } from "vitest";
import { idadeNaData, textoNascimento } from "./perfil-aluno";

const hoje = new Date(2026, 10, 4); // 04/11/2026

describe("Meu perfil do aluno", () => {
  it("mostra a data de nascimento com a idade entre parênteses", () => {
    expect(textoNascimento("2012-03-12", null, hoje)).toBe("12/03/2012 (14 anos)");
  });

  it("só completa o ano no dia do aniversário", () => {
    expect(idadeNaData("2012-11-05", hoje)).toBe(13);
    expect(idadeNaData("2012-11-04", hoje)).toBe(14);
  });

  it("sem data de nascimento, não inventa uma data", () => {
    expect(textoNascimento(null, null, hoje)).toBeNull();
    expect(textoNascimento(null, 30, hoje)).toBe("30 anos");
  });
});
