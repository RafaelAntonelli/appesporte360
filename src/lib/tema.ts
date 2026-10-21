import { useCallback, useEffect, useState } from "react";

/** Chave no aparelho onde fica a escolha do modo escuro. */
export const CHAVE_TEMA = "esporte360_tema";

/**
 * Roda no <head>, antes de a tela aparecer: aplica o modo escuro salvo
 * e evita o "piscar branco" ao abrir o app.
 */
export const SCRIPT_TEMA = `(function(){try{if(localStorage.getItem("${CHAVE_TEMA}")==="escuro"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

function aplicar(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", escuro ? "#020617" : "#0f172a");
}

/** Modo escuro ligado/desligado, salvo no aparelho. */
export function useTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  const alternar = useCallback(() => {
    setEscuro((atual) => {
      const novo = !atual;
      aplicar(novo);
      try {
        localStorage.setItem(CHAVE_TEMA, novo ? "escuro" : "claro");
      } catch {
        /* aparelho sem armazenamento: vale só nesta visita */
      }
      return novo;
    });
  }, []);

  return { escuro, alternar };
}
