import { Reveal } from "./reveal";
import { Section } from "./section";
import { IconCheck } from "./icons";

/**
 * Seção 17 · ASSINATURA ELETRÔNICA: baseada em `lib/assinatura/autentique.ts`
 * e `lib/assinatura/tipos.ts`. Provedor real é o Autentique (GraphQL, upload
 * multipart, webhook com verificação HMAC-SHA256 via `x-autentique-signature`).
 * Nunca citar Clicksign/DocuSign, que não são o que está integrado. Sem
 * chave em `FEATURES_PREMIUM` (`lib/planos/gating.ts`): não é gated por
 * plano, só depende de `AUTENTIQUE_API_TOKEN` estar configurada (a própria
 * `autentiqueEstaConfigurado()` documenta isso). Por isso nenhum selo "Pro"
 * nesta seção.
 */

const ETAPAS = [
  "Documento gerado no sistema (.docx/.pdf)",
  "Enviado ao Autentique com os signatários",
  "Link de assinatura por e-mail para cada parte",
  "Status atualizado por webhook, sem consulta manual",
] as const;

export function SignatureSection() {
  return (
    <Section
      numero="17"
      kicker="ASSINATURA ELETRÔNICA"
      titulo={
        <>
          Do documento pronto ao <em>assinado</em>, sem sair do sistema.
        </>
      }
      intro="Envio direto para assinatura eletrônica via Autentique. O status de cada signatário chega por webhook, sem precisar checar o e-mail manualmente."
    >
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <article className="border border-ink/10 bg-paper">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 px-5 py-3.5 md:px-6">
              <h3 className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                Contrato de honorário · Enviado ao Autentique
              </h3>
              <span className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-accent">
                Aguardando assinatura
              </span>
            </header>
            <ul className="divide-y divide-ink/10">
              {ETAPAS.map((etapa, indice) => (
                <li
                  key={etapa}
                  className="flex items-center gap-3 px-5 py-3.5 md:px-6"
                >
                  {indice < 2 ? (
                    <IconCheck className="h-4 w-4 shrink-0 text-ink" />
                  ) : (
                    <span
                      aria-hidden
                      className="h-4 w-4 shrink-0 rounded-full border border-ink/25"
                    />
                  )}
                  <span className="font-sans-ed text-sm text-ink">{etapa}</span>
                </li>
              ))}
            </ul>
            <footer className="border-t border-ink/10 px-5 py-3.5 md:px-6">
              <p className="font-mono-ed text-[11px] leading-relaxed text-ink-3">
                Assinatura com validade jurídica pelo provedor Autentique.
              </p>
            </footer>
          </article>
        </Reveal>
      </div>
    </Section>
  );
}
