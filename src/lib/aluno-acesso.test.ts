import { describe, expect, it } from "vitest";
import {
  AVISO_MENSAGEM_MAX,
  AVISO_TITULO_MAX,
  FOTO_MAX_BYTES,
  MENSAGENS_ACESSO,
  VALIDADE_LIBERACAO_DIAS,
  VALIDADE_PEDIDO_MIN,
  codigoAparelhoValido,
  conteudoQrAparelho,
  gerarCodigoAparelho,
  normalizarCodigoAparelho,
  normalizarIdentificador,
  resolverAluno,
  situacaoAtestado,
  tentativasExcedidas,
  tipoDaFoto,
  validarAviso,
  validarFoto,
} from "./aluno-acesso";

describe("limite de tentativas", () => {
  it("bloqueia na 60ª tentativa da mesma rede em 15 minutos", () => {
    expect(tentativasExcedidas(59, 0)).toBe(false);
    expect(tentativasExcedidas(60, 0)).toBe(true);
  });
  it("bloqueia na 10ª tentativa do mesmo aparelho", () => {
    expect(tentativasExcedidas(0, 9)).toBe(false);
    expect(tentativasExcedidas(0, 10)).toBe(true);
  });
  it("usa a mensagem pedida", () => {
    expect(MENSAGENS_ACESSO.muitasTentativas).toBe("Muitas tentativas. Aguarde 15 minutos.");
  });
});

describe("identificação do aluno", () => {
  it("aceita CPF com ou sem pontuação", () => {
    expect(normalizarIdentificador("123.456.789-09")).toEqual({ tipo: "cpf", valor: "12345678909" });
    expect(normalizarIdentificador("12345678909")).toEqual({ tipo: "cpf", valor: "12345678909" });
  });
  it("aceita código de matrícula de 7 caracteres", () => {
    expect(normalizarIdentificador("ab12cd3")).toEqual({ tipo: "codigo", valor: "AB12CD3" });
  });
  it("recusa entradas incompletas", () => {
    expect(normalizarIdentificador("123")).toBeNull();
  });
  it("só entra com um único cadastro ativo", () => {
    expect(resolverAluno([{ id: "a", ativo: true }])).toEqual({ tipo: "ok", id: "a" });
    expect(resolverAluno([{ id: "a", ativo: true }, { id: "b", ativo: true }])).toEqual({ tipo: "nao_confere" });
    expect(resolverAluno([{ id: "a", ativo: false }])).toEqual({ tipo: "inativo" });
    expect(resolverAluno([])).toEqual({ tipo: "nao_confere" });
  });
  it("aluno inativo recebe a orientação da administração", () => {
    expect(MENSAGENS_ACESSO.inativo).toBe("Compareça à administração para regularizar seu cadastro.");
    expect(MENSAGENS_ACESSO.procureAdministracao).toBe("Procure a administração!");
  });
});

describe("código do aparelho", () => {
  it("tem 8 caracteres e o QR não leva dados pessoais", () => {
    const codigo = gerarCodigoAparelho((n) => new Uint8Array(n).map((_, i) => i * 37));
    expect(codigoAparelhoValido(codigo)).toBe(true);
    expect(conteudoQrAparelho(codigo)).toBe(`E360-APARELHO:${codigo}`);
    expect(normalizarCodigoAparelho(conteudoQrAparelho(codigo))).toBe(codigo);
  });
  it("pedido vale 30 minutos e liberação 180 dias", () => {
    expect(VALIDADE_PEDIDO_MIN).toBe(30);
    expect(VALIDADE_LIBERACAO_DIAS).toBe(180);
  });
});

describe("avisos", () => {
  it("título até 100 e mensagem até 1000 caracteres", () => {
    expect(AVISO_TITULO_MAX).toBe(100);
    expect(AVISO_MENSAGEM_MAX).toBe(1000);
    expect(validarAviso("a".repeat(100), "ok")).toBeNull();
    expect(validarAviso("a".repeat(101), "ok")).not.toBeNull();
    expect(validarAviso("ok", "a".repeat(1000))).toBeNull();
    expect(validarAviso("ok", "a".repeat(1001))).not.toBeNull();
  });
});

describe("foto do perfil", () => {
  it("aceita JPG, PNG e WebP de até 5 MB", () => {
    expect(FOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(validarFoto(FOTO_MAX_BYTES, "image/jpeg")).toBeNull();
    expect(validarFoto(FOTO_MAX_BYTES + 1, "image/png")).not.toBeNull();
    expect(validarFoto(1000, "image/gif")).not.toBeNull();
  });
  it("reconhece o tipo pelo conteúdo", () => {
    expect(tipoDaFoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(tipoDaFoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(tipoDaFoto(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(tipoDaFoto(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });
});

describe("situação do atestado", () => {
  it("classifica sem expor detalhes médicos", () => {
    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const recente = iso(hoje);
    const antigo = new Date(hoje);
    antigo.setFullYear(antigo.getFullYear() - 2);
    const quase = new Date(hoje);
    quase.setFullYear(quase.getFullYear() - 1);
    quase.setDate(quase.getDate() + 10);
    expect(situacaoAtestado({ atestado_entregue: true, atestado_data: recente })).toBe("valido");
    expect(situacaoAtestado({ atestado_entregue: true, atestado_data: iso(antigo) })).toBe("vencido");
    expect(situacaoAtestado({ atestado_entregue: true, atestado_data: iso(quase) })).toBe("vencendo");
    expect(situacaoAtestado({ atestado_entregue: false, atestado_data: null })).toBe("nao_entregue");
  });
});
