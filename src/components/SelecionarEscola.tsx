import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { escolasDaRede } from "@/lib/escolas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type Props = { rede: string; value: string; onChange: (value: string) => void };

export function SelecionarEscola({ rede, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [nome, setNome] = useState("");
  const [busca, setBusca] = useState("");
  const escolas = escolasDaRede(rede);
  const opcoes = value && !escolas.includes(value) ? [value, ...escolas] : escolas;

  function adicionar() {
    const escola = nome.trim();
    if (!escola) return;
    onChange(escola);
    setAdicionando(false);
    setBusca("");
  }

  return (
    <div className="min-w-0 space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="nome-escola" type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Nome da escola" className="h-auto min-h-9 w-full justify-between text-left font-normal">
            <span className="min-w-0 whitespace-normal break-words">{value || "Selecione a escola"}</span>
            <ChevronsUpDown className="shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Pesquisar escola..." aria-label="Pesquisar escola" value={busca} onValueChange={setBusca} />
            <CommandList className="max-h-60 overscroll-contain">
              <CommandEmpty>{rede ? "Nenhuma escola encontrada." : "Selecione a rede de ensino."}</CommandEmpty>
              <CommandGroup>
                {opcoes.map((escola) => (
                  <CommandItem key={escola} value={escola} onSelect={() => { onChange(escola); setOpen(false); setBusca(""); setAdicionando(false); }} className="items-start">
                    <span className="min-w-0 flex-1 whitespace-normal break-words">{escola}</span>
                    {value === escola && <Check className="shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {adicionando ? (
        <div className="space-y-2">
          <Input autoFocus aria-label="Nome da nova escola" placeholder="Nome da nova escola" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!nome.trim()} onClick={adicionar}><Check />Adicionar escola</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdicionando(false)}><X />Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-auto max-w-full justify-start whitespace-normal text-left" onClick={() => { setNome(busca); setOpen(false); setAdicionando(true); }}><Plus />Adicionar escola fora da lista</Button>
      )}
    </div>
  );
}