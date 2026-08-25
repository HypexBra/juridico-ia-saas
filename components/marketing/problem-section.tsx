import { Fragment } from "react";
import type { CSSProperties } from "react";

import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 01 · O PROBLEMA — nuvem tipográfica caótica que converge para ordem
 * durante o scroll (docs/redesign-landing-v3.md §6).
 *
 * Técnica: CSS scroll-driven puro (@keyframes + animation-timeline: view()),
 * sem JavaScript — o arquivo permanece um Server Component. Cada palavra tem
 * posição, rotação e vetor de convergência FIXADOS EM CÓDIGO (zero aleato-
 * riedade em runtime ⇒ SSR estável e hidratação idêntica). Browsers sem
 * suporte a scroll-driven animations (@supports falha) e usuários com
 * `prefers-reduced-motion` recebem a composição estática completa: nuvem +
 * lista ordenada + frase de transição — nada depende de animação para ser
 * legível.
 */

interface PalavraNuvem {
  /** Verbatim da spec §6. */
  texto: string;
  /** Família tipográfica: serif editorial em itálico ou mono reta. */
  fonte: "serif" | "mono";
  /** Escala variada (text-xl … text-4xl, conforme spec). */
  tamanho: string;
  /** Opacidade menor em algumas palavras (caos bonito, não bagunça). */
  opacidade?: string;
  /** Posição absoluta dentro do palco da nuvem (%). */
  left: string;
  top: string;
  /** Rotação leve (±1.5deg máximo, conforme spec). */
  rot: string;
  /** Vetor de convergência: deslocamento rumo à linha de ordem abaixo. */
  dx: string;
  dy: string;
}

const PALAVRAS: readonly PalavraNuvem[] = [
  { texto: "Pesquisar",   fonte: "serif", tamanho: "text-2xl md:text-4xl",             left: "4%",  top: "6%",  rot: "-1.2deg", dx: "300px",  dy: "420px" },
  { texto: "Organizar",   fonte: "mono",  tamanho: "text-xl md:text-2xl", opacidade: "opacity-75", left: "42%", top: "0%",  rot: "1deg",    dx: "90px",   dy: "450px" },
  { texto: "Ler",         fonte: "serif", tamanho: "text-xl",                          left: "78%", top: "12%", rot: "-0.8deg", dx: "-260px", dy: "400px" },
  { texto: "Comparar",    fonte: "mono",  tamanho: "text-lg md:text-xl",  opacidade: "opacity-55", left: "14%", top: "33%", rot: "1.4deg",  dx: "240px",  dy: "320px" },
  { texto: "Escrever",    fonte: "serif", tamanho: "text-3xl md:text-4xl",             left: "48%", top: "27%", rot: "-1deg",   dx: "10px",   dy: "340px" },
  { texto: "Revisar",     fonte: "mono",  tamanho: "text-2xl",            opacidade: "opacity-70", left: "82%", top: "38%", rot: "0.9deg",  dx: "-300px", dy: "290px" },
  { texto: "Acompanhar",  fonte: "serif", tamanho: "text-xl md:text-2xl", opacidade: "opacity-80", left: "2%",  top: "61%", rot: "-0.7deg", dx: "330px",  dy: "170px" },
  { texto: "Cobrar",      fonte: "mono",  tamanho: "text-xl",                          left: "34%", top: "57%", rot: "1.2deg",  dx: "130px",  dy: "200px" },
  { texto: "Responder",   fonte: "serif", tamanho: "text-2xl md:text-3xl", opacidade: "opacity-85", left: "63%", top: "67%", rot: "-1.4deg", dx: "-120px", dy: "150px" },
  { texto: "Atualizar",   fonte: "mono",  tamanho: "text-lg md:text-xl",  opacidade: "opacity-60", left: "22%", top: "83%", rot: "0.8deg",  dx: "210px",  dy: "70px" },
] as const;

/** Lista final — a mesma dez palavras, agora em ordem (estado "resolvido"). */
const PALAVRAS_ORDENADAS: readonly string[] =
  PALAVRAS.map((palavra) => palavra.texto);

type EstiloComVars = CSSProperties & Record<`--${string}`, string>;

function estiloPalavra(palavra: PalavraNuvem): EstiloComVars {
  return {
    left: palavra.left,
    top: palavra.top,
    "--rot": palavra.rot,
    "--dx": palavra.dx,
    "--dy": palavra.dy,
  };
}

function classesPalavra(palavra: PalavraNuvem): string {
  const familia =
    palavra.fonte === "serif"
      ? "font-serif-ed italic"
      : "font-mono-ed not-italic";
  return [
    "nuvem-palavra",
    "absolute select-none whitespace-nowrap leading-none text-ink-3",
    "pointer-events-none",
    familia,
    palavra.tamanho,
    palavra.opacidade ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Regras da convergência. Ordem importa: o shorthand `animation` reseta
 * `animation-timeline`, portanto a timeline é declarada DEPOIS dele. O bloco
 * inteiro vive atrás de dois gates — reduced-motion e @supports — de modo que
 * o estado padrão (sem suporte/movimento reduzido) é a composição estática.
 */
const CSS_NUVEM = `
.nuvem-palavra {
  transform: rotate(var(--rot, 0deg));
}
@keyframes nuvem-convergencia {
  to {
    opacity: 0;
    transform: translate(var(--dx, 0px), var(--dy, 0px)) rotate(0deg);
  }
}
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .nuvem-palavra {
      animation: nuvem-convergencia linear both;
      animation-timeline: view();
      animation-range: entry 20% cover 45%;
    }
    .nuvem-palavra:nth-child(even) {
      animation-range: entry 35% cover 55%;
    }
  }
}
`;

export function ProblemSection() {
  return (
    <Section
      numero="01"
      kicker="O PROBLEMA"
      titulo={
        <>
          O problema não é o Direito. É{" "}
          <em>tudo o que acontece ao redor dele.</em>
        </>
      }
    >
      {/* Nuvem caótica — ornamento puro: a informação acessível está na lista
          ordenada logo abaixo, então aqui vale aria-hidden. */}
      <div
        aria-hidden
        className="relative mx-auto h-[360px] w-full max-w-4xl sm:h-[430px] md:h-[500px]"
      >
        <style>{CSS_NUVEM}</style>
        {PALAVRAS.map((palavra) => (
          <span
            key={palavra.texto}
            className={classesPalavra(palavra)}
            style={estiloPalavra(palavra)}
          >
            {palavra.texto}
          </span>
        ))}
      </div>

      {/* Transição: as mesmas dez palavras, agora alinhadas — a ordem que o
          sistema devolve ao trabalho jurídico. Strip tipográfico semântico
          (um único <p>): separadores são ornamento (aria-hidden). */}
      <Reveal delayMs={80} className="mt-4 md:mt-6">
        <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-2">
          {PALAVRAS_ORDENADAS.map((texto, indice) => (
            <Fragment key={texto}>
              {indice > 0 ? (
                <span aria-hidden className="text-sm text-ink-3">
                  ·
                </span>
              ) : null}
              <span className="font-sans-ed text-sm text-ink md:text-base">
                {texto}
              </span>
            </Fragment>
          ))}
        </p>
      </Reveal>

      <Reveal delayMs={220}>
        <p className="mt-10 text-center font-serif-ed text-3xl italic leading-snug tracking-tight text-ink md:mt-14 md:text-4xl">
          É aí que o Jurídico IA entra.
        </p>
      </Reveal>
    </Section>
  );
}
