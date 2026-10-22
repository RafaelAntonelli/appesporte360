import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Stethoscope, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONDICOES_PCD } from "@/lib/pcd";
import { useHorarios } from "@/lib/horarios";
import { useAuth } from "@/lib/auth";
import { capitalizarNome, formatarCelular, normalizarTexto } from "@/lib/formatacao";
import { dataISO, somarDias, formatarDataCurta, licencaTerminada } from "@/lib/licenca";
import { PerfilAluno } from "@/components/PerfilAluno";
import { MODALIDADES, MODALIDADE_PADRAO } from "@/lib/modalidades";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Fila = {
  id: string;
  nome: string;
  telefone: string | null;
  modalidade: string;
  preferencia_horario: string | null;
  created_at: string;
  idade: number | null;
  pcd: boolean;
  pcd_condicoes: string[] | null;
  pcd_descricao: string | null;
  observacoes: string | null;
};


export const Route = createFileRoute("/")({
  component: Painel,
  head: () => ({
    meta: [
      { title: "Esporte 360 | Matrículas e presença" },
      {
        name: "description",
        content: "Sistema do Esporte 360 para matricular alunos, organizar turmas e registrar presença por QR Code.",
      },
      { property: "og:title", content: "Esporte 360 | Matrículas e presença" },
      { property: "og:description", content: "Matrículas, turmas e presença por QR Code em um só painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Painel() {
  const { lista: listaHorarios } = useHorarios();
  const { isAdmin } = useAuth();
  const [alunosPorModalidade, setAlunosPorModalidade] = useState<Record<string, number>>({});
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [aulas, setAulas] = useState<{ id: string; nome: string; horario: string | null; capacidade: number; ocupacao: number }[]>([]);
  const [licencas, setLicencas] = useState<{ id: string; aluno_id: string; nome: string; data_retorno: string; vencida: boolean }[]>([]);
  const [fila, setFila] = useState<Fila[]>([]);
  const [mostrarFila, setMostrarFila] = useState(false);
  const filaVazia: {
    nome: string;
    telefone: string;
    modalidade: string;
    preferencia_horario: string;
    idade: string;
    pcd: boolean;
    pcd_condicoes: string[];
    pcd_descricao: string;
    observacoes: string;
  } = {
    nome: "",
    telefone: "",
    modalidade: MODALIDADE_PADRAO,
    preferencia_horario: "",
    idade: "",
    pcd: false,
    pcd_condicoes: [] as string[],
    pcd_descricao: "",
    observacoes: "",
  };
  const [novo, setNovo] = useState(filaVazia);

  async function carregarFila() {
    const { data, error } = await supabase
      .from("fila_espera")
      .select("id,nome,telefone,modalidade,preferencia_horario,created_at,idade,pcd,pcd_condicoes,pcd_descricao,observacoes")
      .order("created_at");
    if (error) return toast.error(error.message);
    const lista = ((data ?? []) as Fila[]).slice().sort((a, b) => {
      if (a.pcd !== b.pcd) return a.pcd ? -1 : 1;
      return a.created_at.localeCompare(b.created_at);
    });
    setFila(lista);
    return;
  }

  useEffect(() => {
    void carregarFila();
  }, []);

  async function adicionarFila(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("fila_espera").insert({
      nome: capitalizarNome(novo.nome),
      telefone: novo.telefone || null,
      modalidade: novo.modalidade,
      preferencia_horario: novo.preferencia_horario || null,
      idade: novo.idade ? Number(novo.idade) : null,
      pcd: novo.pcd,
      pcd_condicoes: novo.pcd ? novo.pcd_condicoes : [],
      pcd_descricao: novo.pcd ? novo.pcd_descricao || null : null,
      observacoes: novo.observacoes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Adicionado à fila de espera");
    setNovo(filaVazia);
    void carregarFila();
    return;
  }


  async function removerFila(id: string) {
    const { error } = await supabase.from("fila_espera").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void carregarFila();
    return;
  }

  useEffect(() => {
    void (async () => {
      const [matriculasAtivas, listaTurmas, matTurmas, lics] = await Promise.all([
        supabase.from("matriculas").select("aluno_id,modalidade,alunos!inner(ativo)").eq("status", "ativa").eq("alunos.ativo", true),
        supabase.from("turmas").select("id,nome,horario,capacidade,dias_semana").eq("ativa", true),
        supabase.from("matriculas").select("turma_id").eq("status", "ativa"),
        supabase.from("licencas_medicas").select("id,aluno_id,data_retorno,status,alunos(nome)").eq("status", "ativa"),
      ]);
      const contagens: Record<string, Set<string>> = {};
      for (const matricula of matriculasAtivas.data ?? []) {
        const modalidade = matricula.modalidade as string;
        (contagens[modalidade] ??= new Set()).add(matricula.aluno_id as string);
      }
      setAlunosPorModalidade(Object.fromEntries(Object.entries(contagens).map(([nome, ids]) => [nome, ids.size])));
      const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
      const hojeDia = DIAS[new Date().getDay()];
      const ocup: Record<string, number> = {};
      for (const m of matTurmas.data ?? []) if (m.turma_id) ocup[m.turma_id] = (ocup[m.turma_id] ?? 0) + 1;
      setAulas(
        (listaTurmas.data ?? [])
          .filter((t) => (t.dias_semana ?? []).some((d: string) => normalizarTexto(d).slice(0, 3) === hojeDia))
          .map((t) => ({ id: t.id, nome: t.nome, horario: t.horario, capacidade: t.capacidade, ocupacao: ocup[t.id] ?? 0 }))
          .sort((x, y) => (x.horario ?? "99").localeCompare(y.horario ?? "99")),
      );
      const hoje = dataISO();
      const limite = somarDias(hoje, 7);
      setLicencas(
        (lics.data ?? [])
          .filter((l) => l.data_retorno <= limite)
          .map((l) => ({
            id: l.id,
            aluno_id: l.aluno_id,
            nome: (l.alunos as { nome: string } | null)?.nome ?? "Aluno",
            data_retorno: l.data_retorno,
            vencida: licencaTerminada(l, hoje),
          }))
          .sort((x, y) => (x.vencida !== y.vencida ? (x.vencida ? -1 : 1) : x.data_retorno.localeCompare(y.data_retorno))),
      );
    })();
  }, []);

  return (
    <AppShell title="Painel" subtitle="Visão geral do Esporte 360">
      <PerfilAluno alunoId={perfilId} onFechar={() => setPerfilId(null)} />

      <Card className="mb-6 border-border/70">
        <CardHeader><CardTitle className="font-display text-lg">Alunos por modalidade</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MODALIDADES.map((modalidade) => (
            <div key={modalidade} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-3">
              <span className="text-sm font-medium">{modalidade}</span>
              <Badge variant="secondary" className="bg-card">{alunosPorModalidade[modalidade] ?? 0}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card className="overflow-hidden border-none bg-pool text-primary-foreground shadow-pool">
          <CardContent className="space-y-4 py-8">
            <h2 className="font-display text-2xl font-semibold">Comece a aula</h2>
            <p className="text-sm text-primary-foreground/80">
              Abra o leitor de QR Code e registre a entrada dos alunos na borda da piscina, pelo celular ou pelo computador.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to="/presenca">Registrar presença</Link>
              </Button>
              {/* Nova matrícula só para administradores; professores não veem o botão. */}
              {isAdmin ? (
                <Button asChild variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                  <Link to="/alunos" search={{ novo: true }}>Nova matrícula</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader><CardTitle className="font-display text-lg">Aulas de hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {aulas.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <span className="font-medium">{t.horario ?? "--"}</span>
                <span className="flex-1">{t.nome}</span>
                <Badge variant="secondary" className="bg-card">{t.ocupacao}/{t.capacidade}</Badge>
                <Button asChild size="sm">
                  <Link to="/turmas" search={{ turma: t.id }}>Abrir chamada</Link>
                </Button>
              </div>
            ))}
            {!aulas.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma aula hoje.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-border/70">
        <CardHeader><CardTitle className="font-display text-lg">Licenças e retornos da semana</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {licencas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setPerfilId(l.aluno_id)}
              className="flex w-full flex-wrap items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <Stethoscope className="size-4 text-primary" />
              <span className="flex-1 font-medium">{l.nome}</span>
              {l.vencida ? (
                <Badge variant="destructive">Terminou em {formatarDataCurta(l.data_retorno)} — confirmar retorno</Badge>
              ) : (
                <Badge variant="outline">Retorno {formatarDataCurta(l.data_retorno)}</Badge>
              )}
            </button>
          ))}
          {!licencas.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma licença ou retorno nesta semana.</p>}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/70">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="font-display text-lg">
            Fila de espera <span className="text-sm font-normal text-muted-foreground">({fila.length})</span>
          </CardTitle>
          <Button variant="outline" size="sm" aria-expanded={mostrarFila} onClick={() => setMostrarFila((v) => !v)}>
            {mostrarFila ? <EyeOff className="mr-1 size-4" /> : <Eye className="mr-1 size-4" />}
            {mostrarFila ? "Esconder" : "Mostrar"}
          </Button>
        </CardHeader>
        {mostrarFila ? (
        <CardContent className="space-y-4">
          <form onSubmit={adicionarFila} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Input
                required
                placeholder="Nome"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: capitalizarNome(e.target.value) })}
              />
              <Input
                placeholder="Celular (11) 99999-9999"
                inputMode="numeric"
                value={novo.telefone}
                onChange={(e) => setNovo({ ...novo, telefone: formatarCelular(e.target.value) })}
              />
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="Idade"
                value={novo.idade}
                onChange={(e) => setNovo({ ...novo, idade: e.target.value })}
              />
              <Select value={novo.modalidade} onValueChange={(v) => setNovo({ ...novo, modalidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((modalidade) => (
                    <SelectItem key={modalidade} value={modalidade}>{modalidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={novo.preferencia_horario} onValueChange={(v) => setNovo({ ...novo, preferencia_horario: v })}>
                <SelectTrigger><SelectValue placeholder="Horário preferido" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {listaHorarios.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={2}
              placeholder="Observações"
              value={novo.observacoes}
              onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })}
            />
            <div className="space-y-3 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="fila-pcd">Pessoa com deficiência (PCD)</Label>
                <Switch id="fila-pcd" checked={novo.pcd} onCheckedChange={(v) => setNovo({ ...novo, pcd: v })} />
              </div>
              {novo.pcd ? (
                <div className="space-y-3">
                  {CONDICOES_PCD.map((c) => (
                    <label key={c} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={novo.pcd_condicoes.includes(c)}
                        onCheckedChange={(v) =>
                          setNovo((n) => ({
                            ...n,
                            pcd_condicoes: v ? [...n.pcd_condicoes, c] : n.pcd_condicoes.filter((x) => x !== c),
                          }))
                        }
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                  <Input
                    placeholder="Outras observações sobre a deficiência / apoio"
                    value={novo.pcd_descricao}
                    onChange={(e) => setNovo({ ...novo, pcd_descricao: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
            <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
          </form>

          <div className="space-y-2">
            {fila.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs">{i + 1}</span>
                <span className="font-medium">{f.nome}</span>
                {f.pcd ? <Badge variant="outline">PCD</Badge> : null}
                <span className="text-muted-foreground">{f.modalidade}</span>
                {f.idade != null ? <span className="text-muted-foreground">· {f.idade} anos</span> : null}
                {f.preferencia_horario ? <span className="text-muted-foreground">· {f.preferencia_horario}</span> : null}
                {f.telefone ? <span className="text-muted-foreground">· {f.telefone}</span> : null}
                {f.pcd && (f.pcd_condicoes ?? []).length ? (
                  <span className="w-full text-xs text-muted-foreground">{(f.pcd_condicoes ?? []).join(" · ")}</span>
                ) : null}
                {f.observacoes ? <span className="w-full text-xs text-muted-foreground">{f.observacoes}</span> : null}
                <Button variant="ghost" size="icon" className="ml-auto text-destructive" title="Remover" onClick={() => void removerFila(f.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            {!fila.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno na fila de espera.</p>}
          </div>
        </CardContent>
        ) : null}
      </Card>
    </AppShell>
  );
}
