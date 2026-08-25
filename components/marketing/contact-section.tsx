import { Section } from "./section";
import { IconArrowRight, IconMail, IconPhone, IconWhatsapp } from "./icons";
import { Reveal } from "./reveal";

/**
 * Contatos oficiais do escritório — dados fornecidos pelo dono do produto.
 * WhatsApp pessoal (com link direto wa.me) e telefone da empresa (tel:).
 * Números exibidos EXATAMENTE como cadastrados; nenhum dígito é inventado.
 */
const CANAIS = [
  {
    icone: IconMail,
    rotulo: "E-mail",
    valor: "pedrohenriquesanchesleal4@gmail.com",
    href: "mailto:pedrohenriquesanchesleal4@gmail.com",
    nota: "Resposta em até 1 dia útil.",
    external: false,
  },
  {
    icone: IconWhatsapp,
    rotulo: "WhatsApp — direto com o fundador",
    valor: "+55 (61) 98139-9051",
    href: "https://wa.me/5561981399051?text=Ol%C3%A1%2C%20vim%20pela%20p%C3%A1gina%20do%20Jur%C3%ADdico%20IA.",
    nota: "O canal mais rápido para dúvidas sobre planos e demonstração.",
    external: true,
  },
  {
    icone: IconPhone,
    rotulo: "Telefone — empresa",
    valor: "+55 (61) 9515-3136",
    href: "tel:+556195153136",
    nota: "Atendimento comercial em horário comercial (Brasília).",
    external: true,
  },
] as const;

/**
 * Seção Contato (15): três canais oficiais, um por linha editorial. Sem
 * formulário nesta leva (formulário público exigiria anti-spam e rota de
 * envio própria); os links abrem o canal real do usuário — mailto:, wa.me
 * e tel: — que é onde a conversa de fato acontece.
 */
export function ContactSection() {
  return (
    <Section
      id="contato"
      numero="15"
      kicker="CONTATO"
      titulo={
        <>
          Fale com quem <em className="italic">responde</em>.
        </>
      }
      intro="Sem robô de atendimento e sem formulário esquecido na caixa de entrada. Os canais abaixo chegam direto ao time do Jurídico IA."
    >
      <div className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
        {CANAIS.map((canal, indice) => (
          <Reveal key={canal.rotulo} delayMs={indice * 80}>
            <a
              href={canal.href}
              {...(canal.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-5 transition-colors hover:bg-paper-2 md:gap-6 md:px-4"
            >
              <span className="flex h-11 w-11 items-center justify-center border border-ink/15 text-ink transition-colors group-hover:border-accent group-hover:text-accent">
                <canal.icone className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
                  {canal.rotulo}
                </span>
                <span className="mt-0.5 block truncate font-sans-ed text-base font-medium text-ink md:text-lg">
                  {canal.valor}
                </span>
                <span className="mt-0.5 hidden text-xs text-ink-3 sm:block">{canal.nota}</span>
              </span>
              <IconArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
            </a>
          </Reveal>
        ))}
      </div>

      <p className="mt-6 font-mono-ed text-[11px] uppercase tracking-[0.18em] text-ink-3">
        Brasília · DF · Atendimento em todo o Brasil
      </p>
    </Section>
  );
}
