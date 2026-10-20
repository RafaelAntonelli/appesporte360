import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  FOTO_MAX_BYTES,
  MENSAGENS_ACESSO,
  VALIDADE_PEDIDO_MIN,
  gerarCodigoAparelho,
  situacaoAtestado,
  tipoDaFoto,
  validarEmail,
  validarTelefone,
  validarFoto,
  type SituacaoAtestado,
} from "@/lib/aluno-acesso";
import { vencimentoAtestado } from "@/lib/atestado";

const tokenOpcional = z.string().max(80).optional().nullable();

const credenciais = z.object({
  identificador: z.string().trim().min(1).max(20),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dispositivo: z.string().max(80),
  token: tokenOpcional,
});

export type RespostaEntrada =
  | { ok: true }
  | { ok: false; motivo: "limite" | "inativo" | "nao_confere" | "aparelho" | "pendente"; mensagem: string };

/** Login do aluno: CPF ou matrícula + nascimento, num aparelho já liberado pela administração. */
export const entrarAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => credenciais.parse(d))
  .handler(async ({ data }): Promise<RespostaEntrada> => {
    const s = await import("@/lib/aluno-acesso.server");
    if (await s.limiteDeTentativas(data.dispositivo)) return { ok: false, motivo: "limite", mensagem: MENSAGENS_ACESSO.muitasTentativas };
    const r = await s.localizarAluno(data.identificador, data.nascimento);
    if (r.tipo === "inativo") return { ok: false, motivo: "inativo", mensagem: MENSAGENS_ACESSO.inativo };
    if (r.tipo !== "ok") return { ok: false, motivo: "nao_confere", mensagem: MENSAGENS_ACESSO.naoConfere };

    const token = s.tokenDaRequisicao(data.token);
    const aparelho = await s.aparelhoPorToken(token);
    const agora = Date.now();
    if (aparelho && token && aparelho.aluno_id === r.id) {
      if (aparelho.status === "liberado" && aparelho.liberado_ate && new Date(aparelho.liberado_ate).getTime() > agora) {
        const db = await s.admin();
        await db
          .from("aluno_aparelhos")
          .update({ sessao_ate: s.fimDaSessao(aparelho.login_salvo, aparelho.liberado_ate), ultimo_acesso: new Date().toISOString() })
          .eq("id", aparelho.id);
        s.gravarCookieAparelho(token);
        return { ok: true };
      }
      if (aparelho.status === "pendente" && new Date(aparelho.pedido_expira_em).getTime() > agora) {
        return { ok: false, motivo: "pendente", mensagem: "O pedido deste aparelho está aguardando a administração." };
      }
    }
    return { ok: false, motivo: "aparelho", mensagem: MENSAGENS_ACESSO.aparelhoNaoLiberado };
  });

export type RespostaPedido =
  | { ok: true; liberado: true }
  | { ok: true; liberado: false; token: string; codigo: string; expiraEm: string }
  | { ok: false; mensagem: string };

/** Pedido de liberação presencial: gera QR Code só para aluno ativo cujos dados conferem. */
export const solicitarLiberacaoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => credenciais.parse(d))
  .handler(async ({ data }): Promise<RespostaPedido> => {
    const s = await import("@/lib/aluno-acesso.server");
    if (await s.limiteDeTentativas(data.dispositivo)) return { ok: false, mensagem: MENSAGENS_ACESSO.muitasTentativas };
    const r = await s.localizarAluno(data.identificador, data.nascimento);
    if (r.tipo !== "ok") return { ok: false, mensagem: MENSAGENS_ACESSO.procureAdministracao };

    const db = await s.admin();
    let token = s.tokenDaRequisicao(data.token);
    const existente = await s.aparelhoPorToken(token);
    if (
      existente &&
      token &&
      existente.aluno_id === r.id &&
      existente.status === "liberado" &&
      existente.liberado_ate &&
      new Date(existente.liberado_ate).getTime() > Date.now()
    ) {
      await db.from("aluno_aparelhos").update({ sessao_ate: s.fimDaSessao(existente.login_salvo, existente.liberado_ate) }).eq("id", existente.id);
      s.gravarCookieAparelho(token);
      return { ok: true, liberado: true };
    }

    const codigo = gerarCodigoAparelho(s.bytesAleatorios);
    const expiraEm = new Date(Date.now() + VALIDADE_PEDIDO_MIN * 60_000).toISOString();
    const pedido = {
      status: "pendente",
      codigo_hash: await s.sha256Hex(codigo),
      codigo_final: codigo.slice(-4),
      pedido_em: new Date().toISOString(),
      pedido_expira_em: expiraEm,
      sessao_ate: null,
      descricao: s.descricaoAparelho(),
    };
    if (existente && token && existente.aluno_id === r.id) {
      const { error } = await db.from("aluno_aparelhos").update(pedido).eq("id", existente.id);
      if (error) throw new Error("Não foi possível gerar o pedido. Tente novamente.");
    } else {
      token = s.novoTokenAparelho();
      const { error } = await db.from("aluno_aparelhos").insert({ ...pedido, aluno_id: r.id, token_hash: await s.sha256Hex(token) });
      if (error) throw new Error("Não foi possível gerar o pedido. Tente novamente.");
    }
    s.gravarCookieAparelho(token);
    return { ok: true, liberado: false, token, codigo, expiraEm };
  });

export type StatusAparelho = {
  status: "nenhum" | "pendente" | "liberado" | "recusado" | "revogado" | "expirado";
  sessaoAtiva: boolean;
  pedidoExpiraEm: string | null;
};

export const statusAparelhoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional }).parse(d))
  .handler(async ({ data }): Promise<StatusAparelho> => {
    const s = await import("@/lib/aluno-acesso.server");
    const token = s.tokenDaRequisicao(data.token);
    const a = await s.aparelhoPorToken(token);
    if (!a || !token) return { status: "nenhum", sessaoAtiva: false, pedidoExpiraEm: null };
    const agora = Date.now();
    if (a.status === "pendente" && new Date(a.pedido_expira_em).getTime() <= agora)
      return { status: "expirado", sessaoAtiva: false, pedidoExpiraEm: a.pedido_expira_em };
    if (a.status === "liberado" && (!a.liberado_ate || new Date(a.liberado_ate).getTime() <= agora))
      return { status: "expirado", sessaoAtiva: false, pedidoExpiraEm: null };
    const sessaoAtiva = a.status === "liberado" && !!a.sessao_ate && new Date(a.sessao_ate).getTime() > agora;
    if (a.status === "liberado") s.gravarCookieAparelho(token);
    return { status: a.status as StatusAparelho["status"], sessaoAtiva, pedidoExpiraEm: a.pedido_expira_em };
  });

export type TurmaDoAluno = { id: string; nome: string; modalidade: string; dias: string[]; horario: string | null; turno: string | null };
export type AvisoDoAluno = { id: string; titulo: string; mensagem: string; criadoEm: string; lido: boolean; paraTodos: boolean };
export type DadosAreaAluno = {
  aluno: {
    nome: string;
    codigo: string;
    dataNascimento: string | null;
    cpf: string | null;
    rg: string | null;
    telefone: string | null;
    telefone2: string | null;
    email: string | null;
    responsavel: string | null;
    escola: string | null;
    sexo: string | null;
    pcd: boolean;
    fotoUrl: string | null;
  };
  turmas: TurmaDoAluno[];
  atestado: { situacao: SituacaoAtestado; venceEm: string | null };
  avisos: AvisoDoAluno[];
  aparelho: { loginSalvo: boolean; consentimento: boolean; liberadoAte: string | null; notificacoesAtivas: boolean };
};

async function sessaoOuErro(token?: string | null) {
  const s = await import("@/lib/aluno-acesso.server");
  return { s, ...(await s.exigirSessaoAluno(token)) };
}

/** Somente os dados do próprio aluno, sem detalhes médicos. */
export const meusDadosAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional }).parse(d))
  .handler(async ({ data }): Promise<DadosAreaAluno> => {
    const { db, alunoId, aparelho } = await sessaoOuErro(data.token);
    const { data: a, error } = await db
      .from("alunos")
      .select("nome,codigo,data_nascimento,cpf,rg,telefone,telefone2,email,responsavel,escola,sexo,pcd,foto_path,atestado_entregue,atestado_data,created_at")
      .eq("id", alunoId)
      .single();
    if (error || !a) throw new Error("Cadastro não encontrado.");

    const { data: mats } = await db.from("matriculas").select("turma_id,modalidade").eq("aluno_id", alunoId).eq("status", "ativa");
    const ids = (mats ?? []).map((m) => m.turma_id);
    const { data: ts } = ids.length
      ? await db.from("turmas").select("id,nome,modalidade,dias_semana,horario,turno").in("id", ids)
      : { data: [] };
    const turmas: TurmaDoAluno[] = (mats ?? [])
      .map((m) => {
        const t = (ts ?? []).find((x) => x.id === m.turma_id);
        if (!t) return null;
        return { id: t.id, nome: t.nome, modalidade: m.modalidade || t.modalidade, dias: t.dias_semana ?? [], horario: t.horario, turno: t.turno };
      })
      .filter((t): t is TurmaDoAluno => !!t)
      .sort((x, y) => (x.horario ?? "").localeCompare(y.horario ?? ""));

    let fotoUrl: string | null = null;
    if (a.foto_path) {
      const { data: assinada } = await db.storage.from("fotos-alunos").createSignedUrl(a.foto_path, 3600);
      fotoUrl = assinada?.signedUrl ?? null;
    }

    const { data: avs } = await db
      .from("avisos")
      .select("id,titulo,mensagem,created_at,aluno_id")
      .or(`aluno_id.eq.${alunoId},and(aluno_id.is.null,created_at.gte.${a.created_at})`)
      .order("created_at", { ascending: false })
      .limit(60);
    const { data: lidos } = (avs ?? []).length
      ? await db.from("avisos_leituras").select("aviso_id").eq("aluno_id", alunoId).in("aviso_id", (avs ?? []).map((v) => v.id))
      : { data: [] };
    const setLidos = new Set((lidos ?? []).map((l) => l.aviso_id));

    const { count: pushCount } = await db.from("aluno_push_tokens").select("id", { count: "exact", head: true }).eq("aparelho_id", aparelho.id);
    const vence = vencimentoAtestado(a.atestado_data);

    return {
      aluno: {
        nome: a.nome,
        codigo: a.codigo,
        dataNascimento: a.data_nascimento,
        cpf: a.cpf,
        rg: a.rg,
        telefone: a.telefone,
        telefone2: a.telefone2,
        email: a.email,
        responsavel: a.responsavel,
        escola: a.escola,
        sexo: a.sexo,
        pcd: a.pcd,
        fotoUrl,
      },
      turmas,
      atestado: { situacao: situacaoAtestado(a), venceEm: a.atestado_entregue && vence ? vence.toISOString().slice(0, 10) : null },
      avisos: (avs ?? []).map((v) => ({
        id: v.id,
        titulo: v.titulo,
        mensagem: v.mensagem,
        criadoEm: v.created_at,
        lido: setLidos.has(v.id),
        paraTodos: v.aluno_id === null,
      })),
      aparelho: {
        loginSalvo: aparelho.login_salvo,
        consentimento: !!aparelho.consentimento_em,
        liberadoAte: aparelho.liberado_ate,
        notificacoesAtivas: (pushCount ?? 0) > 0,
      },
    };
  });

/** Aluno só pode alterar telefone, segundo telefone e e-mail. */
export const atualizarContatoAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenOpcional,
        telefone: z.string().max(20),
        telefone2: z.string().max(20),
        email: z.string().max(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!validarTelefone(data.telefone) || !validarTelefone(data.telefone2)) throw new Error("Telefone inválido. Use DDD + número.");
    if (!validarEmail(data.email)) throw new Error("E-mail inválido.");
    const { db, alunoId } = await sessaoOuErro(data.token);
    const { error } = await db
      .from("alunos")
      .update({ telefone: data.telefone.trim() || null, telefone2: data.telefone2.trim() || null, email: data.email.trim() || null })
      .eq("id", alunoId);
    if (error) throw new Error("Não foi possível salvar. Tente novamente.");
    return { ok: true };
  });

export const enviarFotoAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => {
    if (!(d instanceof FormData)) throw new Error("Envio inválido.");
    const foto = d.get("foto");
    const token = d.get("token");
    if (!(foto instanceof File)) throw new Error("Escolha uma foto.");
    return { foto, token: typeof token === "string" ? token : null };
  })
  .handler(async ({ data }) => {
    const erro = validarFoto(data.foto.size, data.foto.type);
    if (erro) throw new Error(erro);
    if (data.foto.size > FOTO_MAX_BYTES) throw new Error("A foto pode ter até 5 MB.");
    const bytes = new Uint8Array(await data.foto.arrayBuffer());
    const tipo = tipoDaFoto(bytes);
    if (!tipo) throw new Error("Envie uma foto JPG, PNG ou WebP.");
    const { db, alunoId } = await sessaoOuErro(data.token);
    const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
    const caminho = `${alunoId}/${Date.now()}.${ext}`;
    const { data: atual } = await db.from("alunos").select("foto_path").eq("id", alunoId).single();
    const up = await db.storage.from("fotos-alunos").upload(caminho, bytes, { contentType: tipo, upsert: true });
    if (up.error) throw new Error("Não foi possível enviar a foto.");
    const { error } = await db.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
    if (error) {
      await db.storage.from("fotos-alunos").remove([caminho]);
      throw new Error("Não foi possível salvar a foto.");
    }
    if (atual?.foto_path && atual.foto_path !== caminho) await db.storage.from("fotos-alunos").remove([atual.foto_path]);
    return { ok: true };
  });

export const marcarAvisoLidoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional, avisoIds: z.array(z.string().uuid()).min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { db, alunoId } = await sessaoOuErro(data.token);
    const { data: avs } = await db.from("avisos").select("id,aluno_id").in("id", data.avisoIds);
    const permitidos = (avs ?? []).filter((v) => v.aluno_id === null || v.aluno_id === alunoId).map((v) => v.id);
    if (permitidos.length) {
      await db.from("avisos_leituras").upsert(permitidos.map((aviso_id) => ({ aviso_id, aluno_id: alunoId })), { onConflict: "aviso_id,aluno_id" });
    }
    return { ok: true };
  });

/** Consentimento para guardar os dados de acesso e opção de login salvo. */
export const preferenciasAcessoAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional, consentimento: z.boolean().optional(), salvarLogin: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { db, aparelho, s } = await sessaoOuErro(data.token);
    const mudanca: { consentimento_em?: string | null; login_salvo?: boolean; sessao_ate?: string } = {};
    if (data.consentimento !== undefined) mudanca.consentimento_em = data.consentimento ? new Date().toISOString() : null;
    if (data.salvarLogin !== undefined) {
      if (data.salvarLogin && !(data.consentimento ?? aparelho.consentimento_em)) throw new Error("Aceite guardar os dados de acesso antes de salvar o login.");
      mudanca.login_salvo = data.salvarLogin;
      mudanca.sessao_ate = s.fimDaSessao(data.salvarLogin, aparelho.liberado_ate);
    }
    if (data.consentimento === false) {
      mudanca.login_salvo = false;
      mudanca.sessao_ate = s.fimDaSessao(false, aparelho.liberado_ate);
    }
    await db.from("aluno_aparelhos").update(mudanca).eq("id", aparelho.id);
    return { ok: true };
  });

export const sairAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("@/lib/aluno-acesso.server");
    const a = await s.aparelhoPorToken(s.tokenDaRequisicao(data.token));
    if (a) {
      const db = await s.admin();
      await db.from("aluno_aparelhos").update({ sessao_ate: null, login_salvo: false }).eq("id", a.id);
    }
    return { ok: true };
  });

export const configNotificacoesAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional }).parse(d))
  .handler(async ({ data }) => {
    await sessaoOuErro(data.token);
    const { configWebFirebase } = await import("@/lib/push.server");
    return configWebFirebase();
  });

export const registrarNotificacoesAlunoFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenOpcional, fcmToken: z.string().min(20).max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const { db, aparelho, alunoId } = await sessaoOuErro(data.token);
    const { error } = await db
      .from("aluno_push_tokens")
      .upsert({ token: data.fcmToken, aparelho_id: aparelho.id, aluno_id: alunoId, updated_at: new Date().toISOString() }, { onConflict: "token" });
    if (error) throw new Error("Não foi possível ativar as notificações.");
    return { ok: true };
  });
