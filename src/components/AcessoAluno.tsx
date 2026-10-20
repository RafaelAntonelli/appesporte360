import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { entrarAlunoFn, solicitarLiberacaoFn, statusAparelhoFn } from "@/lib/aluno.functions";
import { conteudoQrAparelho, formatarCodigoAparelho } from "@/lib/aluno-acesso";
import { dispositivoLocal, pedidoLocal, salvarPedidoLocal, salvarTokenLocal, tokenLocal, type PedidoLocal } from "@/lib/aluno-local";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mensagem = { tipo: "erro" | "info"; texto: string } | null;

function restante(expiraEm: string, agora: number) {
  const s = Math.max(0, Math.floor((new Date(expiraEm).getTime() - agora) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function AcessoAluno({ bloqueado }: { bloqueado: boolean }) {
  const navigate = useNavigate();
  const entrar = useServerFn(entrarAlunoFn);
  const solicitar = useServerFn(solicitarLiberacaoFn);
  const status = useServerFn(statusAparelhoFn);
  const [identificador, setIdentificador] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [busy, setBusy] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [podeSolicitar, setPodeSolicitar] = useState(false);
  const [pedido, setPedido] = useState<PedidoLocal | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    let vivo = true;
    void status({ data: { token: tokenLocal() } })
      .then((s) => {
        if (!vivo) return;
        if (s.sessaoAtiva) navigate({ to: "/aluno" });
        else if (s.status === "pendente") setPedido(pedidoLocal());
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!pedido) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const consulta = setInterval(() => {
      void status({ data: { token: tokenLocal() } })
        .then((s) => {
          if (s.status === "liberado") {
            salvarPedidoLocal(null);
            toast.success("Aparelho liberado! Bem-vindo(a).");
            navigate({ to: "/aluno" });
          } else if (s.status === "recusado" || s.status === "revogado") {
            salvarPedidoLocal(null);
            setPedido(null);
            setMensagem({ tipo: "erro", texto: "O pedido foi recusado. Procure a administração!" });
          }
        })
        .catch(() => undefined);
    }, 4000);
    return () => {
      clearInterval(relogio);
      clearInterval(consulta);
    };
  }, [pedido]);

  const dados = () => ({ identificador, nascimento, dispositivo: dispositivoLocal(), token: tokenLocal() });

  async function aoEntrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMensagem(null);
    try {
      const r = await entrar({ data: dados() });
      if (r.ok) return void navigate({ to: "/aluno" });
      setMensagem({ tipo: r.motivo === "aparelho" || r.motivo === "pendente" ? "info" : "erro", texto: r.mensagem });
      setPodeSolicitar(r.motivo === "aparelho" || r.motivo === "pendente");
      if (r.motivo === "pendente") setPedido(pedidoLocal());
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível entrar agora. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  async function aoSolicitar() {
    if (!identificador.trim() || !nascimento) {
      setMensagem({ tipo: "erro", texto: "Preencha o CPF ou a matrícula e a data de nascimento." });
      return;
    }
    setBusy(true);
    setMensagem(null);
    try {
      const r = await solicitar({ data: dados() });
      if (!r.ok) {
        setPedido(null);
        salvarPedidoLocal(null);
        setMensagem({ tipo: "erro", texto: r.mensagem });
        return;
      }
      if (r.liberado) return void navigate({ to: "/aluno" });
      salvarTokenLocal(r.token);
      const p = { codigo: r.codigo, expiraEm: r.expiraEm };
      salvarPedidoLocal(p);
      setPedido(p);
      setAgora(Date.now());
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível gerar o pedido. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  const expirado = pedido ? new Date(pedido.expiraEm).getTime() <= agora : false;

  return (
    <div className="space-y-4">
      {pedido ? (
        <div className="space-y-3 rounded-lg border border-border p-4 text-center">
          <p className="text-sm font-medium text-foreground">Mostre este QR Code na administração</p>
          <div className={`mx-auto w-fit rounded-lg bg-card p-3 ${expirado ? "opacity-30" : ""}`}>
            <QRCodeSVG value={conteudoQrAparelho(pedido.codigo)} size={196} level="M" />
          </div>
          <p className="font-mono text-2xl font-semibold tracking-widest text-foreground" aria-label="Código do aparelho">
            {formatarCodigoAparelho(pedido.codigo)}
          </p>
          <p className="text-xs text-muted-foreground">
            {expirado ? "O pedido expirou. Renove para gerar um novo código." : `Válido por ${restante(pedido.expiraEm, agora)} · aguardando liberação…`}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy || bloqueado} onClick={() => void aoSolicitar()}>
            <RefreshCw className="mr-1 size-4" /> Renovar pedido
          </Button>
          {!identificador || !nascimento ? (
            <p className="text-xs text-muted-foreground">Para renovar, preencha seus dados abaixo.</p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={aoEntrar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="aluno-id">CPF ou código de matrícula</Label>
          <Input
            id="aluno-id"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="000.000.000-00 ou AB12CD3"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aluno-nasc">Data de nascimento</Label>
          <Input id="aluno-nasc" type="date" required value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
        </div>
        {mensagem ? (
          <p
            role="alert"
            className={
              mensagem.tipo === "erro"
                ? "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                : "rounded-md bg-muted p-3 text-sm text-foreground"
            }
          >
            {mensagem.texto}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy || bloqueado}>
          Entrar
        </Button>
        <Button
          type="button"
          variant={podeSolicitar ? "default" : "outline"}
          className="w-full"
          disabled={busy || bloqueado}
          onClick={() => void aoSolicitar()}
        >
          <Smartphone className="mr-2 size-4" /> Solicitar liberação deste aparelho
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          No primeiro acesso, o aparelho precisa ser liberado pessoalmente por um administrador.
        </p>
      </form>
    </div>
  );
}
