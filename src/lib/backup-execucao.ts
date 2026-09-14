import { toast } from "sonner";

import {
  enviarLoteBackupFn,
  gerarPlanilhaBackupFn,
  prepararBackupFn,
  registrarBackupFn,
} from "@/lib/backup.functions";


const LOTE = 8;

export type ProgressoBackup = {
  etapa: string;
  enviados: number;
  total: number;
  falhas: number;
  restante: number | null;
};

export type EstadoBackup = {
  executando: boolean;
  progresso: ProgressoBackup | null;
};

/**
 * Estado do backup fora do React: ao trocar de tela o componente é desmontado,
 * mas este módulo continua vivo e o envio segue em segundo plano.
 */
let estado: EstadoBackup = { executando: false, progresso: null };
const ouvintes = new Set<(e: EstadoBackup) => void>();

export function estadoBackupAtual(): EstadoBackup {
  return estado;
}

/** Assina as mudanças de estado do backup (retorna a função de cancelamento). */
export function assinarBackup(ouvinte: (e: EstadoBackup) => void): () => void {
  ouvintes.add(ouvinte);
  ouvinte(estado);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function atualizar(parcial: Partial<EstadoBackup>) {
  estado = { ...estado, ...parcial };
  for (const o of ouvintes) o(estado);
}

/** Avisa o administrador por notificação do navegador (quando permitido) e por aviso na tela. */
export function notificar(titulo: string, corpo: string, erro = false) {
  if (erro) toast.error(`${titulo}${corpo ? `: ${corpo}` : ""}`);
  else toast.success(`${titulo}${corpo ? `: ${corpo}` : ""}`);
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") new Notification(titulo, { body: corpo });
    else if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(titulo, { body: corpo });
      });
    }
  } catch {
    /* notificação do navegador é opcional */
  }
}

/**
 * Executa o backup completo (planilha + fotos/documentos) fora do ciclo de vida
 * da tela: o administrador pode navegar para outras telas que o envio continua.
 */
export async function executarBackupGlobal(): Promise<void> {
  if (estado.executando) return;
  atualizar({
    executando: true,
    progresso: { etapa: "Preparando o backup…", enviados: 0, total: 0, falhas: 0, restante: null },
  });
  try {
    const resposta = await prepararBackupFn({ data: undefined });
    if (!resposta) throw new Error("O servidor não respondeu ao preparar o backup. Tente novamente.");
    if (!resposta.ok) throw new Error(resposta.erro || "Falha ao preparar o backup.");
    const { arquivos, existentes } = resposta;
    const total = arquivos.length;
    const inicio = Date.now();
    let enviados = 0;
    const falhas: string[] = [];

    atualizar({
      progresso: { etapa: "Enviando fotos e documentos…", enviados: 0, total, falhas: 0, restante: null },
    });

    for (let i = 0; i < total; i += LOTE) {
      const parte = arquivos.slice(i, i + LOTE);
      const r = await enviarLoteBackupFn({ data: { arquivos: parte, existentes } });
      enviados += r.enviados;
      falhas.push(...r.falhas);
      const processados = Math.min(i + parte.length, total);
      const decorrido = (Date.now() - inicio) / 1000;
      const restante = processados > 0 ? (decorrido / processados) * (total - processados) : null;
      atualizar({
        progresso: {
          etapa: "Enviando fotos e documentos…",
          enviados: processados,
          total,
          falhas: falhas.length,
          restante,
        },
      });
    }

    atualizar({
      progresso: { etapa: "Gerando a planilha com os links…", enviados: total, total, falhas: falhas.length, restante: null },
    });
    const { planilha } = await gerarPlanilhaBackupFn({ data: undefined });

    const resumo = `${planilha} · ${enviados} arquivo(s)${falhas.length ? ` · ${falhas.length} falha(s)` : ""}`;

    const status = falhas.length > 0 ? ("falha" as const) : ("sucesso" as const);
    await registrarBackupFn({ data: { resumo, status } });
    atualizar({
      progresso: { etapa: "Backup concluído", enviados: total, total, falhas: falhas.length, restante: 0 },
    });
    notificar(falhas.length > 0 ? "Backup concluído com falhas" : "Backup concluído", resumo, falhas.length > 0);
  } catch (err) {
    atualizar({ progresso: null });
    const mensagem = err instanceof Error ? err.message : "Falha no backup";
    try {
      await registrarBackupFn({ data: { resumo: mensagem, status: "falha" } });
    } catch {
      /* o erro principal já será exibido */
    }
    notificar("Falha no backup", mensagem, true);
  } finally {
    atualizar({ executando: false });
  }
}
