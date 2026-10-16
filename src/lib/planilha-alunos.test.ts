import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { chaveLinkDrive, montarPlanilhaAlunos } from "./planilha-alunos";

describe("foto da Ficha na planilha", () => {
  it("exporta o link da ficha anexada ao aluno", async () => {
    const id = "12345678-1234-1234-1234-123456789012";
    const url = "https://example.org/ficha.jpg";
    const buffer = await montarPlanilhaAlunos({
      alunos: [{ id, nome: "Aluno teste", doc_ficha_path: `${id}/ficha.jpg` }],
      turmaDoAluno: () => undefined,
      modalidadeDoAluno: () => "Vôlei",
      linksDrive: async () => ({ [chaveLinkDrive(id, "doc_ficha_path")]: url }),
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Alunos");
    if (!sheet) throw new Error("Planilha não gerada");
    const headers = sheet.getRow(1).values as string[];
    const column = headers.indexOf("Link - Ficha");
    expect(column).toBeGreaterThan(0);
    expect(sheet.getCell(2, column).value).toEqual({ text: "Ficha - Aluno teste", hyperlink: url });
  });
});