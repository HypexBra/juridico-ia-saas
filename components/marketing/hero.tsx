import Link from "next/link";
import { HeroCase } from "./hero-case";
import { IconArrowRight } from "./icons";
import { Reveal } from "./reveal";

/* Hero editorial assimétrico (spec v3 §6): texto dominante à esquerda
   (~55%), o caso sendo construído à direita (~45%). Copy oficial literal.
   Server Component — os únicos ilhotes client são <Reveal> e <HeroCase>. */

export function Hero() {
  return (
    <section className="pb-20 pt-28 md:pb-28 md:pt-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 md:px-10 lg:grid-cols-[11fr_9fr] lg:gap-16">
        {/* Coluna de texto — hierarquia editorial, nada centralizado */}
        <div>
          <Reveal delayMs={0}>
            <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">
              PARA ESCRITÓRIOS DE ADVOCACIA
            </p>
            <h1 className="mt-5 max-w-xl font-serif-ed text-[clamp(2.75rem,5.2vw,5rem)] font-medium leading-[1.04] tracking-tight text-ink">
              O trabalho jurídico, <em className="italic">finalmente organizado</em>.
            </h1>
          </Reveal>

          <Reveal delayMs={80}>
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-2">
              Documentos analisados, prazos encontrados nos diários oficiais,
              tarefas criadas sozinhas e o cliente sempre informado. Você fica
              com a parte que só um advogado faz.
            </p>
          </Reveal>

          <Reveal delayMs={160}>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href="/cadastro"
                className="rounded-none bg-ink px-6 py-3 font-sans-ed text-sm font-medium text-paper transition-colors hover:bg-ink/90"
              >
                Começar gratuitamente
              </Link>
              <a
                href="#produto"
                className="group inline-flex items-center gap-2 font-sans-ed text-sm font-medium text-ink"
              >
                Ver como funciona
                <IconArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </a>
            </div>

            <p className="mt-8 font-mono-ed text-xs tracking-wide text-ink-3">
              Prazos monitorados no DJEN · Pesquisa com fonte verificável · Portal do cliente
            </p>
          </Reveal>
        </div>

        {/* Coluna visual — "CASO 0241" sendo construído */}
        <Reveal delayMs={160}>
          <HeroCase />
        </Reveal>
      </div>
    </section>
  );
}
