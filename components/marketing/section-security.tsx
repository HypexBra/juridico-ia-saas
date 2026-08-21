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
    <section id="seguranca" className="relative overflow-hidden border-t border-silver/10 bg-[#080d17] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              15 · Segurança & Privacidade
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Seus casos não são conteúdo <br />
              <span className="font-normal italic text-silver-2">
                para treinar um produto.
              </span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Privacidade não é uma configuração opcional; é a premissa de qualquer software jurídico sério.
            </p>
          </Reveal>
        </div>

        {/* Security Matrix */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECURITY_ITEMS.map((item, idx) => (
            <div
              key={item.title}
              className="rounded-md border border-silver/15 bg-[#0c1424] p-6 sm:p-8 hover:border-silver/30 transition-colors"
            >
              <div className="flex items-center justify-between border-b border-silver/10 pb-3">
                <span className="font-mono text-xs text-silver">
                  GARANTIA 0{idx + 1}
                </span>
                <IconShield className="h-4 w-4 text-emerald-400" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-ice">{item.title}</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
