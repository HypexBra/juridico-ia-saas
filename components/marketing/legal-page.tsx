import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Nav } from "./nav";

/**
 * Layout compartilhado das três páginas legais estáticas (Termos, Privacidade,
 * Exclusão de dados). Reaproveita Nav/Footer e a paleta papel-e-tinta da
 * landing para que as páginas pareçam nativas do site, não coladas depois.
 *
 * Estas páginas são um RASCUNHO de transparência inicial (produto
 * early-stage, sem CNPJ/razão social ainda) — o <AvisoRascunho> abaixo é
 * obrigatório em todas elas e não deve ser removido antes de revisão
 * jurídica formal (ver PENDENCIAS.md).
 */
interface LegalPageShellProps {
  kicker: string;
  titulo: string;
  atualizadoEm: string;
  children: ReactNode;
}

export function AvisoRascunho() {
  return (
    <div
      role="alert"
      className="mb-12 border-l-2 border-accent bg-paper-2 px-5 py-4 md:px-6 md:py-5"
    >
      <p className="font-mono-ed text-[11px] uppercase tracking-[0.18em] text-accent">
        Aviso · Documento em elaboração
      </p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
        Este é um rascunho gerado para fins de transparência inicial e reflete
        as práticas atuais do produto de boa-fé. Ele{" "}
        <strong className="font-medium text-ink">
          requer revisão de advogado especializado em LGPD
        </strong>{" "}
        antes de uso definitivo em produção com clientes pagantes.
      </p>
    </div>
  );
}

export function LegalPageShell({ kicker, titulo, atualizadoEm, children }: LegalPageShellProps) {
  return (
    <div className="marketing-root flex min-h-full flex-1 flex-col bg-paper font-sans-ed text-ink">
      <Nav />
      <main id="conteudo" className="flex-1 py-32 md:py-40">
        <div className="mx-auto max-w-3xl px-5 md:px-10">
          <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">{kicker}</p>
          <h1 className="mt-4 font-serif-ed text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl">
            {titulo}
          </h1>
          <p className="mt-3 font-mono-ed text-[11px] uppercase tracking-[0.16em] text-ink-3">
            Última atualização: {atualizadoEm}
          </p>

          <div className="mt-12">
            <AvisoRascunho />
          </div>

          <div className="legal-conteudo max-w-prose text-base leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:font-serif-ed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-relaxed [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
