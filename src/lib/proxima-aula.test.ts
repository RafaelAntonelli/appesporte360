import { describe, expect, it } from "vitest";
import { fimDaAula, proximaAula } from "./proxima-aula";

// 17/11/2026 é terça-feira. 12:00 UTC = 09:00 em Brasília.
const em = (hhmmBrasilia: string, dia = "2026-11-17") => new Date(`${dia}T${hhmmBrasilia}:00-03:00`);
const turmas = [
  { id: "1", nome: "Vôlei Terça 18:00", dias: ["Terça", "Quinta"], horario: "18:00 às 18:50" },
  { id: "2", nome: "Skate Quarta 07:00", dias: ["Quarta"], horario: "07:00 às 07:50" },
];

describe("Próxima aula", () => {
  it("hoje mais tarde", () => {
    expect(proximaAula(turmas, em("09:00"))?.texto).toBe("Hoje, 18:00 às 18:50");
  });
  it("aula em andamento continua sendo a próxima até terminar", () => {
    const r = proximaAula(turmas, em("18:30"));
    expect(r?.texto).toBe("Hoje, 18:00 às 18:50");
    expect(r?.emAndamento).toBe(true);
  });
  it("depois do fim passa para amanhã", () => {
    expect(proximaAula(turmas, em("18:50"))?.texto).toBe("Amanhã, 07:00 às 07:50");
  });
  it("mais adiante mostra o dia da semana e a data", () => {
    expect(proximaAula([turmas[1]!], em("08:00", "2026-11-17"))?.texto).toBe("Amanhã, 07:00 às 07:50");
    expect(proximaAula([turmas[1]!], em("08:00", "2026-11-16"))?.texto).toBe("Quarta-feira, 07:00 às 07:50 · 18/11");
  });
  it("sem fim informado considera 1 hora", () => {
    expect(fimDaAula("17:00")).toBe(18 * 60);
  });
});
