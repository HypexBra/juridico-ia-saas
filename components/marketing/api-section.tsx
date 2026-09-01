import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Seção 18 · API PÚBLICA: baseada em `app/api/v1/fichas/route.ts`,
 * `app/api/v1/prazos/route.ts` e `lib/apikeys/`. Auth via `Authorization:
 * Bearer <chave>` (gerada em `/app/perfil`, ver `lib/apikeys/gerar.ts`).
 * Gated pela feature `api_integracoes` (`lib/planos/gating.ts`), selo "Pro"
 * explícito. Só existem 2 recursos hoje (fichas de caso e prazos, ambos
 * GET/paginados). Texto deixa claro que é uma API inicial, sem prometer
 * cobertura do sistema inteiro.
 */

const ENDPOINTS = [
  { metodo: "GET", caminho: "/api/v1/fichas", descricao: "Lista as fichas de caso do escritório." },
  { metodo: "GET", caminho: "/api/v1/prazos", descricao: "Lista os prazos, com filtro por concluído." },
] as const;

export function ApiSection() {
  return (
    <Section
      numero="18"
      kicker="API PÚBLICA"
      titulo={
        <>
          Seus dados, acessíveis por <em>código</em>.
        </>
      }
      intro="Autenticação simples por chave de API para integrar fichas de caso e prazos a outras ferramentas do escritório."
    >
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <div className="border border-ink/10 bg-ink text-paper">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper/15 px-5 py-3.5 md:px-6">
              <span className="rounded-full border border-paper/30 px-2.5 py-0.5 font-mono-ed text-[10px] uppercase tracking-[0.16em] text-paper">
                Pro
              </span>
              <span className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-paper/60">
                Authorization: Bearer •••••
              </span>
            </div>
            <ul className="divide-y divide-paper/10">
              {ENDPOINTS.map((endpoint) => (
                <li key={endpoint.caminho} className="px-5 py-4 md:px-6">
                  <p className="font-mono-ed text-sm">
                    <span className="text-paper/60">{endpoint.metodo}</span>{" "}
                    <span className="text-paper">{endpoint.caminho}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-paper/70">{endpoint.descricao}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delayMs={120}>
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-3">
            API inicial, com 2 recursos disponíveis hoje. Chave gerada em Meu
            perfil, com limite de requisições por minuto para proteger o
            escritório.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
