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

/** Gera a planilha final (dados cadastrais e código de matrícula, sem links) e envia para a pasta de planilhas. */
export const gerarPlanilhaBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { gerarPlanilhaBackup } = await import("@/lib/backup.server");
    const p = await gerarPlanilhaBackup();
    return { planilha: p.nome, planilhaId: p.id };
  });

const falhaSchema = z.object({
  caminho: z.string(),
  nome: z.string(),
  pasta: z.string(),
  marcador: z.string(),
  marcadorAntigo: z.string().optional(),
  motivo: z.string(),
});

/** Últimos 30 backups (manuais e automáticos). */
export const historicoBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { data, error } = await context.supabase
      .from("backup_historico")
      .select("*")
      .order("iniciado_em", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as {
        id: string; iniciado_em: string; concluido_em: string | null; tipo: string; usuario_nome: string | null;
        enviados: number; total: number; status: string; planilha_nome: string | null; planilha_id: string | null; resumo: string | null;
      }),
      falhas: (r["falhas"] ?? []) as z.infer<typeof falhaSchema>[],
    }));
  });

/** Reenvia só os arquivos que falharam num backup e atualiza o histórico. */
export const reenviarFalhasFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linha, error } = await supabaseAdmin.from("backup_historico").select("*").eq("id", data.id).maybeSingle();
    if (error || !linha) throw new Error("Backup não encontrado.");
    const falhas = (linha.falhas ?? []) as z.infer<typeof falhaSchema>[];
    if (!falhas.length) return { enviados: 0, falhas: 0 };
    const { enviarLoteBackup } = await import("@/lib/backup.server");
    const r = await enviarLoteBackup(falhas.map(({ motivo: _m, ...a }) => a));
    const enviados = linha.enviados + r.enviados;
    await supabaseAdmin
      .from("backup_historico")
      .update({ enviados, falhas: r.falhas, status: r.falhas.length ? "falha" : "sucesso" })
      .eq("id", data.id);
    return { enviados: r.enviados, falhas: r.falhas.length };
  });

const loteSchema = z.object({
  arquivos: z.array(
    z.object({
      caminho: z.string(),
      nome: z.string(),
      pasta: z.string(),
      marcador: z.string(),
      marcadorAntigo: z.string().optional(),
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
    z
      .object({
        resumo: z.string(),
        status: z.enum(["sucesso", "falha"]).optional(),
        historico: z
          .object({
            iniciado_em: z.string(),
            enviados: z.number().int(),
            total: z.number().int(),
            planilha_nome: z.string().nullable(),
            planilha_id: z.string().nullable(),
            falhas: z.array(falhaSchema),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quando = new Date().toISOString();
    const h = data.historico;
    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    await supabaseAdmin.from("backup_historico").insert({
      iniciado_em: h?.iniciado_em ?? quando,
      concluido_em: quando,
      tipo: "manual",
      usuario_id: context.userId,
      usuario_nome: (usuario?.user?.user_metadata?.["full_name"] as string | undefined) ?? usuario?.user?.email ?? null,
      enviados: h?.enviados ?? 0,
      total: h?.total ?? 0,
      status: data.status ?? "sucesso",
      planilha_nome: h?.planilha_nome ?? null,
      planilha_id: h?.planilha_id ?? null,
      falhas: h?.falhas ?? [],
      resumo: data.resumo,
    });
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


// ---------------------------------------------------------------- restauração

/** Planilhas de backup disponíveis na pasta de planilhas do Drive. */
export const listarPlanilhasBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { listarPlanilhasBackup } = await import("@/lib/restauracao.server");
    return await listarPlanilhasBackup();
  });

/** Recria os alunos da planilha (opcional) e lista os arquivos do Drive a vincular pelo código de matrícula. */
export const prepararRestauracaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ planilhaId: z.string().regex(/^[A-Za-z0-9_-]{10,}$/).nullable(), substituir: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    try {
      const { prepararRestauracao } = await import("@/lib/restauracao.server");
      return { ok: true as const, ...(await prepararRestauracao(data)) };
    } catch (err) {
      const erro = err instanceof Error ? err.message : "Falha ao preparar a restauração.";
      console.error("[restauração] preparar falhou:", erro);
      return { ok: false as const, erro };
    }
  });

/** Restaura um lote de arquivos do Drive (usado para mostrar o progresso na tela). */
export const restaurarLoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tarefas: z.array(z.object({ fileId: z.string().regex(/^[A-Za-z0-9_-]{10,}$/), nome: z.string().max(200) })).max(10),
        substituir: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { restaurarLote } = await import("@/lib/restauracao.server");
    return await restaurarLote(data.tarefas, data.substituir);
  });
