import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { definirContaOffline } from "@/lib/offline";

export type AppRole = "admin" | "professor";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [reconexao, setReconexao] = useState(0);

  useEffect(() => {
    const reconectar = () => setReconexao((n) => n + 1);
    window.addEventListener("online", reconectar);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      definirContaOffline(s?.user?.id ?? null);
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      definirContaOffline(data.session?.user?.id ?? null);
      setSession(data.session);
      setLoading(false);
    });
    return () => { sub.subscription.unsubscribe(); window.removeEventListener("online", reconectar); };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }
    let active = true;
    if (!navigator.onLine) { setRoles([]); setRolesLoading(false); return; }
    setRolesLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!active) return;
        setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
        setRolesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id, reconexao]);

  return {
    session,
    loading: loading || rolesLoading,
    user: session?.user ?? null,
    roles,
    isAdmin: roles.includes("admin"),
    isStaff: roles.length > 0,
  };
}
