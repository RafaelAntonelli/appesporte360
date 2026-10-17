import { RascunhoWhatsApp } from "./RascunhoWhatsApp";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkWhatsApp } from "@/lib/whatsapp";

export function ConversarWhatsApp({ telefone }: { telefone: string | null | undefined }) {
  const href = linkWhatsApp(telefone);
  if (!href) {
    return (
      <span title="Cadastre um celular válido com DDD">
        <Button type="button" variant="outline" size="sm" disabled>
          <MessageCircle /> Conversar no WhatsApp
        </Button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2"><Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
        <MessageCircle /> Conversar no WhatsApp
      </a>
    </Button><RascunhoWhatsApp telefone={telefone}/></span>
  );
}