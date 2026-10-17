import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server.ts";
import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export class FalhaIA extends Error {
  constructor(
    message: string,
    public status = 500,
    public bloqueado = false,
  ) {
    super(message);
  }
}
export async function verificarAcessoIA(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from("ia_acesso")
    .select("bloqueado,motivo")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new FalhaIA("Não foi possível verificar o acesso à IA.");
  if (data?.bloqueado)
    throw new FalhaIA(
      data.motivo ||
        "A IA está pausada. Um administrador precisa restaurar o acesso e confirmar a retomada.",
      403,
      true,
    );
}
export async function chamarIA<T>(
  schema: z.ZodType<T>,
  system: string,
  messages: ModelMessage[],
  gateway?: ReturnType<typeof createLovableAiGatewayRunIdFetch>,
): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new FalhaIA("A IA ainda não foi configurada.", 401);
  const run = gateway || createLovableAiGatewayRunIdFetch();
  let falha: FalhaIA | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const response = await run.fetch(input, init);
      const id = run.getRunId();
      if (id) setResponseHeader("X-Lovable-AIG-Run-ID", id);
      if (!response.ok) {
        const body = await response
          .clone()
          .json()
          .catch(() => ({}));
        const raw = body?.error?.message || body?.message;
        const mensagem =
          typeof raw === "string"
            ? raw
            : "Não foi possível usar a IA. Tente novamente quando o serviço estiver disponível.";
        const bloquear = response.status === 402 || response.status === 403;
        if (bloquear) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("ia_acesso")
            .upsert({
              id: true,
              bloqueado: true,
              motivo: mensagem,
              atualizado_em: new Date().toISOString(),
            });
          if (error)
            throw new FalhaIA(
              "Acesso negado à IA; não foi possível registrar a pausa. Contate um administrador.",
              response.status,
              true,
            );
        }
        falha = new FalhaIA(mensagem, response.status, bloquear);
      }
      return response;
    },
  });
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system,
      messages,
      output: Output.object({ schema }),
      maxRetries: 0,
      abortSignal: getRequest().signal,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const output = await result.output;
    const reason = await result.finishReason;
    if (reason === "content-filter") throw new FalhaIA("A IA recusou esta solicitação.", 422);
    if (falha) throw falha;
    return schema.parse(output);
  } catch (error) {
    if (falha) throw falha;
    if (error instanceof FalhaIA) throw error;
    if (getRequest().signal.aborted) throw new FalhaIA("Solicitação interrompida.", 499);
    throw new FalhaIA(
      "A IA não produziu uma resposta válida. Nenhuma alteração foi aplicada.",
      422,
    );
  }
}
export function resultadoErro(error: unknown) {
  const falha =
    error instanceof FalhaIA
      ? error
      : new FalhaIA(
          error instanceof Error ? error.message : "Não foi possível concluir a solicitação.",
          400,
        );
  setResponseStatus(falha.status);
  return {
    ok: false as const,
    erro: falha.message,
    status: falha.status,
    bloqueado: falha.bloqueado,
  };
}
