import { describe, expect, it } from "vitest";
import { avisosAtestadoDevidos, textoAvisoAtestado, vencimentoISO } from "./aviso-atestado";

const base = { ativo: true, atestado_entregue: true };

describe("Aviso de atestado vencendo para o aluno", () => {
  it("o atestado vale 1 ano a partir da data informada", () => {
    expect(vencimentoISO("2025-11-24")).toBe("2026-11-24");
  });
  it("avisa 7 dias antes e 1 dia antes", () => {
    const r = avisosAtestadoDevidos(
      [
        { id: "a", ...base, atestado_data: "2025-11-24" },
        { id: "b", ...base, atestado_data: "2025-11-18" },
        { id: "c", ...base, atestado_data: "2025-11-20" },
      ],
      "2026-11-17",
    );
    expect(r).toEqual([
      { alunoId: "a", vencimento: "2026-11-24", antecedencia: 7 },
      { alunoId: "b", vencimento: "2026-11-18", antecedencia: 1 },
    ]);
  });
  it("alunos inativos nunca recebem", () => {
    expect(avisosAtestadoDevidos([{ id: "a", ...base, ativo: false, atestado_data: "2025-11-24" }], "2026-11-17")).toEqual([]);
  });
  it("texto de 7 dias e de 1 dia", () => {
    expect(textoAvisoAtestado("2026-11-24", 7).mensagem).toBe(
      "Seu atestado vence em 7 dias (24/11/2026). Leve um novo atestado à administração para continuar nas aulas.",
    );
    expect(textoAvisoAtestado("2026-11-18", 1).mensagem).toContain("vence amanhã (18/11/2026)");
  });
});
