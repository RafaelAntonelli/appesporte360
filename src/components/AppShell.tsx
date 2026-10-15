import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LayoutDashboard, Users, CalendarDays, QrCode, LogOut, Waves, ShieldCheck, FileBarChart, CloudUpload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePermissoes } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusOffline } from "@/components/StatusOffline";


const baseNav = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/turmas", label: "Turmas", icon: CalendarDays },
  { to: "/presenca", label: "Presença", icon: QrCode },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
];
const adminNav = [
  { to: "/backup", label: "Backup", icon: CloudUpload },
  { to: "/equipe", label: "Equipe", icon: ShieldCheck },
];


export function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { session, loading, isStaff, isAdmin } = useAuth();
  const { pode } = usePermissoes();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Waves className="size-8 animate-pulse text-primary" />
      </div>
    );
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
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 size-4" /> Sair
        </Button>
      </div>
    );
  }

  const nav = (isAdmin ? [...baseNav, ...adminNav] : baseNav).filter((i) => i.to !== "/relatorios" || pode("ver_relatorios"));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <div className="flex items-center gap-2 px-2">
          <img src="/icons/icon-192x192.png" alt="Esporte 360" className="size-9 rounded-xl object-cover" />
          <div className="leading-tight">
            <p className="font-display text-base font-semibold text-sidebar-foreground">Esporte 360</p>
            <p className="text-xs text-muted-foreground">Gestão de alunos</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                pathname === item.to && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Button
          variant="ghost"
          className="justify-start gap-3 text-sidebar-foreground/70"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="size-4" /> Sair
        </Button>
      </aside>

      <StatusOffline />

      <header className="border-b border-border bg-card/60 px-5 py-6 backdrop-blur md:px-10">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>


      <main className="px-5 py-6 md:px-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar md:hidden">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium text-sidebar-foreground/60",
              pathname === item.to && "text-primary",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
