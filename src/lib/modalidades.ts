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
  const normalizada = MODALIDADES.find((modalidade) => {
    const nome = modalidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return chave === nome || chave.includes(nome);
  });
  if (normalizada) return normalizada;
  if (/futevolei/.test(chave)) return "Futevôlei";
  if (/futebol.*campo|campo.*futebol/.test(chave)) return "Futebol de Campo";
  if (/ginastica.*ritmica/.test(chave)) return "Ginástica Rítmica";
  if (/funcional|pilates/.test(chave)) return "Funcional/Pilates";
  return "";
}