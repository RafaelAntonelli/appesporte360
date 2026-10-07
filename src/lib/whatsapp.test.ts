import { describe, expect, it } from "vitest";
import { linkWhatsApp } from "./whatsapp";

describe("contato pelo celular registrado", () => {
  it("inclui o código do Brasil e remove a formatação do celular", () => {
    expect(linkWhatsApp("(71) 98765-4321")).toBe("https://wa.me/5571987654321");
  });
  it("mantém o código do Brasil quando já foi registrado", () => {
    expect(linkWhatsApp("+55 (71) 98765-4321")).toBe("https://wa.me/5571987654321");
  });
  it("não gera contato para celular ausente ou incompleto", () => {
    expect(linkWhatsApp(null)).toBeNull();
    expect(linkWhatsApp("98765-4321")).toBeNull();
    expect(linkWhatsApp("(00) 00000-0000")).toBeNull();
  });
  it("aceita telefone com DDD sem afirmar disponibilidade no WhatsApp", () => {
    expect(linkWhatsApp("(71) 3456-7890")).toBe("https://wa.me/557134567890");
  });
});