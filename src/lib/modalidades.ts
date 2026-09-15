export const MODALIDADES = [
  "Vôlei",
  "Futevôlei",
  "Capoeira",
  "Karatê",
  "Futebol de Campo",
  "Ballet",
  "Ginástica Rítmica",
  "Funcional/Pilates",
  "Boxe",
  "Breaking",
  "Ritbox",
  "Skate",
  "Basquete",
  "Futsal",
] as const;

export const MODALIDADE_PADRAO = MODALIDADES[0];

export function normalizarModalidade(valor: string): string {
  const texto = valor.trim();
  if (!texto) return "";
  const chave = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return MODALIDADES.find(
    (modalidade) => modalidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === chave,
  ) ?? "";
}