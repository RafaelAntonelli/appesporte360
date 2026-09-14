const MINUSCULAS = ["de", "da", "das", "do", "dos", "e"];

export function capitalizarNome(valor: string) {
  return valor
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export function formatarCelular(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function celularValido(valor: string) {
  return valor.replace(/\D/g, "").length === 11;
}

export function formatarCPF(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function cpfValido(valor: string) {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9), 10) === Number(d[9]) && digito(d.slice(0, 10), 11) === Number(d[10]);
}

export function apenasDigitos(valor: string | null | undefined) {
  return (valor ?? "").replace(/\D/g, "");
}

/** Remove acentos e normaliza para comparação de busca. */
export function normalizarTexto(valor: string | null | undefined) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type AlvoBusca = {
  nome: string;
  cpf?: string | null;
  rg?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  responsavel?: string | null;
  codigo?: string | null;
};

/**
 * Busca tolerante: ignora acentos/maiúsculas, aceita termos em qualquer ordem
 * ("silva ana" acha "Ana Silva") e também procura por CPF/RG/telefone/código.
 */
export function correspondeBusca(alvo: AlvoBusca, busca: string) {
  const termos = normalizarTexto(busca).split(" ").filter(Boolean);
  if (!termos.length) return true;
  const nome = normalizarTexto(alvo.nome);
  const outros = normalizarTexto(`${alvo.responsavel ?? ""} ${alvo.codigo ?? ""}`);
  const numeros = [alvo.cpf, alvo.rg, alvo.telefone, alvo.telefone2].map(apenasDigitos).join(" ");
  return termos.every((t) => {
    if (nome.includes(t) || outros.includes(t)) return true;
    const d = t.replace(/\D/g, "");
    return d.length >= 3 && numeros.includes(d);
  });
}

/** Menor = mais relevante: nome exato < começa com < palavra começa com < contém. */
export function relevanciaBusca(nome: string, busca: string) {
  const n = normalizarTexto(nome);
  const b = normalizarTexto(busca);
  if (!b) return 4;
  if (n === b) return 0;
  if (n.startsWith(b)) return 1;
  if (n.split(" ").some((p) => p.startsWith(b))) return 2;
  if (n.includes(b)) return 3;
  return 4;
}
