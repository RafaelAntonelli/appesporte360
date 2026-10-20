import { describe, expect, it } from "vitest";
import { agoraEmBrasilia, inicioDaAula, lembretesDevidos } from "@/lib/lembretes";

const turma = { id: "t1", modalidade: "Vôlei", dias_semana: ["Ter", "Qui"], horario: "16:00 às 17:00" };

describe("lembretes de aula", () => {
  it("lê o início dos horários cadastrados", () => {
    expect(inicioDaAula("16:00 às 17:30")).toBe(960);
    expect(inicioDaAula("17 às 18:30")).toBe(1020);
    expect(inicioDaAula("16;00 às 17:30")).toBe(960);
    expect(inicioDaAula("")).toBeNull();
  });

  it("envia o lembrete de 30 minutos antes", () => {
    const r = lembretesDevidos([turma], { dia: "ter", minutos: 15 * 60 + 30 });
    expect(r).toHaveLength(1);
    expect(r[0]?.antecedencia).toBe(30);
  });

  it("envia o lembrete de 15 minutos antes", () => {
    const r = lembretesDevidos([turma], { dia: "ter", minutos: 15 * 60 + 45 });
    expect(r[0]?.antecedencia).toBe(15);
  });

  it("não envia fora das janelas, em outro dia ou para turma inativa", () => {
    expect(lembretesDevidos([turma], { dia: "ter", minutos: 15 * 60 + 42 })).toHaveLength(0);
    expect(lembretesDevidos([turma], { dia: "ter", minutos: 15 * 60 })).toHaveLength(0);
    expect(lembretesDevidos([turma], { dia: "qua", minutos: 15 * 60 + 30 })).toHaveLength(0);
    expect(lembretesDevidos([{ ...turma, ativa: false }], { dia: "ter", minutos: 15 * 60 + 30 })).toHaveLength(0);
  });

  it("usa o horário de Brasília", () => {
    // 18:30 UTC de uma terça = 15:30 em Brasília
    expect(agoraEmBrasilia(new Date("2026-10-20T18:30:00Z"))).toEqual({ data: "2026-10-20", dia: "ter", minutos: 930 });
  });
});
