import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Armazenamento local (IndexedDB) para funcionamento sem internet
// ---------------------------------------------------------------------------

const DB_NOME = "arena-offline";
const DB_VERSAO = 1;
const STORE_FILA = "fila";
const STORE_CACHE = "cache";

/** Dados de controle de cada operação: ID único, horário UTC e posição na fila. */
type MetaFila = {
  id: string;
  /** Milissegundos desde 1970 (UTC). */
  criado_em: number;
  /** Mesmo horário em texto ISO 8601 (UTC). */
  criado_em_utc?: string;
  /** Posição estritamente crescente: define a ordem exata de envio. */
  sequencia?: number;
  conta_id?: string;
  tentativas?: number;
  ultimo_erro?: string | null;
};

export type OperacaoFila = MetaFila & (
  | { tipo: "presenca_remover"; aluno_id: string; turma_id: string | null; data: string; horario: string }
  | { tipo: "aluno_novo"; aluno: Record<string, unknown>; foto?: Blob | null; fotoNome?: string | null }
  | { tipo: "aluno_update"; aluno_id: string; dados: Record<string, unknown>; foto?: Blob | null; fotoNome?: string | null }
  | {
      tipo: "matriculas_sync";
      aluno_id: string;
      escolhas: { turma_id: string; modalidade: string }[];
      registrado_por?: string | null;
    }
  | {
      tipo: "presenca";
      aluno_id: string;
      turma_id: string | null;
      data: string;
      status: string;
      metodo: string;
      observacoes: string | null;
      horario: string;
    }
);

let conta: string | null = null;
export function contaAtual() { return conta; }
export function definirContaOffline(id: string | null) { conta = id; notificar(); }

function suportado() {
  return typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILA)) db.createObjectStore(STORE_FILA, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comStore<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    let resultado: T;
    req.onsuccess = () => { resultado = req.result as T; };
    req.onerror = () => reject(req.error);
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Não foi possível guardar no aparelho.")); };
    tx.oncomplete = () => { db.close(); resolve(resultado); };
  });
}

// ------------------------------- Cache de dados ----------------------------

export async function salvarCache(chave: string, valor: unknown, esperado = conta) {
  if (!suportado() || !esperado || conta !== esperado) throw new Error("A conta mudou ou não há armazenamento disponível.");
  await comStore(STORE_CACHE, "readwrite", (s) => s.put(valor, `${esperado}:${chave}`));
}

export async function lerCache<T>(chave: string): Promise<T | null> {
  if (!suportado() || !conta) return null;
  const esperado = conta;
  try {
    const v = await comStore<T>(STORE_CACHE, "readonly", (s) => s.get(`${esperado}:${chave}`));
    if (conta !== esperado) return null;
    return (v as T) ?? null;
  } catch {
    return null;
  }
}

// ------------------------------- Fila de sincronização ---------------------

const ouvintes = new Set<() => void>();

export function assinarFila(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function notificar() {
  ouvintes.forEach((f) => f());
}

/** Ordem de envio: posição na fila; registros antigos (sem posição) usam o horário. */
export function ordemFila(a: Pick<MetaFila, "criado_em" | "sequencia">, b: Pick<MetaFila, "criado_em" | "sequencia">) {
  const sa = a.sequencia ?? a.criado_em * 1000;
  const sb = b.sequencia ?? b.criado_em * 1000;
  return sa - sb || a.criado_em - b.criado_em;
}

/** Próxima posição: sempre maior que a última, mesmo se o relógio do aparelho voltar. */
export function proximaSequencia(agora: number, ultima: number) {
  return Math.max(agora * 1000, ultima + 1);
}

export async function listarFila(): Promise<OperacaoFila[]> {
  if (!suportado()) return [];
  const esperado = conta;
  try {
    const itens = await comStore<OperacaoFila[]>(STORE_FILA, "readonly", (s) => s.getAll());
    if (conta !== esperado) return [];
    return (itens ?? []).filter((o) => o.conta_id === esperado && Boolean(esperado)).sort(ordemFila);
  } catch {
    return [];
  }
}

type CamposControle = "conta_id" | "id" | "criado_em" | "criado_em_utc" | "sequencia" | "tentativas" | "ultimo_erro";
type SemMeta<T> = T extends unknown ? Omit<T, CamposControle> & { id?: string } : never;

let ultimaSequencia = 0;

export async function enfileirar(op: SemMeta<OperacaoFila>): Promise<string> {
  if (!conta) throw new Error("Entre na conta antes de guardar alterações.");
  const esperado = conta;
  const id = op.id ?? crypto.randomUUID();
  const agora = Date.now();
  const fila = await listarFila();
  if (conta !== esperado) throw new Error("A conta mudou. A alteração não foi salva.");
  const ultimaNaFila = fila.reduce((m, o) => Math.max(m, o.sequencia ?? o.criado_em * 1000), 0);
  ultimaSequencia = proximaSequencia(agora, Math.max(ultimaSequencia, ultimaNaFila));
  const registro = {
    ...op,
    conta_id: esperado,
    id,
    criado_em: agora,
    criado_em_utc: new Date(agora).toISOString(),
    sequencia: ultimaSequencia,
    tentativas: 0,
    ultimo_erro: null,
  } as OperacaoFila;
  await comStore(STORE_FILA, "readwrite", (s) => s.put(registro));
  notificar();
  return id;
}

async function marcarErro(op: OperacaoFila, erro: unknown) {
  const mensagem =
    erro instanceof Error ? erro.message : typeof erro === "object" && erro && "message" in erro ? String((erro as { message: unknown }).message) : "Erro ao enviar";
  const atualizado = { ...op, tentativas: (op.tentativas ?? 0) + 1, ultimo_erro: mensagem.slice(0, 200) } as OperacaoFila;
  try {
    await comStore(STORE_FILA, "readwrite", (s) => s.put(atualizado));
  } catch {
    /* ignora */
  }
  return atualizado;
}

/** Remove da fila um registro que não pode ser enviado (decisão da pessoa, com confirmação). */
export async function descartarDaFila(id: string) {
  if (!(await listarFila()).some((o) => o.id === id)) throw new Error("Registro de outra conta.");
  await remover(id);
}

async function remover(id: string) {
  await comStore(STORE_FILA, "readwrite", (s) => s.delete(id));
  notificar();
}

export function estaOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ------------------------------- Sincronização -----------------------------

let sincronizando = false;

async function enviarFoto(alunoId: string, foto: Blob, nome?: string | null) {
  const ext = (nome?.split(".").pop() ?? "jpg").toLowerCase();
  const caminho = `${alunoId}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("fotos-alunos").upload(caminho, foto, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
  if (error) throw error;
}

async function executar(op: OperacaoFila) {
  if (op.tipo === "aluno_novo") {
    const { error } = await supabase.from("alunos").upsert(op.aluno as never, { onConflict: "id" });
    if (error) throw error;
    if (op.foto) await enviarFoto(String(op.aluno["id"]), op.foto, op.fotoNome);
    return;
  }
  if (op.tipo === "aluno_update") {
    const { error } = await supabase.from("alunos").update(op.dados as never).eq("id", op.aluno_id);
    if (error) throw error;
    if (op.foto) await enviarFoto(op.aluno_id, op.foto, op.fotoNome);
    return;
  }
  if (op.tipo === "matriculas_sync") {
    const turmasSelecionadas = op.escolhas.map((escolha) => escolha.turma_id);
    let exclusao = supabase.from("matriculas").delete().eq("aluno_id", op.aluno_id).eq("status", "ativa");
    if (turmasSelecionadas.length) exclusao = exclusao.not("turma_id", "in", `(${turmasSelecionadas.join(",")})`);
    const { error: erroExclusao } = await exclusao;
    if (erroExclusao) throw erroExclusao;

    for (const escolha of op.escolhas) {
      const { error } = await supabase.from("matriculas").upsert(
        {
          aluno_id: op.aluno_id,
          turma_id: escolha.turma_id,
          status: "ativa",
          modalidade: escolha.modalidade,
          registrado_por: op.registrado_por ?? null,
        },
        { onConflict: "aluno_id,turma_id" },
      );
      if (error) throw error;
    }
    return;
  }
  const { data: resultado, error } = await supabase.rpc("enviar_chamada_offline", {
    _id: op.id, _conta: op.conta_id ?? "", _aluno: op.aluno_id, _turma: op.turma_id ?? "",
    _data: op.data, _horario: op.horario, _status: op.tipo === "presenca" ? op.status : "presente",
    _remover: op.tipo === "presenca_remover", _metodo: op.tipo === "presenca" ? op.metodo : "manual",
  });
  if (error) throw error;
  if (resultado === "enviado" && op.conta_id === conta) {
    const dados = await lerCache<{ presencas: import("./offline-regras").MarcaOffline[] } & Record<string, unknown>>("dados-offline");
    if (dados) {
      const { sobreporPendentes } = await import("./offline-regras");
      await salvarCache("dados-offline", { ...dados, presencas: sobreporPendentes(dados.presencas, [op]) }, op.conta_id);
    }
  }
}

export type ResultadoSync = {
  enviados: number;
  falhas: number;
  /** Registro que falhou e segura os seguintes (para manter a ordem exata). */
  bloqueado: OperacaoFila | null;
};

/**
 * Envia a fila na ordem exata em que as ações foram feitas, uma de cada vez.
 * Se uma falhar, o envio para ali: as seguintes esperam, para nunca serem gravadas fora de ordem.
 */
export async function sincronizar(): Promise<ResultadoSync> {
  if (sincronizando || !estaOnline()) return { enviados: 0, falhas: 0, bloqueado: null };
  sincronizando = true;
  let enviados = 0;
  let bloqueado: OperacaoFila | null = null;
  try {
    const fila = await listarFila();
    for (const op of fila) {
      try {
        const verificada = await supabase.auth.getUser();
        if (verificada.error || verificada.data.user?.id !== op.conta_id || conta !== op.conta_id) {
          throw new Error("Entre novamente na conta que fez estas alterações.");
        }
        await executar(op);
        await remover(op.id);
        enviados++;
      } catch (err) {
        bloqueado = await marcarErro(op, err);
        notificar();
        break;
      }
    }
  } finally {
    sincronizando = false;
  }
  if (enviados && typeof window !== "undefined") window.dispatchEvent(new Event("chamada-sincronizada"));
  return { enviados, falhas: bloqueado ? 1 : 0, bloqueado };
}
