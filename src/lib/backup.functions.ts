import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data: admin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!admin) throw new Error("Apenas administradores podem executar o backup.");
}

/** Executa o backup completo (planilha + fotos/documentos) no Google Drive. Somente administradores. */
export const fazerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { executarBackupCompleto } = await import("@/lib/backup.server");
    return await executarBackupCompleto();
  });

/** Envia a planilha do dia e devolve a fila de fotos/documentos a enviar. */
export const prepararBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    try {
      const { prepararBackup } = await import("@/lib/backup.server");
      const resultado = await prepararBackup();
      return { ok: true as const, ...resultado };
    } catch (err) {
      const erro = err instanceof Error ? err.message : "Falha ao preparar o backup.";
      console.error("[backup] prepararBackup falhou:", erro);
      return { ok: false as const, erro, planilha: "", arquivos: [], existentes: {} };
    }
  });

/** Gera a planilha final (com os links do Drive) e envia para a pasta de planilhas. */
export const gerarPlanilhaBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { gerarPlanilhaBackup } = await import("@/lib/backup.server");
    return { planilha: await gerarPlanilhaBackup() };
  });

/** Links dos arquivos (fotos e documentos) já enviados ao Google Drive. */
export const linksArquivosDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { linksArquivosDrive } = await import("@/lib/backup.server");
    try {
      return await linksArquivosDrive();
    } catch (err) {
      console.error("[backup] não foi possível listar os links do Drive", err);
      return {} as Record<string, string>;
    }
  });


const loteSchema = z.object({
  arquivos: z.array(
    z.object({
      caminho: z.string(),
      nome: z.string(),
      pasta: z.string(),
      marcador: z.string(),
    }),
  ),
  existentes: z.record(z.string(), z.array(z.object({ id: z.string(), name: z.string() }))).optional(),
});

/** Envia um lote de fotos/documentos (usado para exibir progresso na tela). */
export const enviarLoteBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => loteSchema.parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { enviarLoteBackup } = await import("@/lib/backup.server");
    return await enviarLoteBackup(data.arquivos, data.existentes);
  });

/** Conta Google (email) onde os backups estão sendo guardados. */
export const contaDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { contaDrive } = await import("@/lib/backup.server");
    return await contaDrive();
  });

/** Verifica se as pastas do Drive configuradas existem e aceitam novos arquivos. */

export const validarPastasDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { validarPastasDrive } = await import("@/lib/backup.server");
    return await validarPastasDrive();
  });

/** Registra o resultado do último backup manual. */
export const registrarBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ resumo: z.string(), status: z.enum(["sucesso", "falha"]).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quando = new Date().toISOString();
    await supabaseAdmin
      .from("backup_cron")
      .update({ ultimo_backup: quando, ultimo_resultado: data.resumo, ultimo_status: data.status ?? "sucesso" })
      .eq("id", true);
    return { ultimo_backup: quando };
  });

/** Lê o estado do backup automático (último resultado + agendamento). Somente administradores. */
export const statusBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("backup_cron")
      .select("ultimo_backup,ultimo_resultado,ultimo_status,dia_semana,hora,minuto,ativo")
      .maybeSingle();
    return (data ?? null) as {
      ultimo_backup: string | null;
      ultimo_resultado: string | null;
      ultimo_status: string | null;
      dia_semana: number;
      hora: number;
      minuto: number;
      ativo: boolean;
    } | null;
  });

const agendamentoSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
  ativo: z.boolean(),
});

/** Salva o dia/horário do backup automático e reprograma o agendador. Somente administradores. */
export const salvarAgendamentoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => agendamentoSchema.parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("agendar_backup", {
      _dia: data.dia_semana,
      _hora: data.hora,
      _minuto: data.minuto,
      _ativo: data.ativo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

