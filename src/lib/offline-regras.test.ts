import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
const remoto = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {getUser:remoto.getUser}, rpc:remoto.rpc } }));
import { definirContaOffline, salvarCache, lerCache, enfileirar, listarFila, sincronizar, descartarDaFila } from "./offline";
import { todasPaginas, sobreporPendentes, type MarcaOffline } from "./offline-regras";
import { recusarOffline } from "./pwa";

describe("chamada sem internet", () => {
  it("lê mais de 1000 itens sem perder a última página", async () => {
    const itens = Array.from({ length: 1503 }, (_, id) => ({ id }));
    const r = await todasPaginas((i,f) => Promise.resolve({ data: itens.slice(i,f+1), error: null }));
    expect(r.length).toBe(1503); expect(r[1502]?.id).toBe(1502);
  });
  it("recusa atualização incompleta", async () => {
    await expect(todasPaginas((i) => Promise.resolve(i ? { data:null,error:new Error("falha") } : { data:Array(500).fill(1),error:null }))).rejects.toThrow("falha");
  });
  it("restaura presente, falta, justificada e desfazer em ordem", () => {
    const marca: MarcaOffline = { aluno_id:"A", turma_id:"T", data:"2026-11-06", status:"presente", horario:"2026-11-06T12:00:00Z", metodo:"manual", observacoes:null };
    expect(sobreporPendentes([], [{...marca,tipo:"presenca"}])[0]?.status).toBe("presente");
    expect(sobreporPendentes([marca], [{...marca,tipo:"presenca",status:"falta"}])[0]?.status).toBe("falta");
    expect(sobreporPendentes([marca], [{...marca,tipo:"presenca",status:"falta_justificada"}])[0]?.status).toBe("falta_justificada");
    expect(sobreporPendentes([marca], [{...marca,tipo:"presenca_remover"}])).toHaveLength(0);
  });
  it("separa listas e pendências por conta e as preserva ao sair", async () => {
    definirContaOffline("conta-A"); await salvarCache("teste", { nome:"A" });
    await enfileirar({tipo:"presenca",aluno_id:"teste-A",turma_id:"teste-T",data:"2026-11-06",status:"presente",horario:"2026-11-06T12:00:00Z",metodo:"manual",observacoes:null});
    definirContaOffline("conta-B"); expect(await lerCache("teste")).toBeNull(); expect(await listarFila()).toHaveLength(0);
    await expect(salvarCache("teste", {nome:"A"}, "conta-A")).rejects.toThrow();
    definirContaOffline(null); expect(await lerCache("teste")).toBeNull();
    definirContaOffline("conta-A"); expect(await lerCache("teste")).toEqual({nome:"A"}); expect(await listarFila()).toHaveLength(1);
  });
  it("não registra offline nas prévias, desenvolvimento ou iframe", () => {
    expect(recusarOffline("id-preview--abc.lovable.app",true,false,false)).toBe(true);
    expect(recusarOffline("preview-v2--abc.lovable.app",true,false,false)).toBe(true);
    expect(recusarOffline("appesporte360.lovable.app",false,false,false)).toBe(true);
    expect(recusarOffline("appesporte360.lovable.app",true,true,false)).toBe(true);
    expect(recusarOffline("appesporte360.lovable.app",true,false,true)).toBe(true);
    expect(recusarOffline("appesporte360.lovable.app",true,false,false)).toBe(false);
  });
  it("para no primeiro envio recusado e mantém os seguintes", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    definirContaOffline("conta-falha");
    remoto.getUser.mockResolvedValue({ data:{user:{id:"conta-falha"}}, error:null });
    remoto.rpc.mockResolvedValue({data:null,error:new Error("Sem permissão")});
    for (let n=0;n<2;n++) await enfileirar({tipo:"presenca",aluno_id:`isolado-${n}`,turma_id:"isolada",data:"2026-11-06",status:"presente",horario:"2026-11-06T12:00:00Z",metodo:"manual",observacoes:null});
    const r=await sincronizar();
    expect(r.enviados).toBe(0); expect(r.falhas).toBe(1); expect(remoto.rpc).toHaveBeenCalledTimes(1);
    expect(await listarFila()).toHaveLength(2);
    for(const o of await listarFila()) await descartarDaFila(o.id);
  });
  it("não envia pendência quando a conta verificada é outra", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    definirContaOffline("conta-original"); remoto.rpc.mockClear();
    remoto.getUser.mockResolvedValue({data:{user:{id:"outra-conta"}},error:null});
    await enfileirar({tipo:"presenca_remover",aluno_id:"isolado",turma_id:"isolada",data:"2026-11-06",horario:"2026-11-06T12:00:00Z"});
    expect((await sincronizar()).falhas).toBe(1); expect(remoto.rpc).not.toHaveBeenCalled(); expect(await listarFila()).toHaveLength(1);
  });
});