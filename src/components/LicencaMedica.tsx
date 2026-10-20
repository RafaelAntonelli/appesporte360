import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { otimizarImagem } from "@/lib/imagem";
import { dataISO, formatarDataCurta, licencaTerminada, somarDias, type LicencaMedica } from "@/lib/licenca";

async function enviarArquivo(alunoId: string, prefixo: string, bruto: File) {
  const arquivo = await otimizarImagem(bruto);
  const ext = arquivo.name.split(".").pop() ?? "jpg";
  const path = `${alunoId}/licenca-${prefixo}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("fotos-alunos").upload(path, arquivo, { upsert: true });
  if (error) throw error;
  return path;
}

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

export function LicencaMedicaSecao({ alunoId }: { alunoId: string }) {
  const { user } = useAuth();
  const hoje = dataISO();
  const [licencas, setLicencas] = useState<LicencaMedica[]>([]);
  const [modo, setModo] = useState<"nenhum" | "registrar" | "renovar" | "concluir">("nenhum");
  const [inicio, setInicio] = useState(hoje);
  const [retorno, setRetorno] = useState("");
  const [dias, setDias] = useState("");
  const [motivo, setMotivo] = useState("");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [exigirLiberacao, setExigirLiberacao] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from("licencas_medicas")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("data_inicio", { ascending: false });
    setLicencas((data ?? []) as LicencaMedica[]);
  }
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  const ativa = licencas.find((l) => l.status === "ativa");
  const [miniatura, setMiniatura] = useState<string | null>(null);
  useEffect(() => {
    setMiniatura(null);
    const path = ativa?.anexo_path;
    if (!path || /\.pdf$/i.test(path)) return;
    void supabase.storage.from("fotos-alunos").createSignedUrl(path, 3600).then(({ data }) => setMiniatura(data?.signedUrl ?? null));
  }, [ativa?.anexo_path]);

  function limpar() {
    setModo("nenhum");
    setInicio(hoje);
    setRetorno("");
    setDias("");
    setMotivo("");
    setAnexo(null);
    setExigirLiberacao(false);
  }

  function retornoCalculado(_base: string) {
    return retorno;
  }

  async function registrar() {
    const fim = retornoCalculado(inicio);
    if (!inicio || !fim) return toast.error("Informe a data de início e a data prevista de retorno (ou o período em dias).");
    if (fim < inicio) return toast.error("O retorno não pode ser antes do início.");
    if (!motivo.trim()) return toast.error("Informe o motivo / diagnóstico resumido.");
    setSalvando(true);
    try {
      const anexo_path = anexo ? await enviarArquivo(alunoId, "atestado", anexo) : null;
      const { error } = await supabase.from("licencas_medicas").insert({
        aluno_id: alunoId,
        data_inicio: inicio,
        data_retorno: fim,
        motivo: motivo.trim(),
        anexo_path,
        registrado_por: user?.id ?? null,
      });
      if (error) throw error;
      toast.success(`Licença registrada até ${formatarDataCurta(fim)}.`);
      limpar();
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
    return;
  }

  async function renovar() {
    if (!ativa) return;
    const fim = retornoCalculado(ativa.data_retorno);
    if (!fim || fim <= ativa.data_retorno) return toast.error("Informe uma nova data de retorno posterior à atual.");
    setSalvando(true);
    try {
      const patch: { data_retorno: string; anexo_path?: string } = { data_retorno: fim };
      if (anexo) patch.anexo_path = await enviarArquivo(alunoId, "renovacao", anexo);
      const { error } = await supabase.from("licencas_medicas").update(patch).eq("id", ativa.id);
      if (error) throw error;
      toast.success(`Licença renovada até ${formatarDataCurta(fim)}.`);
      limpar();
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
    return;
  }

  async function concluir() {
    if (!ativa) return;
    if (exigirLiberacao && !anexo) return toast.error("Anexe o atestado de liberação física para concluir.");
    setSalvando(true);
    try {
      const liberacao_path = anexo ? await enviarArquivo(alunoId, "liberacao", anexo) : null;
      const { error } = await supabase
        .from("licencas_medicas")
        .update({ status: "concluida", concluida_em: new Date().toISOString(), concluida_por: user?.id ?? null, liberacao_path })
        .eq("id", ativa.id);
      if (error) throw error;
      toast.success("Licença concluída. Aluno retornou às aulas.");
      limpar();
      await carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
    return;
  }

  async function abrirArquivo(path: string) {
    const { data, error } = await supabase.storage.from("fotos-alunos").createSignedUrl(path, 3600);
    if (error || !data) return toast.error(error?.message ?? "Falha ao abrir arquivo");
    window.open(data.signedUrl, "_blank", "noopener");
    return;
  }

  const camposData = (base: string) => (
    <>
      <div className="space-y-1">
        <Label>Período em dias (opcional)</Label>
        <Input
          type="number"
          min={1}
          value={dias}
          onChange={(e) => {
            setDias(e.target.value);
            const n = Number(e.target.value);
            if (n > 0) setRetorno(somarDias(base, n));
          }}
        />
      </div>
      <div className="space-y-1">
        <Label>{modo === "renovar" ? "Nova data prevista de retorno" : "Data prevista de retorno"}</Label>
        <Input type="date" value={retorno} min={base} onChange={(e) => { setRetorno(e.target.value); setDias(""); }} />
      </div>
    </>
  );

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3 text-sm">
      <p className="font-medium">Licença médica</p>

      {ativa ? (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            {licencaTerminada(ativa, hoje)
              ? `Licença terminou em ${formatarDataCurta(ativa.data_retorno)} — confirmar retorno ou renovar`
              : `Em licença até ${formatarDataCurta(ativa.data_retorno)}`}
          </p>
          <p className="text-muted-foreground">
            {fmt(ativa.data_inicio)} a {fmt(ativa.data_retorno)} · {ativa.motivo ?? "Sem motivo"}
          </p>
          {ativa.anexo_path ? (
            <button
              type="button"
              title="Abrir atestado / laudo"
              onClick={() => void abrirArquivo(ativa.anexo_path!)}
              className="block overflow-hidden rounded-md border border-border/70 bg-card"
            >
              {miniatura ? (
                <img src={miniatura} alt="Atestado da licença" className="h-24 w-24 object-cover" />
              ) : (
                <span className="grid h-24 w-24 place-items-center text-xs text-muted-foreground">PDF</span>
              )}
            </button>
          ) : null}
          {modo === "nenhum" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setModo("concluir")}>Confirmar retorno</Button>
              <Button size="sm" variant="outline" onClick={() => setModo("renovar")}>Prorrogar licença</Button>
            </div>
          ) : null}
        </div>
      ) : modo === "nenhum" ? (
        <Button size="sm" variant="outline" onClick={() => setModo("registrar")}>Registrar Licença Médica</Button>
      ) : null}

      {modo === "registrar" ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label>Data de início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          {camposData(inicio)}
          <div className="space-y-1">
            <Label>Motivo / Diagnóstico resumido</Label>
            <Input placeholder="Ex.: cirurgia no ombro, fratura..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Anexo do atestado / laudo médico</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      ) : null}

      {modo === "renovar" && ativa ? (
        <div className="space-y-2">
          {camposData(ativa.data_retorno)}
          <div className="space-y-1">
            <Label>Novo atestado (opcional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      ) : null}

      {modo === "concluir" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch id="exigir-liberacao" checked={exigirLiberacao} onCheckedChange={setExigirLiberacao} />
            <Label htmlFor="exigir-liberacao">Exigir atestado de liberação física</Label>
          </div>
          <div className="space-y-1">
            <Label>Atestado de liberação {exigirLiberacao ? "(obrigatório)" : "(opcional)"}</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      ) : null}

      {modo !== "nenhum" ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={salvando}
            onClick={() => void (modo === "registrar" ? registrar() : modo === "renovar" ? renovar() : concluir())}
          >
            {salvando ? "Salvando..." : "Confirmar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={limpar}>Cancelar</Button>
        </div>
      ) : null}

      {licencas.some((l) => l.status === "concluida") ? (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-medium text-muted-foreground">Licenças anteriores</p>
          {licencas
            .filter((l) => l.status === "concluida")
            .map((l) => (
              <p key={l.id} className="text-xs text-muted-foreground">
                {fmt(l.data_inicio)} a {fmt(l.data_retorno)} · {l.motivo ?? "-"}
                {l.concluida_em ? ` · retornou em ${new Date(l.concluida_em).toLocaleDateString("pt-BR")}` : ""}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
