import { Reveal } from "./reveal";
import { Section } from "./section";

/* 09 · PORTAL DO CLIENTE (spec v3 §6): a promessa "o cliente acompanha"
   mostrada como ficha limpa do portal — papel-2, hairlines ink/10, cantos
   retos, UM destaque cromático (os documentos pendentes em lacre). Sem
   interação: é a prova silenciosa de que existe um lugar onde o cliente
   vê o caso andar. Server Component puro. */

/** Linha da ficha do portal. */
interface LinhaPortal {
  readonly rotulo: string;
  readonly valor: string;
  /** Renderiza o valor como pílula de status mono (exceção rounded-full da spec §2). */
  readonly pilula?: boolean;
  /** Valor em lacre — único ponto de cor do painel. */
  readonly lacre?: boolean;
}

const LINHAS_PORTAL: readonly LinhaPortal[] = [
  { rotulo: "Status", valor: "Em andamento", pilula: true },
  { rotulo: "Próximo passo", valor: "Audiência de instrução — 14/09" },
  { rotulo: "Documentos", valor: "2 pendentes", lacre: true },
  { rotulo: "Última atualização", valor: "Hoje, 09:14" },
] as const;

export function ClientSection() {
  return (
    <Section
      numero="09"
      kicker="PORTAL DO CLIENTE"
      titulo={
        <>
          O cliente também <em className="italic">sabe</em> o que está
          acontecendo.
        </>
      }
      intro={
        <>Menos ligação pedindo atualização. O escritório publica, o cliente acompanha.</>
      }
    >
      <div className="mx-auto max-w-xl">
        <Reveal>
          {/* Ficha do caso no portal — mesma gramática do painel "CASO 0241" */}
          <div className="rounded-none border border-ink/10 bg-paper-2 p-6 md:p-8">
            <div className="border-b border-ink/10 pb-4">
              <p className="font-mono-ed text-xs tracking-[0.22em] text-ink">
                MEU CASO · INDENIZAÇÃO
              </p>
            </div>

            <dl className="divide-y divide-ink/10">
              {LINHAS_PORTAL.map((linha) => (
                <div
                  key={linha.rotulo}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <dt className="shrink-0 font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                    {linha.rotulo}
                  </dt>
                  <dd className="min-w-0 text-right">
                    {linha.pilula ? (
                      <span className="inline-block rounded-full border border-ink/20 px-3 py-1 font-mono-ed text-xs text-ink">
                        {linha.valor}
                      </span>
                    ) : (
                      <span
                        className={`font-sans-ed text-sm ${
                          linha.lacre ? "font-medium text-lacre" : "text-ink"
                        }`}
                      >
                        {linha.valor}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {/* Ações do cliente — o que ele consegue fazer sozinho, sem ligar */}
        <Reveal delayMs={120}>
          <p className="mt-5 text-center font-mono-ed text-[11px] tracking-wide text-ink-3">
            Enviar documento · Falar com o escritório · Entender uma decisão
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
