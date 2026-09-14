import { describe, expect, it } from "vitest";
import { encontrarAlunoDuplicado, type AlunoBasico } from "@/lib/duplicidade";

const base: AlunoBasico[] = [
  { id: "1", nome: "Maria Silva", cpf: "529.982.247-25", data_nascimento: "2010-05-10" },
  { id: "2", nome: "João Souza", cpf: null, data_nascimento: "2012-03-01" },
];

describe("encontrarAlunoDuplicado", () => {
  it("permite CPF igual (CPF do responsável usado por vários alunos)", () => {
    expect(encontrarAlunoDuplicado({ nome: "Outro Nome", cpf: "52998224725" }, base)).toBeNull();
  });

  it("permite irmãos com o mesmo CPF do responsável e datas diferentes", () => {
    const dados = { nome: "Maria Silva", cpf: "529 982 247 25", data_nascimento: "2014-02-02" };
    expect(encontrarAlunoDuplicado(dados, base)).toBeNull();
  });


  it("bloqueia nome + data de nascimento iguais sem CPF", () => {
    const dup = encontrarAlunoDuplicado({ nome: "joão souza", data_nascimento: "2012-03-01" }, base);
    expect(dup?.id).toBe("2");
  });

  it("permite mesmo nome com data de nascimento diferente", () => {
    expect(encontrarAlunoDuplicado({ nome: "João Souza", data_nascimento: "2015-08-20" }, base)).toBeNull();
  });

  it("permite alunos diferentes que compartilham o mesmo telefone", () => {
    const irmaos = [{ id: "3", nome: "Ana Lima", cpf: null, data_nascimento: "2011-01-02" }];
    // telefone não faz parte do critério: irmãos com o mesmo contato podem ser salvos
    expect(encontrarAlunoDuplicado({ nome: "Pedro Lima", data_nascimento: "2013-07-09" }, irmaos)).toBeNull();
  });

  it("não considera duplicado o próprio aluno em edição", () => {
    const dup = encontrarAlunoDuplicado(
      { nome: "Maria Silva", cpf: "52998224725", data_nascimento: "2010-05-10" },
      base,
      "1",
    );
    expect(dup).toBeNull();
  });

  it("não bloqueia quando apenas o nome é igual e falta data de nascimento", () => {
    expect(encontrarAlunoDuplicado({ nome: "Maria Silva" }, base)).toBeNull();
  });
});
