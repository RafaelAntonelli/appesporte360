export const TURNOS = ["Matutino", "Vespertino", "Noturno"] as const;

export type Turno = (typeof TURNOS)[number];

export function turnoDoHorario(horario: string | null | undefined): Turno | "" {
  const m = (horario ?? "").match(/(\d{1,2})\s*[:h]?/);
  if (!m?.[1]) return "";
  const hora = Number(m[1]);
  if (Number.isNaN(hora)) return "";
  if (hora < 12) return "Matutino";
  if (hora < 18) return "Vespertino";
  return "Noturno";
}

export function idadePorNascimento(data: string | null | undefined) {
  if (!data) return "";
  const nasc = new Date(`${data}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  if (idade < 0 || idade > 120) return "";
  return String(idade);
}

export const FAIXAS_ETARIAS = ["Criança", "Adolescente", "Adulto", "Idoso"] as const;

export type FaixaEtaria = (typeof FAIXAS_ETARIAS)[number];

/** Faixa etária conforme o ECA: criança 0-11, adolescente 12-17, adulto 18-59, idoso a partir de 60. */
export function faixaEtariaECA(dataNascimento: string | null | undefined, idadeInformada?: string | number | null): FaixaEtaria | "" {
  const calculada = idadePorNascimento(dataNascimento);
  const idade = calculada !== "" ? Number(calculada) : Number(idadeInformada ?? NaN);
  if (!Number.isFinite(idade) || idade < 0) return "";
  if (idade < 12) return "Criança";
  if (idade < 18) return "Adolescente";
  if (idade < 60) return "Adulto";
  return "Idoso";
}

