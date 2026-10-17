import { z } from "zod";

export const CAMPOS_FICHA = {
  nome: "Nome",
  data_nascimento: "Data de nascimento",
  idade: "Idade",
  sexo: "Sexo",
  cpf: "CPF",
  rg: "RG",
  telefone: "Celular",
  telefone2: "Celular 2",
  email: "E-mail",
  responsavel: "Responsável",
  rede_ensino: "Rede de ensino",
  escola: "Escola",
} as const;
export const COLUNAS_IMPORTACAO = [
  "Nome",
  "Sexo",
  "Idade",
  "Nascimento",
  "CPF",
  "RG",
  "Celular",
  "Celular 2",
  "E-mail",
  "Responsável",
  "Rede de ensino",
  "Escola",
  "PCD",
  "Atestado",
  "Data do atestado",
  "Modalidade",
  "Turma",
  "Foto",
  "Observações",
] as const;
export const DIMENSOES = [
  "situacao",
  "sexo",
  "faixa",
  "modalidade",
  "horario",
  "dias",
  "turno",
  "pcd",
  "rede_ensino",
  "escola",
] as const;
export type Dimensao = (typeof DIMENSOES)[number];
export const ROTULOS: Record<Dimensao, string> = {
  situacao: "Situação",
  sexo: "Sexo",
  faixa: "Faixa etária",
  modalidade: "Modalidade",
  horario: "Horário",
  dias: "Dias",
  turno: "Turno",
  pcd: "PCD",
  rede_ensino: "Rede de ensino",
  escola: "Escola",
};
export const planoSchema = z
  .object({
    respondivel: z.boolean(),
    limitacao: z.string().nullable(),
    filtros: z.array(z.object({ campo: z.enum(DIMENSOES), valores: z.array(z.string()) }).strict()),
    grupos: z.array(z.enum(DIMENSOES)),
    idadeMin: z.number().nullable(),
    idadeMax: z.number().nullable(),
    metricas: z.array(z.enum(["total", "media", "mediana", "minima", "maxima", "percentual"])),
  })
  .strict();
export type PlanoRelatorio = z.infer<typeof planoSchema>;
export const fichaSchema = z
  .object({
    campos: z.array(
      z
        .object({
          campo: z.enum(
            Object.keys(CAMPOS_FICHA) as [
              keyof typeof CAMPOS_FICHA,
              ...(keyof typeof CAMPOS_FICHA)[],
            ],
          ),
          valor: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export const mapaSchema = z
  .object({
    correspondencias: z.array(
      z.object({ cabecalho: z.string(), campo: z.enum(COLUNAS_IMPORTACAO).nullable() }).strict(),
    ),
  })
  .strict();
export type ResultadoIA<T> =
  { ok: true; resultado: T } | { ok: false; erro: string; status: number; bloqueado: boolean };
export const mensagemSchema = z.object({ texto: z.string() }).strict();
