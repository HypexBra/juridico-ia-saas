import { Reveal } from "./reveal";
import { Section } from "./section";

/* 10 · WHATSAPP (spec v3 §6): a conversa realista prova que a atualização
   chega ao cliente onde ele já está — sem inventar automação: a resposta
   é curta, factual e termina apontando para o portal. A nota honesta embaixo
   deixa o limite explícito (nada sai sem aprovação do advogado).
   Server Component puro; bolhas rounded-lg = exceção funcional de UI de
   mensagens prevista nas regras gerais. */

export function WhatsappSection() {
  return (
    <Section
      numero="10"
      kicker="WHATSAPP"
      titulo={
        <>
          Seu escritório <em className="italic">não para</em> quando você fecha
          o computador.
        </>
      }
    >
      <div className="mx-auto max-w-md">
        <div className="flex flex-col space-y-3">
          {/* Mensagem recebida — pergunta do cliente */}
          <Reveal>
            <div className="max-w-[85%] self-start">
              <p className="mb-1.5 font-mono-ed text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Cliente
              </p>
              <div className="rounded-lg border border-ink/10 bg-paper-3 px-4 py-3">
                <p className="font-sans-ed text-sm leading-relaxed text-ink">
                  Tem alguma novidade?
                </p>
                <p className="mt-1.5 text-right font-mono-ed text-[10px] text-ink-3">
                  18:42
                </p>
              </div>
            </div>
          </Reveal>

          {/* Resposta do escritório — fato + próximo passo + portal */}
          <Reveal delayMs={140}>
            <div className="ml-auto max-w-[85%] self-end">
              <p className="mb-1.5 text-right font-mono-ed text-[10px] uppercase tracking-[0.18em] text-ink-3">
                Escritório
              </p>
              <div className="ml-auto rounded-lg bg-ink px-4 py-3 text-paper">
                <p className="font-sans-ed text-sm leading-relaxed">
                  Sim. Houve um despacho hoje no seu processo — mero expediente,
                  sem audiência nova. Seu próximo passo continua sendo a
                  audiência do dia 14/09. Já está no portal.
                </p>
                <p className="mt-1.5 text-right font-mono-ed text-[10px] text-paper/50">
                  18:42
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Limite honesto: nada é disparado sem o advogado aprovar */}
        <Reveal delayMs={280}>
          <p className="mt-8 text-center font-mono-ed text-[11px] tracking-wide text-ink-3">
            Atualizações importantes só saem com aprovação do advogado.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
