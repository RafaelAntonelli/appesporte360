import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { iniciaisDoNome } from "@/lib/meu-perfil";
import { cn } from "@/lib/utils";

/** Foto de quem entrou; sem foto, círculo com as iniciais do nome. */
export function FotoUsuario({ url, nome, className }: { url: string | null; nome: string; className?: string }) {
  return (
    <Avatar className={cn("size-10 shrink-0 ring-2 ring-sidebar-primary/60", className)}>
      {url ? <AvatarImage src={url} alt={`Foto de ${nome}`} className="object-cover" /> : null}
      <AvatarFallback className="bg-sidebar-primary font-display text-sm font-semibold text-sidebar-primary-foreground">
        {iniciaisDoNome(nome)}
      </AvatarFallback>
    </Avatar>
  );
}
