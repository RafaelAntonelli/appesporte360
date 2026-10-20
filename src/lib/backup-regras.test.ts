import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { lerNomeArquivoDrive, nomeArquivoDrive } from "./arquivos-drive";
import { validadeLinksHoras } from "./links-seguros";
import { dimensoesOtimizadas } from "./imagem";
import { linhaParaAluno } from "./restauracao";
import { ordemFila, proximaSequencia } from "./offline";
import { chaveLinkDrive, montarPlanilhaAlunos } from "./planilha-alunos";

describe("nomes dos arquivos no Drive", () => {
  it("segue o padrão CODIGO_TIPO.extensão", () => {
    expect(nomeArquivoDrive("A7B92K1", "doc_atestado_path", "x/doc_atestado_path-1.pdf")).toBe("A7B92K1_atestado.pdf");
    expect(nomeArquivoDrive("A7B92K1", "foto_path", "x/123.jpeg")).toBe("A7B92K1_foto.jpg");
    expect(nomeArquivoDrive("A7B92K1", "doc_residencia_path", "x/a.pdf")).toBe("A7B92K1_comprovante_residencia.pdf");
    expect(nomeArquivoDrive("A7B92K1", "doc_identidade_path", "x/a.pdf")).toBe("A7B92K1_identidade.pdf");
    expect(nomeArquivoDrive("A7B92K1", "doc_ficha_path", "x/a.jpg")).toBe("A7B92K1_ficha.jpg");
  });

  it("lê o código de matrícula e o tipo do nome do arquivo", () => {
    expect(lerNomeArquivoDrive("A7B92K1_comprovante_residencia.pdf")).toMatchObject({
      codigo: "A7B92K1",
      campo: "doc_residencia_path",
      extensao: "pdf",
    });
    expect(lerNomeArquivoDrive("A7B92K1_foto.jpg")?.campo).toBe("foto_path");
  });

  it("ignora nomes fora do padrão", () => {
    expect(lerNomeArquivoDrive("Maria - Foto [a1b2c3d4-foto].jpg")).toBeNull();
    expect(lerNomeArquivoDrive("A7B92K1_boletim.pdf")).toBeNull();
    expect(lerNomeArquivoDrive("A7B92_foto.jpg")).toBeNull();
  });
});

describe("validade dos links", () => {
  it("usa 24 horas por padrão e nunca passa de 24 horas", () => {
    expect(validadeLinksHoras(undefined)).toBe(24);
    expect(validadeLinksHoras("6")).toBe(6);
    expect(validadeLinksHoras(240)).toBe(24);
    expect(validadeLinksHoras(0)).toBe(24);
  });
});

describe("otimização de imagens", () => {
  it("limita o lado maior a 1600 px mantendo a proporção", () => {
    expect(dimensoesOtimizadas(4000, 3000)).toEqual({ largura: 1600, altura: 1200, reduzida: true });
    expect(dimensoesOtimizadas(800, 600)).toEqual({ largura: 800, altura: 600, reduzida: false });
  });
});

describe("restauração pela planilha", () => {
  it("usa o código de matrícula e os dados cadastrais da linha", () => {
    const r = linhaParaAluno({
      Matrícula: "a7b92k1",
      Nome: "Ana Souza",
      Nascimento: "2012-03-05",
      PCD: "Sim",
      "Condições PCD": "TEA | TDAH",
      Situação: "Inativo",
      Turma: "Vôlei — Terça e Quinta — 16:00",
    });
    expect(r?.aluno).toMatchObject({ codigo: "A7B92K1", nome: "Ana Souza", data_nascimento: "2012-03-05", pcd: true, ativo: false });
    expect(r?.aluno.pcd_condicoes).toEqual(["TEA", "TDAH"]);
    expect(r?.turmas).toEqual(["Vôlei — Terça e Quinta — 16:00"]);
  });

  it("ignora linhas sem código de matrícula válido", () => {
    expect(linhaParaAluno({ Matrícula: "", Nome: "Sem código" })).toBeNull();
    expect(linhaParaAluno({ Matrícula: "ABCDEFG", Nome: "Sem número" })).toBeNull();
  });
});

describe("fila offline", () => {
  it("mantém a ordem exata mesmo com o mesmo horário ou relógio voltando", () => {
    const s1 = proximaSequencia(1000, 0);
    const s2 = proximaSequencia(1000, s1);
    const s3 = proximaSequencia(900, s2);
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);
    const fila = [
      { criado_em: 900, sequencia: s3 },
      { criado_em: 1000, sequencia: s1 },
      { criado_em: 1000, sequencia: s2 },
    ].sort(ordemFila);
    expect(fila.map((f) => f.sequencia)).toEqual([s1, s2, s3]);
  });
});

describe("planilha do backup", () => {
  it("tem o código de matrícula e nenhuma coluna de link", async () => {
    const id = "12345678-1234-1234-1234-123456789012";
    const buffer = await montarPlanilhaAlunos({
      alunos: [{ id, codigo: "A7B92K1", nome: "Aluno teste", foto_path: `${id}/f.jpg` }],
      turmaDoAluno: () => undefined,
      modalidadeDoAluno: () => "Vôlei",
      linksDrive: async () => ({ [chaveLinkDrive(id, "foto_path")]: "https://example.org/f.jpg" }),
      incluirLinks: false,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet("Alunos")!;
    const cabecalho = (ws.getRow(1).values as string[]).filter(Boolean);
    expect(cabecalho.some((c) => c.startsWith("Link - "))).toBe(false);
    expect(ws.getCell(2, cabecalho.indexOf("Matrícula") + 1).value).toBe("A7B92K1");
  });
});
