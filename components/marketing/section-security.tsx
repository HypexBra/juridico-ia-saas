"use client";

import { Reveal } from "./reveal";
import { IconCheck, IconLockSecure, IconShield } from "./icons";

const SECURITY_ITEMS = [
  {
    title: "Isolamento Estrito Multi-Tenant",
    desc: "A base de dados e os documentos do seu escritório operam em ambiente segregado. Nenhum outro usuário ou escritório tem acesso às suas informações.",
  },
  {
    title: "Zero Treinamento com Seus Dados",
    desc: "Petições, contratos, nomes de partes e minutas nunca são utilizados para treinar ou aprimorar modelos de inteligência artificial de terceiros.",
  },
  {
    title: "Criptografia de Ponta a Ponta",
    desc: "Todos os dados são criptografados em trânsito (TLS 1.3) e em repouso (AES-256) em datacenters certificados com redundância geográfica.",
  },
  {
    title: "Conformidade LGPD e Sigilo OAB",
    desc: "Arquitetura projetada em conformidade integral com a Lei Geral de Proteção de Dados e as diretrizes de sigilo profissional da advocacia.",
  },
];

export function SectionSecurity() {
  return (
    <section id="seguranca" className="relative overflow-hidden border-t border-white/[0.08] bg-[#09090b] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              15 · Segurança & Privacidade
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Seus casos não são conteúdo <br />
              <span className="font-normal italic text-[#d4af37]">
                para treinar um produto.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Privacidade não é uma configuração opcional; é a premissa fundamental de qualquer software jurídico sério.
            </p>
          </Reveal>
        </div>

        {/* Security Matrix */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECURITY_ITEMS.map((item, idx) => (
            <div
              key={item.title}
              className="rounded-xl border border-white/[0.08] bg-[#121216] p-6 sm:p-8 hover:border-[#d4af37]/40 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-mono text-xs text-[#d4af37] font-semibold">
                  GARANTIA DE SIGILO 0{idx + 1}
                </span>
                <IconShield className="h-4 w-4 text-[#10b981]" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-[#fafaf9]">{item.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#a1a1aa]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
