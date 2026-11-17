import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Quantos itens da lista mostrar agora. Começa em `passo` e volta ao início
 * sempre que `chave` muda (busca ou filtros diferentes).
 */
export function useLimiteLista(passo: number, chave: string) {
  const [limite, setLimite] = useState(passo);
  useEffect(() => setLimite(passo), [passo, chave]);
  return { limite, mostrarMais: () => setLimite((l) => l + passo) };
}

/** Fim da lista: carrega mais sozinho ao aparecer na tela e mantém o botão "Mostrar mais (X restantes)". */
export function MostrarMais({ restantes, onMais }: { restantes: number; onMais: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMaisRef = useRef(onMais);
  onMaisRef.current = onMais;
  useEffect(() => {
    const el = ref.current;
    if (!el || restantes <= 0 || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) onMaisRef.current();
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [restantes]);
  if (restantes <= 0) return null;
  return (
    <div ref={ref} className="flex justify-center px-3 py-4">
      <Button variant="outline" onClick={onMais}>Mostrar mais ({restantes} restantes)</Button>
    </div>
  );
}
