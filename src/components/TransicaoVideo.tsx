import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import aberturaSeculje from "@/assets/abertura-seculje.png.asset.json";
import aberturaEsporte360 from "@/assets/abertura-esporte-360.png.asset.json";

/** Tempo de exibição da primeira imagem (ms). */
const TEMPO_PRIMEIRA_IMAGEM = 2300;
/** Tempo de exibição da segunda imagem (ms). */
const TEMPO_SEGUNDA_IMAGEM = 2200;
/** Tempo mínimo de exibição durante uma troca de tela (ms). */
const MINIMO = 900;
/** Duração do crossfade entre as imagens (ms). */
const DURACAO_FADE = 600;
/** Espera máxima pelo pré-carregamento antes de iniciar a animação (ms). */
const PRELOAD_MAXIMO = 4000;

type StatusImagem = "carregando" | "ok" | "erro";

/**
 * Tela de carregamento com as duas imagens institucionais em sequência.
 * As imagens são pré-carregadas antes de a animação começar para evitar
 * atrasos no Android e no Windows; se alguma falhar, a outra assume a
 * tela inteira para nunca exibir fundo vazio.
 */
export function TransicaoVideo() {
  const carregando = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [visivel, setVisivel] = useState(true);
  const [mostrarSegundaImagem, setMostrarSegundaImagem] = useState(false);
  const [statusPrimeira, setStatusPrimeira] = useState<StatusImagem>("carregando");
  const [statusSegunda, setStatusSegunda] = useState<StatusImagem>("carregando");
  const abriu = useRef(false);
  const animacaoIniciada = useRef(false);

  // Pré-carrega as duas imagens antes de iniciar a animação.
  useEffect(() => {
    let ativo = true;
    const carregar = (url: string, aoConcluir: (ok: boolean) => void) => {
      const img = new Image();
      img.onload = () => aoConcluir(true);
      img.onerror = () => aoConcluir(false);
      img.src = url;
    };
    carregar(aberturaSeculje.url, (ok) => {
      if (ativo) setStatusPrimeira(ok ? "ok" : "erro");
    });
    carregar(aberturaEsporte360.url, (ok) => {
      if (ativo) setStatusSegunda(ok ? "ok" : "erro");
    });
    return () => {
      ativo = false;
    };
  }, []);

  // Só inicia a animação quando as duas terminaram de carregar (ok ou erro),
  // ou após a espera máxima — o que ocorrer primeiro.
  const prontoParaAnimar =
    (statusPrimeira !== "carregando" && statusSegunda !== "carregando") || false;

  useEffect(() => {
    if (animacaoIniciada.current) return;
    const iniciar = () => {
      if (animacaoIniciada.current) return;
      animacaoIniciada.current = true;

      // Se a primeira falhou mas a segunda existe, pula direto para a segunda.
      const pulaPrimeira =
        statusPrimeira === "erro" && statusSegunda !== "erro";
      const t1 = window.setTimeout(
        () => setMostrarSegundaImagem(true),
        pulaPrimeira ? DURACAO_FADE : TEMPO_PRIMEIRA_IMAGEM,
      );
      const t2 = window.setTimeout(
        () => {
          abriu.current = true;
          setVisivel(false);
        },
        (pulaPrimeira ? DURACAO_FADE : TEMPO_PRIMEIRA_IMAGEM) + TEMPO_SEGUNDA_IMAGEM,
      );
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    };

    if (prontoParaAnimar) return iniciar();
    const tMax = window.setTimeout(() => iniciar(), PRELOAD_MAXIMO);
    return () => window.clearTimeout(tMax);
  }, [prontoParaAnimar, statusPrimeira, statusSegunda]);

  useEffect(() => {
    if (!abriu.current) return;
    if (carregando) {
      setVisivel(true);
      setMostrarSegundaImagem(true);
      return;
    }
    const t = window.setTimeout(() => setVisivel(false), MINIMO);
    return () => window.clearTimeout(t);
  }, [carregando]);

  // Fallback: só renderiza imagem que carregou (ou ainda está carregando);
  // se uma falhar, a outra cobre a tela. Se ambas falharem, o fundo
  // institucional (bg-primary) permanece — nunca tela em branco.
  const exibirPrimeira = statusPrimeira !== "erro";
  const exibirSegunda = statusSegunda !== "erro";

  return (
    <div
      aria-hidden={!visivel}
      className={`fixed inset-0 z-[90] overflow-hidden bg-primary transition-opacity duration-500 ease-out ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {exibirSegunda ? (
        <img
          src={aberturaEsporte360.url}
          alt="Programa Esporte 360"
          fetchPriority="high"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {exibirPrimeira ? (
        <img
          src={aberturaSeculje.url}
          alt="SECULJE — Secretaria de Esporte, Saber, Juventude e Esports de Lauro de Freitas"
          fetchPriority="high"
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out ${
            mostrarSegundaImagem && exibirSegunda ? "opacity-0" : "opacity-100"
          }`}
          style={{ transitionDuration: `${DURACAO_FADE}ms` }}
        />
      ) : null}
    </div>
  );
}
