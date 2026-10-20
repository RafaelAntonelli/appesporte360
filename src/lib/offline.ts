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
  tentativas?: number;
  ultimo_erro?: string | null;
};

export type OperacaoFila = MetaFila & (
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
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

// ------------------------------- Cache de dados ----------------------------

export async function salvarCache(chave: string, valor: unknown) {
  if (!suportado()) return;
  try {
    await comStore(STORE_CACHE, "readwrite", (s) => s.put(valor, chave));
  } catch {
    /* ignora */
  }
}

export async function lerCache<T>(chave: string): Promise<T | null> {
  if (!suportado()) return null;
  try {
    const v = await comStore<T>(STORE_CACHE, "readonly", (s) => s.get(chave));
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
  try {
    const itens = await comStore<OperacaoFila[]>(STORE_FILA, "readonly", (s) => s.getAll());
    return (itens ?? []).sort(ordemFila);
  } catch {
    return [];
  }
}

type CamposControle = "id" | "criado_em" | "criado_em_utc" | "sequencia" | "tentativas" | "ultimo_erro";
type SemMeta<T> = T extends unknown ? Omit<T, CamposControle> & { id?: string } : never;

let ultimaSequencia = 0;

export async function enfileirar(op: SemMeta<OperacaoFila>): Promise<string> {
  const id = op.id ?? crypto.randomUUID();
  const agora = Date.now();
  const fila = await listarFila();
  const ultimaNaFila = fila.reduce((m, o) => Math.max(m, o.sequencia ?? o.criado_em * 1000), 0);
  ultimaSequencia = proximaSequencia(agora, Math.max(ultimaSequencia, ultimaNaFila));
  const registro = {
    ...op,
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
  // presença: substitui apenas o registro da mesma turma e dia
  let consultaExistente = supabase.from("presencas").select("id").eq("aluno_id", op.aluno_id).eq("data", op.data);
  consultaExistente = op.turma_id ? consultaExistente.eq("turma_id", op.turma_id) : consultaExistente.is("turma_id", null);
  const existente = await consultaExistente.maybeSingle();
  if (existente.data) {
    const { error } = await supabase
      .from("presencas")
      .update({ status: op.status, metodo: op.metodo, turma_id: op.turma_id, horario: op.horario, observacoes: op.observacoes })
      .eq("id", existente.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("presencas").insert({
      aluno_id: op.aluno_id,
      turma_id: op.turma_id,
      data: op.data,
      status: op.status,
      metodo: op.metodo,
      observacoes: op.observacoes,
      horario: op.horario,
    } as never);
    if (error) throw error;
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
  return { enviados, falhas: bloqueado ? 1 : 0, bloqueado };
}
