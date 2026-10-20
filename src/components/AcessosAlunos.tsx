import { useEffect, useRef, useState } from "react";
import { Check, QrCode, RefreshCw, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { codigoAparelhoValido, normalizarCodigoAparelho } from "@/lib/aluno-acesso";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Aparelho = {
  id: string;
  status: string;
  codigo_final: string | null;
  pedido_em: string;
  pedido_expira_em: string;
  liberado_em: string | null;
  liberado_ate: string | null;
  liberado_por_nome: string | null;
  ultimo_acesso: string | null;
  descricao: string | null;
  alunos: { nome: string; codigo: string } | null;
};

const hora = (v: string) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataHora = (v: string | null) => (v ? `${new Date(v).toLocaleDateString("pt-BR")} ${hora(v)}` : "—");

export function AcessosAlunos() {
  const [lista, setLista] = useState<Aparelho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [liberar, setLiberar] = useState<Aparelho | null>(null);
  const [presente, setPresente] = useState(false);
  const [acao, setAcao] = useState<{ tipo: "recusar" | "revogar"; aparelho: Aparelho } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const scanner = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const processando = useRef(false);

  async function carregar() {
    const { data, error } = await supabase
      .from("aluno_aparelhos")
      .select("id,status,codigo_final,pedido_em,pedido_expira_em,liberado_em,liberado_ate,liberado_por_nome,ultimo_acesso,descricao,alunos(nome,codigo)")
      .in("status", ["pendente", "liberado"])
      .order("pedido_em", { ascending: false });
    setCarregando(false);
    setAgora(Date.now());
    if (error) return void toast.error("Não foi possível carregar os acessos dos alunos.");
    setLista((data ?? []) as Aparelho[]);
    return (data ?? []) as Aparelho[];
  }

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 30_000);
    return () => clearInterval(t);
  }, []);

  const pendentes = lista.filter((a) => a.status === "pendente" && new Date(a.pedido_expira_em).getTime() > agora);
  const liberados = lista.filter((a) => a.status === "liberado" && a.liberado_ate && new Date(a.liberado_ate).getTime() > agora);

  async function abrirPorCodigo(texto: string) {
    const codigo = normalizarCodigoAparelho(texto);
    if (!codigoAparelhoValido(codigo)) {
      toast.error("Código do aparelho inválido.");
      return false;
    }
    const { data: id, error } = await supabase.rpc("buscar_pedido_aparelho", { _codigo: codigo });
    if (error || !id) {
      toast.error("Pedido não encontrado ou expirado. Peça ao aluno para renovar.");
      return false;
    }
    const atual = (await carregar()) ?? lista;
    const alvo = atual.find((a) => a.id === id);
    if (!alvo) {
      toast.error("Pedido não encontrado.");
      return false;
    }
    setPresente(false);
    setLiberar(alvo);
    return true;
  }

  async function pararLeitura() {
    try {
      await scanner.current?.stop();
      scanner.current?.clear();
    } catch {
      /* ignora */
    }
    scanner.current = null;
  }

  useEffect(() => {
    if (!lendo) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        const s = new Html5Qrcode("leitor-qr-aparelho");
        scanner.current = s as unknown as { stop: () => Promise<void>; clear: () => void };
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (texto) => {
            if (processando.current) return;
            processando.current = true;
            void abrirPorCodigo(texto).then(async (ok) => {
              if (ok) {
                await pararLeitura();
                setLendo(false);
              }
              setTimeout(() => (processando.current = false), 1500);
            });
          },
          () => {},
        );
      } catch {
        toast.error("Não foi possível acessar a câmera. Digite o código do aparelho.");
      }
    }, 150);
    return () => {
      cancelado = true;
      clearTimeout(t);
      void pararLeitura();
    };
  }, [lendo]);

  async function confirmarLiberacao() {
    if (!liberar || !presente) return;
    const { error } = await supabase.rpc("liberar_aparelho_aluno", { _id: liberar.id });
    if (error) return void toast.error(error.message || "Não foi possível liberar o aparelho.");
    toast.success(`Aparelho de ${liberar.alunos?.nome ?? "aluno"} liberado por 180 dias.`);
    setLiberar(null);
    void carregar();
  }

  async function executarAcao() {
    if (!acao) return;
    const { error } =
      acao.tipo === "recusar"
        ? await supabase.rpc("recusar_aparelho_aluno", { _id: acao.aparelho.id })
        : await supabase.rpc("revogar_aparelho_aluno", { _id: acao.aparelho.id });
    setAcao(null);
    if (error) return void toast.error(error.message || "Não foi possível concluir.");
    toast.success(acao.tipo === "recusar" ? "Pedido recusado." : "Acesso do aparelho revogado.");
    void carregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setLendo(true)}>
          <QrCode className="mr-1 size-4" /> Ler QR Code
        </Button>
        <Button variant="outline" onClick={() => void carregar()}>
          <RefreshCw className="mr-1 size-4" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Aguardando liberação <span className="text-sm font-normal text-muted-foreground">({pendentes.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {!carregando && !pendentes.length ? <p className="text-sm text-muted-foreground">Nenhum pedido no momento. A lista atualiza a cada 30 segundos.</p> : null}
          {pendentes.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">{a.alunos?.nome ?? "Aluno"}</p>
                <p className="text-xs text-muted-foreground">
                  Matrícula {a.alunos?.codigo ?? "—"} · Pedido às {hora(a.pedido_em)} · Código ••••-{a.codigo_final ?? "????"} · Válido até {hora(a.pedido_expira_em)}
                  {a.descricao ? ` · ${a.descricao}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setPresente(false); setLiberar(a); }}>
                  <Check className="mr-1 size-4" /> Liberar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAcao({ tipo: "recusar", aparelho: a })}>
                  <X className="mr-1 size-4" /> Recusar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Aparelhos liberados <span className="text-sm font-normal text-muted-foreground">({liberados.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!carregando && !liberados.length ? <p className="text-sm text-muted-foreground">Nenhum aparelho liberado.</p> : null}
          {liberados.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">
                  {a.alunos?.nome ?? "Aluno"} {a.descricao ? <Badge variant="outline" className="ml-1">{a.descricao}</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  Matrícula {a.alunos?.codigo ?? "—"} · Liberado em {dataHora(a.liberado_em)}
                  {a.liberado_por_nome ? ` por ${a.liberado_por_nome}` : ""} · Vale até {a.liberado_ate ? new Date(a.liberado_ate).toLocaleDateString("pt-BR") : "—"} · Último acesso {dataHora(a.ultimo_acesso)}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAcao({ tipo: "revogar", aparelho: a })}>
                <ShieldOff className="mr-1 size-4" /> Revogar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={lendo} onOpenChange={setLendo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ler QR Code do aparelho</DialogTitle>
            <DialogDescription>Aponte a câmera para o QR Code na tela do aluno.</DialogDescription>
          </DialogHeader>
          <div id="leitor-qr-aparelho" className="min-h-60 w-full overflow-hidden rounded-lg bg-muted" />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void abrirPorCodigo(codigoManual).then((ok) => {
                if (ok) {
                  setCodigoManual("");
                  setLendo(false);
                }
              });
            }}
          >
            <Input placeholder="Ou digite o código (ABCD-2345)" value={codigoManual} onChange={(e) => setCodigoManual(e.target.value.toUpperCase())} />
            <Button type="submit" variant="outline">OK</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!liberar} onOpenChange={(o) => !o && setLiberar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Liberar aparelho</DialogTitle>
            <DialogDescription>
              {liberar?.alunos?.nome} · Matrícula {liberar?.alunos?.codigo} · Código ••••-{liberar?.codigo_final}
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={presente} onCheckedChange={(v) => setPresente(v === true)} />
            <span>Confirmo que o aluno está presente e conferi a identidade dele.</span>
          </label>
          <p className="text-xs text-muted-foreground">A liberação vale por 180 dias.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLiberar(null)}>Cancelar</Button>
            <Button disabled={!presente} onClick={() => void confirmarLiberacao()}>Liberar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!acao} onOpenChange={(o) => !o && setAcao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{acao?.tipo === "recusar" ? "Recusar pedido?" : "Revogar acesso?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {acao?.tipo === "recusar"
                ? `O pedido de ${acao?.aparelho.alunos?.nome ?? "aluno"} será recusado.`
                : `O aparelho de ${acao?.aparelho.alunos?.nome ?? "aluno"} perderá o acesso e precisará de nova liberação presencial.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executarAcao()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
