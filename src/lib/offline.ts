import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Armazenamento local (IndexedDB) para funcionamento sem internet
// ---------------------------------------------------------------------------

const DB_NOME = "arena-offline";
const DB_VERSAO = 1;
const STORE_FILA = "fila";
const STORE_CACHE = "cache";

export type OperacaoFila =
  | { id: string; criado_em: number; tipo: "aluno_novo"; aluno: Record<string, unknown>; foto?: Blob | null; fotoNome?: string | null }
  | { id: string; criado_em: number; tipo: "aluno_update"; aluno_id: string; dados: Record<string, unknown>; foto?: Blob | null; fotoNome?: string | null }
  | {
      id: string;
      criado_em: number;
      tipo: "matriculas_sync";
      aluno_id: string;
      escolhas: { turma_id: string; modalidade: string }[];
      registrado_por?: string | null;
    }
  | {
      id: string;
      criado_em: number;
      tipo: "presenca";
      aluno_id: string;
      turma_id: string | null;
      data: string;
      status: string;
      metodo: string;
      observacoes: string | null;
      horario: string;
    };

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

export async function listarFila(): Promise<OperacaoFila[]> {
  if (!suportado()) return [];
  try {
    const itens = await comStore<OperacaoFila[]>(STORE_FILA, "readonly", (s) => s.getAll());
    return (itens ?? []).sort((a, b) => a.criado_em - b.criado_em);
  } catch {
    return [];
  }
}

type SemMeta<T> = T extends unknown ? Omit<T, "id" | "criado_em"> & { id?: string } : never;

export async function enfileirar(op: SemMeta<OperacaoFila>): Promise<string> {
  const id = op.id ?? crypto.randomUUID();
  const registro = { ...op, id, criado_em: Date.now() } as OperacaoFila;
  await comStore(STORE_FILA, "readwrite", (s) => s.put(registro));
  notificar();
  return id;
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

export type ResultadoSync = { enviados: number; falhas: number };

export async function sincronizar(): Promise<ResultadoSync> {
  if (sincronizando || !estaOnline()) return { enviados: 0, falhas: 0 };
  sincronizando = true;
  let enviados = 0;
  let falhas = 0;
  try {
    const fila = await listarFila();
    for (const op of fila) {
      try {
        await executar(op);
        await remover(op.id);
        enviados++;
      } catch {
        falhas++;
      }
    }
  } finally {
    sincronizando = false;
  }
  return { enviados, falhas };
}
