import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  QrCode,
  LogOut,
  Waves,
  ShieldCheck,
  FileBarChart,
  CloudUpload,
  Megaphone,
  Menu,
  Moon,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { useTema } from "@/lib/tema";
import { rotuloPapel, useMeuPerfil } from "@/lib/meu-perfil";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusOffline } from "@/components/StatusOffline";
import { FotoUsuario } from "@/components/FotoUsuario";
import fundoMenu from "@/assets/fundo-menu-esporte-360.jpg.asset.json";
import faixaSeculje from "@/assets/faixa-seculje.jpg.asset.json";

type ItemMenu = { to: string; label: string; icon: LucideIcon };

/** Os 4 botões principais (barra inferior do celular). */
const principais: ItemMenu[] = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/turmas", label: "Turmas", icon: CalendarDays },
  { to: "/presenca", label: "Presença", icon: QrCode },
];
const relatorios: ItemMenu = { to: "/relatorios", label: "Relatórios", icon: FileBarChart };
/** Somente administradores: os professores não veem estes itens. */
const adminNav: ItemMenu[] = [
  { to: "/avisos", label: "Avisos", icon: Megaphone },
  { to: "/backup", label: "Backup", icon: CloudUpload },
  { to: "/equipe", label: "Equipe", icon: ShieldCheck },
];

const classeBotaoMenu =
  "justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

export function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { session, loading, isStaff, isAdmin, user } = useAuth();
  const { pode } = usePermissoes();
  const { escuro, alternar } = useTema();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [maisAberto, setMaisAberto] = useState(false);
  const perfil = useMeuPerfil(user);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    setMaisAberto(false);
  }, [pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Waves className="size-8 animate-pulse text-primary" />
      </div>
    );
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Waves className="size-8 text-primary" />
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Acesso aguardando liberação</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Sua conta foi criada, mas ainda não tem permissão para acessar os dados. Peça a um administrador da Arena
            Aquática para liberar seu acesso.
          </p>
        </div>
        <Button variant="outline" onClick={() => void sair()}>
          <LogOut className="mr-2 size-4" /> Sair
        </Button>
      </div>
    );
  }

  // Mesmas regras de antes: Relatórios segue a permissão; Avisos, Backup e Equipe só para administradores.
  const extras: ItemMenu[] = [...(pode("ver_relatorios") ? [relatorios] : []), ...(isAdmin ? adminNav : [])];
  const nav = [...principais, ...extras];
  const ativo = (to: string) => pathname === to;
  const extraAtivo = extras.some((i) => ativo(i.to)) || ativo("/perfil");
  const IconeTema = escuro ? Sun : Moon;
  const rotuloTema = escuro ? "Modo claro" : "Modo escuro";
  const papel = rotuloPapel(isAdmin);

  return (
    <div className="min-h-screen bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-64">
      {/* Menu lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-sidebar px-4 py-6 md:flex">
        {/* Fundo: imagem do Programa Esporte 360 em pé + véu na cor do menu. Não recebe cliques. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center">
          <img
            src={fundoMenu.url}
            alt=""
            draggable={false}
            className="h-[86%] max-h-[60rem] w-full select-none object-cover opacity-45"
          />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-veu-menu" />

        <Link
          to="/perfil"
          title="Abrir Meu perfil"
          className="relative z-10 flex shrink-0 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-sidebar-accent/70"
        >
          <FotoUsuario url={perfil.fotoUrl} nome={perfil.nome} className="size-11" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-base font-semibold text-sidebar-foreground">{perfil.nome}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{papel}</p>
          </div>
        </Link>
        <nav className="relative z-10 mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ativo(item.to) && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]",
              )}
            >
              <item.icon className={cn("size-4", ativo(item.to) && "text-sidebar-primary")} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="relative z-10 mt-3 flex shrink-0 flex-col gap-1 border-t border-sidebar-border pt-3">
          <Button
            asChild
            variant="ghost"
            className={cn(classeBotaoMenu, ativo("/perfil") && "bg-sidebar-accent text-sidebar-accent-foreground")}
          >
            <Link to="/perfil">
              <UserRound className="size-4" /> Meu perfil
            </Link>
          </Button>
          <Button variant="ghost" className={classeBotaoMenu} onClick={alternar} aria-pressed={escuro}>
            <IconeTema className="size-4" /> {rotuloTema}
          </Button>
          <Button variant="ghost" className={classeBotaoMenu} onClick={() => void sair()}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Topo azul-marinho (celular): foto, nome e papel de quem entrou */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-sidebar px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
        <Link to="/perfil" title="Abrir Meu perfil" className="flex min-w-0 items-center gap-2.5">
          <FotoUsuario url={perfil.fotoUrl} nome={perfil.nome} className="size-9" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-sm font-semibold text-sidebar-foreground">{perfil.nome}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{papel}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => void sair()}
        >
          <LogOut className="size-4" /> Sair
        </Button>
      </div>

      <StatusOffline />

      {/* Barra superior: no computador, degradê até a faixa da SECULJE à direita */}
      <header className="border-b border-border bg-card/60 backdrop-blur md:flex md:h-24 md:items-stretch md:bg-card">
        <div className="flex min-w-0 flex-1 items-center px-4 py-5 md:bg-faixa-topo md:px-10 md:py-0">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <img
          src={faixaSeculje.url}
          alt="SECULJE — Secretaria de Esporte, Saber, Juventude e Esports de Lauro de Freitas"
          draggable={false}
          className="hidden h-full w-auto shrink-0 md:block"
        />
      </header>

      <main className="min-w-0 px-4 py-6 md:px-10">{children}</main>

      {/* Barra inferior (celular): 4 principais + Mais */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
        {principais.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-sidebar-foreground/60",
              ativo(item.to) && "text-sidebar-primary",
            )}
          >
            <item.icon className="size-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          aria-label="Mais opções"
          className={cn(
            "flex min-w-0 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-sidebar-foreground/60",
            (maisAberto || extraAtivo) && "text-sidebar-primary",
          )}
        >
          <Menu className="size-5" />
          <span>Mais</span>
        </button>
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Mais opções</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-1">
            {extras.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent",
                  ativo(item.to) && "bg-accent text-primary",
                )}
              >
                <item.icon className="size-5 text-primary" />
                {item.label}
              </Link>
            ))}
            <Link
              to="/perfil"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent",
                ativo("/perfil") && "bg-accent text-primary",
              )}
            >
              <UserRound className="size-5 text-primary" />
              Meu perfil
            </Link>
            <button
              type="button"
              onClick={alternar}
              aria-pressed={escuro}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <IconeTema className="size-5 text-primary" />
              {rotuloTema}
            </button>
            <button
              type="button"
              onClick={() => void sair()}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-destructive-strong transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-5" />
              Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
