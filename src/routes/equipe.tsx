import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
  head: () => ({
    meta: [
      { title: "Equipe | Arena Aquática" },
      { name: "description", content: "Controle quem da equipe pode acessar os dados de alunos, turmas e presenças." },
      { property: "og:title", content: "Equipe | Arena Aquática" },
      { property: "og:description", content: "Gestão de acessos da equipe da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Membro = { id: string; nome: string | null; email: string | null; roles: AppRole[] };

function EquipePage() {
  const { isAdmin, loading, user } = useAuth();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const [{ data: perfis }, { data: papeis }] = await Promise.all([
      supabase.from("profiles").select("id, nome, email"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const mapa = new Map<string, AppRole[]>();
    for (const p of (papeis ?? []) as { user_id: string; role: AppRole }[]) {
      mapa.set(p.user_id, [...(mapa.get(p.user_id) ?? []), p.role]);
    }
    setMembros(
      ((perfis ?? []) as { id: string; nome: string | null; email: string | null }[]).map((p) => ({
        ...p,
        roles: mapa.get(p.id) ?? [],
      })),
    );
    setCarregando(false);
  }

  useEffect(() => {
    if (isAdmin) void carregar();
    else setCarregando(false);
  }, [isAdmin]);

  async function definirPapel(userId: string, role: AppRole | null) {
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) {
      toast.error(del.error.message);
      return;
    }
    if (role) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Acesso atualizado");
    void carregar();
  }

  if (loading) return null;

  return (
    <AppShell title="Equipe" subtitle="Defina quem pode acessar os dados do sistema">
      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Apenas administradores podem gerenciar os acessos da equipe.
          </CardContent>
        </Card>
      ) : carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3">
          {membros.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{m.nome || m.email || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                  <div className="mt-1 flex gap-1">
                    {m.roles.length === 0 ? (
                      <Badge variant="outline">Sem acesso</Badge>
                    ) : (
                      m.roles.map((r) => (
                        <Badge key={r} variant="secondary">
                          {r === "admin" ? "Administrador" : "Professor"}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => definirPapel(m.id, "professor")}>
                    <UserCheck className="mr-1 size-4" /> Professor
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => definirPapel(m.id, "admin")}>
                    <ShieldCheck className="mr-1 size-4" /> Administrador
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={m.id === user?.id}
                    onClick={() => definirPapel(m.id, null)}
                  >
                    <UserX className="mr-1 size-4" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
