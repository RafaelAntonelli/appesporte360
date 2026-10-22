import { describe, expect, it } from "vitest";
import { numeroBR, resumoTurmas } from "./turmas-resumo";

describe("resumoTurmas", () => {
  const turmas = [
    { id: "a", ativa: true, capacidade: 40 },
    { id: "b", ativa: true, capacidade: 25 },
    { id: "c", ativa: false, capacidade: 30 },
  ];
  const contagem = { a: 38, b: 10, c: 12 };

  it("conta só as turmas ativas como abertas", () => {
    expect(resumoTurmas(turmas, contagem).abertas).toBe(2);
  });

  it("soma a capacidade só das turmas ativas", () => {
    expect(resumoTurmas(turmas, contagem).vagas).toBe(65);
  });

  it("soma as matrículas das turmas ativas com a mesma contagem dos cartões", () => {
    expect(resumoTurmas(turmas, contagem).ocupadas).toBe(48);
  });

  it("turma sem matrícula conta zero", () => {
    expect(resumoTurmas([{ id: "x", ativa: true, capacidade: 20 }], {}).ocupadas).toBe(0);
  });
});

describe("numeroBR", () => {
  it("usa ponto como separador de milhar", () => {
    expect(numeroBR(1219)).toBe("1.219");
  });
});
