import { describe, expect, it } from "vitest";
import { ignorarNoAlertaFaltas, licencaTerminada, licencaVigente, somarDias } from "./licenca";

const l = { id: "1", aluno_id: "a", data_inicio: "2026-10-01", data_retorno: "2026-11-15", motivo: null, anexo_path: null, status: "ativa" };

describe("licença médica", () => {
  it("vale entre início e retorno previsto", () => {
    expect(licencaVigente(l, "2026-11-15")).toBe(true);
    expect(licencaVigente(l, "2026-11-16")).toBe(false);
    expect(licencaVigente({ ...l, status: "concluida" }, "2026-10-10")).toBe(false);
  });
  it("avisa quando o retorno previsto passou e não foi concluída", () => {
    expect(licencaTerminada(l, "2026-11-16")).toBe(true);
    expect(licencaTerminada(l, "2026-11-15")).toBe(false);
  });
  it("aluno em licença é ignorado no alerta de faltas", () => {
    expect(ignorarNoAlertaFaltas([l], "a", "2026-10-05")).toBe(true);
    expect(ignorarNoAlertaFaltas([{ ...l, status: "concluida" }], "a", "2026-10-05")).toBe(false);
  });
  it("período em dias calcula o retorno", () => {
    expect(somarDias("2026-10-01", 30)).toBe("2026-10-31");
  });
});
