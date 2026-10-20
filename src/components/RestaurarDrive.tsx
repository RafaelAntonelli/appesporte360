import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DatabaseBackup, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listarPlanilhasBackupFn, prepararRestauracaoFn, restaurarLoteFn } from "@/lib/backup.functions";

const LOTE = 4;
const SO_ARQUIVOS = "__arquivos__";

type Planilha = { id: string; nome: string; modificadoEm: string | null };
type Falha = { nome: string; motivo: string };
type Resumo = {
  alunosCriados: number;
  alunosExistentes: number;
  linhasIgnoradas: number;
  matriculasCriadas: number;
  arquivosEncontrados: number;
  restaurados: number;
  ignorados: number;
  jaVinculados: number;
  foraDoPadrao: number;
  semAluno: string[];
  falhas: Falha[];
};

/** Restauração: recria alunos da planilha de backup e vincula fotos/documentos pelo código de matrícula. */
export function RestaurarDrive() {
  const listar = useServerFn(listarPlanilhasBackupFn);
  const preparar = useServerFn(prepararRestauracaoFn);
  const restaurar = useServerFn(restaurarLoteFn);
  const [planilhas, setPlanilhas] = useState<Planilha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [escolhida, setEscolhida] = useState(SO_ARQUIVOS);
  const [substituir, setSubstituir] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState<{ etapa: string; feitos: number; total: number } | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [verFalhas, setVerFalhas] = useState(false);

  async function carregarPlanilhas() {
    setCarregando(true);
    try {
      const lista = await listar({ data: undefined });
      setPlanilhas(lista);
      if (!lista.length) toast.info("Nenhuma planilha encontrada na pasta de planilhas do Drive.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível listar as planilhas.");
    } finally {
      setCarregando(false);
    }
  }

  async function executar() {
    const planilhaId = escolhida === SO_ARQUIVOS ? null : escolhida;
    const aviso = planilhaId
      ? "Os alunos da planilha que não existem mais serão recriados com o mesmo código de matrícula, e os arquivos do Drive serão vinculados. Continuar?"
      : "Os arquivos do Drive serão vinculados aos alunos pelo código de matrícula no nome. Continuar?";
    if (!window.confirm(aviso)) return;
    setExecutando(true);
    setResumo(null);
    setProgresso({ etapa: planilhaId ? "Lendo a planilha e os arquivos do Drive…" : "Lendo os arquivos do Drive…", feitos: 0, total: 0 });
    try {
      const prep = await preparar({ data: { planilhaId, substituir } });
      if (!prep.ok) throw new Error(prep.erro);
      const total = prep.tarefas.length;
      let restaurados = 0;
      let ignorados = 0;
      const falhas: Falha[] = [...prep.errosPlanilha];
      for (let i = 0; i < total; i += LOTE) {
        const parte = prep.tarefas.slice(i, i + LOTE);
        setProgresso({ etapa: "Baixando e vinculando arquivos…", feitos: i, total });
        try {
          const r = await restaurar({ data: { tarefas: parte, substituir } });
          restaurados += r.restaurados;
          ignorados += r.ignorados;
          falhas.push(...r.falhas);
        } catch (err) {
          const motivo = err instanceof Error ? err.message : "Falha na restauração";
          falhas.push(...parte.map((t) => ({ nome: t.nome, motivo })));
        }
      }
      setProgresso(null);
      const final: Resumo = {
        alunosCriados: prep.alunosCriados,
        alunosExistentes: prep.alunosExistentes,
        linhasIgnoradas: prep.linhasIgnoradas,
        matriculasCriadas: prep.matriculasCriadas,
        arquivosEncontrados: prep.arquivosEncontrados,
        restaurados,
        ignorados,
        jaVinculados: prep.jaVinculados,
        foraDoPadrao: prep.foraDoPadrao,
        semAluno: prep.semAluno,
        falhas,
      };
      setResumo(final);
      if (falhas.length) toast.error(`Restauração concluída com ${falhas.length} falha(s).`);
      else toast.success(`Restauração concluída: ${restaurados} arquivo(s) vinculados.`);
    } catch (err) {
      setProgresso(null);
      toast.error(err instanceof Error ? err.message : "Falha na restauração");
    } finally {
      setExecutando(false);
    }
  }

  const pct = progresso && progresso.total > 0 ? Math.round((progresso.feitos / progresso.total) * 100) : undefined;

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <DatabaseBackup className="size-4" /> Restaurar a partir do Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cada foto e documento no Drive tem o nome no padrão <span className="font-mono">CÓDIGO_TIPO.extensão</span> (por
          exemplo, <span className="font-mono">A7B92K1_atestado.pdf</span>). A restauração usa o código de matrícula do
          nome para ligar o arquivo ao aluno certo, mesmo quando há alunos com nomes iguais.
        </p>

        <div className="space-y-2">
          <Label>Planilha de backup</Label>
          <div className="flex flex-wrap gap-2">
            <Select value={escolhida} onValueChange={setEscolhida} disabled={executando}>
              <SelectTrigger className="min-w-64 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SO_ARQUIVOS}>Só vincular os arquivos (sem planilha)</SelectItem>
                {(planilhas ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.modificadoEm ? ` · ${new Date(p.modificadoEm).toLocaleDateString("pt-BR")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={carregando || executando} onClick={() => void carregarPlanilhas()}>
              <RefreshCw className={`size-4 ${carregando ? "animate-spin" : ""}`} />
              {planilhas ? "Atualizar lista" : "Buscar planilhas no Drive"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Com uma planilha, os alunos que não existem mais no sistema são recriados com o mesmo código de matrícula. Os
            alunos que já existem não são alterados.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Switch id="restaurar-substituir" checked={substituir} disabled={executando} onCheckedChange={setSubstituir} />
          <Label htmlFor="restaurar-substituir" className="space-y-0.5 font-normal">
            <span className="block text-sm font-medium text-foreground">Substituir arquivos que já existem</span>
            <span className="block text-xs text-muted-foreground">
              Desligado: só preenche fotos e documentos que estão faltando.
            </span>
          </Label>
        </div>

        {progresso ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between text-sm">
              <span>{progresso.etapa}</span>
              {pct !== undefined ? <span className="tabular-nums text-muted-foreground">{pct}%</span> : null}
            </div>
            <Progress value={pct} />
            {progresso.total > 0 ? (
              <p className="text-xs text-muted-foreground">
                {progresso.feitos} de {progresso.total} arquivos
              </p>
            ) : null}
          </div>
        ) : null}

        <Button disabled={executando} onClick={() => void executar()}>
          <DatabaseBackup className="size-4" /> {executando ? "Restaurando…" : "Restaurar"}
        </Button>

        {resumo ? (
          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {escolhida !== SO_ARQUIVOS ? (
              <>
                <p>Alunos recriados: {resumo.alunosCriados} · já existiam: {resumo.alunosExistentes}</p>
                <p>Matrículas em turmas recriadas: {resumo.matriculasCriadas}</p>
                {resumo.linhasIgnoradas ? <p>Linhas sem código de matrícula válido: {resumo.linhasIgnoradas}</p> : null}
              </>
            ) : null}
            <p>Arquivos no padrão encontrados no Drive: {resumo.arquivosEncontrados}</p>
            <p>Arquivos vinculados agora: {resumo.restaurados}</p>
            {resumo.jaVinculados + resumo.ignorados ? (
              <p>Mantidos (o aluno já tinha o arquivo): {resumo.jaVinculados + resumo.ignorados}</p>
            ) : null}
            {resumo.foraDoPadrao ? <p>Arquivos com nome fora do padrão (ignorados): {resumo.foraDoPadrao}</p> : null}
            {resumo.semAluno.length ? (
              <p className="break-words">
                Matrículas sem aluno no sistema: {resumo.semAluno.slice(0, 20).join(", ")}
                {resumo.semAluno.length > 20 ? ` e mais ${resumo.semAluno.length - 20}` : ""}
              </p>
            ) : null}
            {resumo.falhas.length ? (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setVerFalhas(true)}>
                Ver falhas ({resumo.falhas.length})
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={verFalhas} onOpenChange={setVerFalhas}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Itens que não foram restaurados</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(resumo?.falhas ?? []).map((f, i) => (
              <li key={`${f.nome}-${i}`} className="rounded border border-border p-2">
                <p className="break-all font-medium">{f.nome}</p>
                <p className="text-muted-foreground">{f.motivo}</p>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
