import { describe, expect, it } from "vitest";
import { resumoChamada, idsDoContador } from "./chamada";
import { situacaoDoAluno } from "./situacao";

describe("Marcar todos como presentes", () => {
  const status: Record<string, string> = { b: "falta", c: "falta_justificada" };
  const licenca = new Set(["d"]);
  const r = resumoChamada(["a", "b", "c", "d", "e"], (id) => !!status[id], (id) => licenca.has(id));

  it("marca só quem ainda não tem registro", () => {
    expect(r.pendentes).toEqual(["a", "e"]);
  });

  it("não muda faltas nem justificativas já lançadas", () => {
    expect(r.pendentes).not.toContain("b");
    expect(r.pendentes).not.toContain("c");
  });

  it("ignora alunos em licença médica", () => {
    expect(r.pendentes).not.toContain("d");
    expect(r.emLicenca).toBe(1);
  });

  it("conta X de Y marcados", () => {
    expect(r.marcados).toBe(2);
    expect(r.total).toBe(5);
  });

  it("sem pendentes quando todos já foram marcados", () => {
    expect(resumoChamada(["a"], () => true, () => false).pendentes).toEqual([]);
  });
});

describe("Situação do aluno", () => {
  const vencido = { ativo: true, atestado_entregue: true, atestado_data: "2020-01-01" };
  it("inativo fica cinza mesmo com licença", () => {
    expect(situacaoDoAluno({ ...vencido, ativo: false }, true)).toBe("inativo");
  });
  it("licença médica vem antes do atestado vencido", () => {
    expect(situacaoDoAluno(vencido, true)).toBe("licenca");
  });
  it("atestado vencido", () => {
    expect(situacaoDoAluno(vencido, false)).toBe("atestado_vencido");
  });
  it("ativo", () => {
    expect(situacaoDoAluno({ ativo: true, atestado_entregue: false, atestado_data: null }, false)).toBe("ativo");
  });
});

describe("Resumo do dia", () => {
  it("conta cada aluno uma vez; licença vale mais que o registro", async () => {
    const { resumoDoDia } = await import("./chamada");
    const st: Record<string, string> = { a: "presente", b: "falta", c: "falta_justificada", d: "falta_justificada" };
    const r = resumoDoDia(["a", "b", "c", "d", "e", "a"], (id) => st[id], (id) => id === "d");
    expect(r).toEqual({ presentes: 1, faltas: 1, justificadas: 1, licenca: 1, semMarcacao: 1 });
  });
});

describe("Alunos nas listas dos contadores", () => {
  const ids = ["aluno-presente", "aluno-falta", "aluno-justificado", "aluno-licenca", "aluno-pendente"];
  const registros = { "aluno-presente": "presente", "aluno-falta": "falta", "aluno-justificado": "falta_justificada", "aluno-licenca": "falta_justificada" };
  const status = (id: string) => registros[id as keyof typeof registros];
  const licenca = (id: string) => id === "aluno-licenca";
  it.each([
    ["presentes", ["aluno-presente"]],
    ["faltas", ["aluno-falta"]],
    ["justificadas", ["aluno-justificado"]],
    ["licenca", ["aluno-licenca"]],
    ["semMarcacao", ["aluno-pendente"]],
    ["marcados", ids.slice(0, 4)],
  ] as const)("seleciona os IDs corretos em %s sem alterar os registros", (contador, esperado) => {
    const antes = { ...registros };
    expect(idsDoContador(ids, contador, status, licenca)).toEqual(esperado);
    expect(registros).toEqual(antes);
  });
});
