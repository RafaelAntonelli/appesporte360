import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfiguracaoNumero } from "@/lib/configuracoes";
import { CHAVE_VALIDADE_LINKS, VALIDADE_LINKS_PADRAO_HORAS, validadeLinksHoras } from "@/lib/links-seguros";

const OPCOES = [1, 2, 6, 12, 24];

/** Validade dos links de fotos e documentos nas planilhas exportadas. */
export function ValidadeLinks() {
  const { valor, salvar } = useConfiguracaoNumero(CHAVE_VALIDADE_LINKS, VALIDADE_LINKS_PADRAO_HORAS);
  const atual = validadeLinksHoras(valor);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const selecionado = escolha ?? String(atual);

  async function gravar() {
    setSalvando(true);
    try {
      await salvar(validadeLinksHoras(selecionado));
      setEscolha(null);
      toast.success("Validade dos links salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <ShieldCheck className="size-4" /> Links de fotos e documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Para proteger os dados dos alunos (LGPD), os links de fotos e documentos nas planilhas exportadas são
          protegidos e param de funcionar depois do prazo escolhido. Na tela, as imagens usam links que valem 1 hora. A
          planilha do backup no Google Drive não tem links.
        </p>
        <div className="space-y-2">
          <Label>Validade dos links nas planilhas exportadas</Label>
          <Select value={selecionado} onValueChange={setEscolha}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h === 1 ? "1 hora" : `${h} horas`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" disabled={salvando || selecionado === String(atual)} onClick={() => void gravar()}>
          {salvando ? "Salvando..." : "Salvar validade"}
        </Button>
      </CardContent>
    </Card>
  );
}
