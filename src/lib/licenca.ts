/** Regras da licença médica do aluno (browser-safe). */

export type LicencaMedica = {
  id: string;
  aluno_id: string;
  data_inicio: string;
  data_retorno: string;
  motivo: string | null;
  anexo_path: string | null;
  status: string;
  concluida_em?: string | null;
  liberacao_path?: string | null;
  created_at?: string;
};

export function dataISO(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function somarDias(inicio: string, dias: number) {
  const d = new Date(`${inicio}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

export function formatarDataCurta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Licença ativa cobrindo a data (inclusive início e retorno previsto). */
export function licencaVigente(l: Pick<LicencaMedica, "status" | "data_inicio" | "data_retorno">, data: string) {
  return l.status === "ativa" && l.data_inicio <= data && data <= l.data_retorno;
}

/** Licença ainda ativa, mas cujo retorno previsto já passou: coordenação precisa confirmar. */
export function licencaTerminada(l: Pick<LicencaMedica, "status" | "data_retorno">, hoje: string) {
  return l.status === "ativa" && l.data_retorno < hoje;
}

/** Durante a licença o aluno não entra no alerta de faltas. */
export function ignorarNoAlertaFaltas(licencas: LicencaMedica[], alunoId: string, hoje: string) {
  return licencas.some((l) => l.aluno_id === alunoId && l.status === "ativa" && l.data_inicio <= hoje);
}
