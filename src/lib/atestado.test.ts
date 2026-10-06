import { afterEach, describe, expect, it, vi } from "vitest";
import { notificarAtestadoVencido, notificarAtestadoVencendo } from "./atestado";

afterEach(() => vi.useRealTimers());

describe("notificações de atestados", () => {
  it("exclui alunos inativados dos atestados vencidos, mantendo os ativos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00"));
    const aluno = { ativo: false, atestado_entregue: true, atestado_data: "2025-09-01" };
    expect(notificarAtestadoVencido(aluno)).toBe(false);
    expect(notificarAtestadoVencido({ ...aluno, ativo: true })).toBe(true);
  });

  it("exclui alunos inativados dos atestados vencendo, mantendo os ativos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00"));
    const aluno = { ativo: false, atestado_entregue: true, atestado_data: "2025-10-20" };
    expect(notificarAtestadoVencendo(aluno, 30)).toBe(false);
    expect(notificarAtestadoVencendo({ ...aluno, ativo: true }, 30)).toBe(true);
  });
});