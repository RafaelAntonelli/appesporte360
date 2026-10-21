import { describe, expect, it } from "vitest";
import { resumoChamada } from "./chamada";
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
