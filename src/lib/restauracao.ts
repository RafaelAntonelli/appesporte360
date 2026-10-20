/** Regras da restauração a partir da planilha de backup (sem acesso ao servidor). */

export type AlunoRestaurado = {
  codigo: string;
  nome: string;
  sexo: string | null;
  idade: number | null;
  faixa_etaria: string | null;
  data_nascimento: string | null;
  cpf: string | null;
  rg: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  responsavel: string | null;
  rede_ensino: string | null;
  escola: string | null;
  pcd: boolean;
  pcd_condicoes: string[];
  pcd_descricao: string | null;
  atestado_entregue: boolean;
  atestado_data: string | null;
  ativo: boolean;
  motivo_inativacao: string | null;
  observacoes: string | null;
};

export type LinhaRestauracao = { aluno: AlunoRestaurado; turmas: string[]; modalidade: string | null };

/** Código de matrícula válido: 7 letras/números maiúsculos. */
export function codigoMatriculaValido(valor: string) {
  return /^[A-Z0-9]{7}$/.test(valor) && /[A-Z]/.test(valor) && /[0-9]/.test(valor);
}

function texto(v: unknown) {
  const t = String(v ?? "").trim();
  return t ? t : null;
}

/** Aceita AAAA-MM-DD, DD/MM/AAAA ou uma data do Excel e devolve AAAA-MM-DD. */
export function dataDaPlanilha(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  const t = String(valor ?? "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br?.[1] && br[2] && br[3]) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

const sim = (v: unknown) => /^(sim|s|true|1|x)$/i.test(String(v ?? "").trim());

/**
 * Converte uma linha da planilha (cabeçalho → valor) em dados do aluno.
 * Devolve null quando a linha não tem código de matrícula válido ou nome.
 */
export function linhaParaAluno(linha: Record<string, unknown>): LinhaRestauracao | null {
  const codigo = String(linha["Matrícula"] ?? "").trim().toUpperCase();
  const nome = texto(linha["Nome"]);
  if (!codigoMatriculaValido(codigo) || !nome) return null;
  const idade = Number(linha["Idade"]);
  const condicoes = String(linha["Condições PCD"] ?? "")
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  return {
    aluno: {
      codigo,
      nome,
      sexo: texto(linha["Sexo"]),
      idade: Number.isFinite(idade) && idade > 0 ? Math.round(idade) : null,
      faixa_etaria: texto(linha["Faixa etária"]),
      data_nascimento: dataDaPlanilha(linha["Nascimento"]),
      cpf: texto(linha["CPF"]),
      rg: texto(linha["RG"]),
      telefone: texto(linha["Celular"]),
      telefone2: texto(linha["Celular 2"]),
      email: texto(linha["E-mail"]),
      responsavel: texto(linha["Responsável"]),
      rede_ensino: texto(linha["Rede de ensino"]),
      escola: texto(linha["Escola"]),
      pcd: sim(linha["PCD"]),
      pcd_condicoes: condicoes,
      pcd_descricao: texto(linha["Descrição PCD"]),
      atestado_entregue: sim(linha["Atestado entregue"]),
      atestado_data: dataDaPlanilha(linha["Data do atestado"]),
      ativo: String(linha["Situação"] ?? "").trim().toLowerCase() !== "inativo",
      motivo_inativacao: texto(linha["Motivo da inativação"]),
      observacoes: texto(linha["Observações"]),
    },
    turmas: String(linha["Turma"] ?? "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean),
    modalidade: texto(linha["Modalidade"]),
  };
}
