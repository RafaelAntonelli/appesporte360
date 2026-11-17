import { useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSOES } from "@/lib/permissoes";
import { Carregando } from "@/components/Carregando";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Acao = { id: string; created_at: string; tipo: string; descricao: string; feito_por_nome: string | null };

/** Troca a chave técnica da permissão pelo nome que aparece na tela. */
function textoAcao(a: Acao) {
  if (a.tipo !== "permissao_liberada" && a.tipo !== "permissao_bloqueada") return a.descricao;
  return a.descricao.replace(/: (\w+)$/, (_, chave: string) => `: ${PERMISSOES.find((p) => p.chave === chave)?.rotulo ?? chave}`);
}

/** Últimas 200 ações registradas automaticamente. Só leitura: ninguém edita nem apaga pelo app. */
export function RegistroAcoes() {
  const [acoes, setAcoes] = useState<Acao[] | null>(null);
  const [erro, setErro] = useState(false);

  async function carregar() {
    setErro(false);
    const { data, error } = await supabase
      .from("registro_acoes")
      .select("id,created_at,tipo,descricao,feito_por_nome")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setErro(true);
      return;
    }
    setAcoes(data as Acao[]);
  }
  useEffect(() => {
    void carregar();
  }, []);

  if (erro) {
    return (
      <EstadoVazio
        tom="erro"
        icone={History}
        titulo="Não foi possível carregar o registro de ações"
        descricao="Confira a internet e tente de novo."
        acoes={<Button onClick={() => void carregar()}><RefreshCw className="size-4" /> Tentar de novo</Button>}
      />
    );
  }
  if (!acoes) return <Carregando formato="linhas" quantidade={6} rotulo="Carregando registro de ações..." />;
  if (!acoes.length) {
    return (
      <EstadoVazio
        icone={History}
        titulo="Nenhuma ação registrada ainda"
        descricao="Aqui vão aparecer, com quem fez, data e hora: alunos excluídos, acessos da equipe concedidos ou retirados, permissões dos professores liberadas ou bloqueadas e contas aguardando liberação removidas."
      />
    );
  }
  return (
    <Card className="border-border/70">
      <CardContent className="p-0">
        <p className="border-b border-border/70 px-4 py-3 text-xs text-muted-foreground">
          Últimas {acoes.length} ações, da mais recente para a mais antiga. Este registro não pode ser editado nem apagado.
        </p>
        <ul className="divide-y divide-border/70">
          {acoes.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="text-sm text-foreground">{textoAcao(a)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {a.feito_por_nome ?? "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
