import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, Search, Users, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BotoesChamada, MarcarTodosPresentes, ProgressoChamada, type StatusChamada } from "@/components/Chamada";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Carregando } from "@/components/Carregando";
import { lerDadosOffline, type DadosOffline } from "@/lib/offline-dados";
import { assinarFila, enfileirar, listarFila } from "@/lib/offline";
import { sobreporPendentes, type MarcaOffline } from "@/lib/offline-regras";
import { dataISO, licencaVigente } from "@/lib/licenca";
import { correspondeBusca } from "@/lib/formatacao";

/** Restricted local view: no profile, reports, settings, files or admin actions. */
export function AreaOffline({ pagina }: { pagina: string }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState<DadosOffline | null>(null);
  const [marcas, setMarcas] = useState<MarcaOffline[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [turma, setTurma] = useState("");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState(() => dataISO());
  const [gravando, setGravando] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      const d = await lerDadosOffline();
      const fila = await listarFila();
      if (!vivo) return;
      setDados(d);
      setMarcas(sobreporPendentes(d?.presencas ?? [], fila.filter((o) => o.tipo === "presenca" || o.tipo === "presenca_remover")));
      setCarregando(false);
    };
    void ler();
    const sair = assinarFila(() => void ler());
    window.addEventListener("listas-offline-atualizadas", ler);
    return () => { vivo = false; sair(); window.removeEventListener("listas-offline-atualizadas", ler); };
  }, [pagina]);
  if (carregando) return <Carregando formato="linhas" />;
  if (!dados) return <EstadoVazio icone={WifiOff} titulo="As listas ainda não foram salvas neste aparelho" descricao="Conecte à internet e abra o app com sua conta para preparar o acesso sem internet." />;
  const turmas = dados.turmas.filter((t) => t.ativa);
  const alunos = dados.alunos.filter((a) => (pagina === "/alunos" || a.ativo) && correspondeBusca(a, busca) && (!turma || dados.matriculas.some((m) => m.aluno_id === a.id && m.turma_id === turma)));
  const chamada = pagina === "/presenca" || (pagina === "/turmas" && turma !== "");
  const porAluno = new Map(marcas.filter((m) => m.data === data && m.turma_id === turma).map((m) => [m.aluno_id, m.status]));
  const emLicenca = (id: string) => dados.licencas.some((l) => l.aluno_id === id && licencaVigente(l, data));
  const marcados = alunos.filter((a) => porAluno.has(a.id) || emLicenca(a.id)).length;
  const pendentes = alunos.filter((a) => !porAluno.has(a.id) && !emLicenca(a.id));
  async function marcar(id: string, status: StatusChamada | null) {
    if (!dados?.podeChamada || !turma || gravando) return;
    if (emLicenca(id) && status !== "falta_justificada") { toast.info("Aluno em licença médica permanece justificado."); return; }
    setGravando(true);
    try {
      const horario = new Date().toISOString();
      await enfileirar(status ? { tipo: "presenca", aluno_id: id, turma_id: turma, data, status, metodo: "manual", observacoes: null, horario } : { tipo: "presenca_remover", aluno_id: id, turma_id: turma, data, horario });
      toast.success(status ? "Marcação salva no aparelho." : "Desmarcação salva no aparelho.");
    } catch { toast.error("Não foi possível salvar. A marcação não foi alterada; tente novamente."); }
    finally { setGravando(false); }
  }
  if (!["/", "/alunos", "/turmas", "/presenca"].includes(pagina)) return <EstadoVazio icone={WifiOff} titulo="Esta tela precisa de internet" descricao="Sem internet, você pode consultar a lista salva de alunos e fazer a chamada." acoes={<Button onClick={() => navigate({ to: "/presenca" })}>Abrir chamada</Button>} />;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><WifiOff className="size-4" /><span>Consulta salva — fotos, documentos, perfil completo e alterações de cadastro precisam de internet.</span></div>
    {pagina === "/" ? <EstadoVazio icone={WifiOff} titulo="Esporte 360 sem internet" descricao="Abra a lista de alunos ou a chamada com os dados salvos nesta conta." acoes={<div className="flex gap-2"><Button variant="outline" onClick={() => navigate({ to: "/alunos" })}><Users className="size-4" />Alunos</Button><Button onClick={() => navigate({ to: "/presenca" })}>Abrir chamada</Button></div>} /> : <>
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2"><Search className="size-4 text-muted-foreground" /><Input aria-label="Buscar na lista salva" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, matrícula, CPF ou telefone" /></div>
        <Select value={turma || "todas"} onValueChange={(v) => setTurma(v === "todas" ? "" : v)}><SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Escolha a turma" /></SelectTrigger><SelectContent><SelectItem value="todas">{pagina === "/alunos" ? "Todas as turmas" : "Escolha uma turma"}</SelectItem>{turmas.map((t) => <SelectItem value={t.id} key={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select>
        {chamada ? <Input aria-label="Data da chamada" type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-40" /> : null}
      </div>
      {pagina === "/turmas" && !turma ? <div className="grid gap-4 md:grid-cols-2">{turmas.map((t) => <article key={t.id} className="space-y-2 rounded-lg border border-border bg-card p-4"><h2 className="font-semibold">{t.nome}</h2><p className="text-sm text-muted-foreground">{t.modalidade} · {t.horario ?? "Horário não informado"} · {t.dias_semana.join(" / ")}</p><Button variant="outline" onClick={() => setTurma(t.id)}>Abrir chamada</Button></article>)}</div> : chamada && !turma ? <EstadoVazio icone={Users} titulo="Escolha uma turma para abrir a chamada" descricao="A chamada usa apenas os alunos ativos e matriculados na turma salva." /> : <>
        {chamada ? <div className="sticky top-0 z-20 space-y-3 border-b border-border bg-background py-3"><ProgressoChamada marcados={marcados} total={alunos.length} />{dados.podeChamada ? <MarcarTodosPresentes pendentes={pendentes.length} emLicenca={alunos.filter((a) => emLicenca(a.id)).length} onConfirmar={async () => { for (const a of pendentes) await marcar(a.id, "presente"); }} /> : <p className="text-sm text-muted-foreground">Sua conta pode consultar a chamada, mas não fazer marcações.</p>}</div> : null}
        {!alunos.length ? <EstadoVazio icone={Users} titulo="Nenhum aluno encontrado na lista salva" descricao="Confira a busca ou escolha outra turma. A lista pode ter mudado desde a última atualização." acoes={<Button variant="outline" onClick={() => { setBusca(""); setTurma(""); }}><X className="size-4" />Limpar filtros</Button>} /> : <div className="divide-y divide-border">{alunos.map((a) => {
          const licenca = emLicenca(a.id); const atual = licenca ? "falta_justificada" : porAluno.get(a.id);
          return <article key={a.id} className="@container flex flex-col gap-3 py-4"><div className="flex items-center gap-4"><span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground sm:size-14">{a.nome.split(/\s+/).map((p) => p[0]).slice(0,2).join("")}</span><div className="min-w-0"><h3 className="break-words font-semibold">{a.nome}</h3><p className="text-sm text-muted-foreground">Matrícula {a.codigo}{!a.ativo ? " · Inativo" : ""}</p>{licenca ? <p className="text-sm font-medium text-warning-strong">Em licença médica — justificada</p> : null}</div></div>{chamada ? <BotoesChamada atual={atual} desabilitado={gravando || !dados.podeChamada || licenca} onEscolher={(s) => void marcar(a.id, atual === s ? null : s)} /> : null}</article>;
        })}</div>}
      </>}
    </>}
  </section>;
}