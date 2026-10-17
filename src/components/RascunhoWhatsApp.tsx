import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Copy, MessageCircle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { rascunhoWhatsAppIA } from "@/lib/ai.functions";
import { linkWhatsApp } from "@/lib/whatsapp";
import { usePermissoes } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiErro } from "./AiRevisao";
export function RascunhoWhatsApp({ telefone }: { telefone: string | null | undefined }) {
  const permissoes = usePermissoes();
  const gerar = useServerFn(rascunhoWhatsAppIA);
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"lembrete" | "frequencia" | "retorno">("lembrete");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<{ erro: string; bloqueado?: boolean } | null>(null);
  const href = linkWhatsApp(telefone);
  if (!permissoes.pode("editar_alunos")) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
      >
        <Sparkles className="size-4" />
        Rascunho com IA
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Mensagem para WhatsApp</DialogTitle>
          </DialogHeader>
          <Label>Tipo de mensagem</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lembrete">Lembrete</SelectItem>
              <SelectItem value="frequencia">Acompanhamento de frequência</SelectItem>
              <SelectItem value="retorno">Retorno às aulas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setErro(null);
              try {
                const r = await gerar({ data: { tipo } });
                if (!r.ok) setErro(r);
                else setTexto(r.resultado.texto);
              } catch {
                setErro({ erro: "Não foi possível gerar o rascunho." });
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {ocupado ? "Gerando…" : "Gerar rascunho"}
          </Button>
          <p className="text-xs text-muted-foreground">IA · Consome créditos do workspace.</p>
          {erro ? <AiErro {...erro} aoRetomar={() => setErro(null)} /> : null}
          <Label htmlFor="texto-whatsapp">Revisar mensagem</Label>
          <Textarea
            id="texto-whatsapp"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!texto.trim()}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(texto);
                  toast.success("Mensagem copiada.");
                } catch {
                  toast.error("Não foi possível copiar a mensagem.");
                }
              }}
            >
              <Copy className="size-4" />
              Copiar
            </Button>
            {href && texto.trim() ? (
              <Button asChild>
                <a
                  href={`${href}?text=${encodeURIComponent(texto)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" />
                  Abrir WhatsApp
                </a>
              </Button>
            ) : (
              <Button disabled>
                <MessageCircle className="size-4" />
                Abrir WhatsApp
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
