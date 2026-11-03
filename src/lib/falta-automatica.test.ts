import { describe, expect, it } from "vitest";
import {
  CONFIG_PADRAO,
  OPCOES_MINUTOS,
  prazoValido,
  textoConfirmacaoFaltaAutomatica,
  textoEstadoFaltaAutomatica,
} from "./falta-automatica";

describe("falta automática", () => {
  it("começa desligada, com prazo de 15 minutos", () => {
    expect(CONFIG_PADRAO).toEqual({ ativa: false, minutos: 15 });
  });

  it("oferece prazos de 5 a 60 minutos, de 5 em 5", () => {
    expect(OPCOES_MINUTOS).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(prazoValido(0)).toBe(false);
    expect(prazoValido(7)).toBe(false);
    expect(prazoValido(65)).toBe(false);
  });

  it("mostra o prazo escolhido no cartão e na confirmação", () => {
    expect(textoEstadoFaltaAutomatica({ ativa: true, minutos: 15 })).toBe(
      "Ligada: 15 minutos após o início de cada aula, quem ainda não tem registro recebe falta.",
    );
    expect(textoConfirmacaoFaltaAutomatica(25)).toContain("25 minutos após o início");
  });
});
