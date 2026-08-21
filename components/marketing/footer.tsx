import Link from "next/link";
import { IconLogoMark } from "./icons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.08] bg-[#060608] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 lg:gap-14">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 text-base font-bold text-[#fafaf9]">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37]">
                <IconLogoMark className="h-3.5 w-3.5" />
              </span>
              <span className="font-display">
                Jurídico <span className="font-mono text-xs text-[#d4af37] uppercase font-semibold">OS</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-[#a1a1aa]">
              O sistema operacional inteligente para escritórios de advocacia que valorizam precisão, tempo e autoridade.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#10b981]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              <span>Sistemas 100% Operacionais</span>
            </div>
          </div>

          {/* Links: Produto */}
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#d4af37]">
              Produto
            </p>
            <ul className="mt-4 space-y-2.5 text-xs text-[#a1a1aa]">
              <li>
                <a href="#dossie" className="transition-colors hover:text-[#fafaf9]">
                  Dossiê do Caso
                </a>
              </li>
              <li>
                <a href="#redline" className="transition-colors hover:text-[#fafaf9]">
                  Auditoria & Redline
                </a>
              </li>
              <li>
                <a href="#war-room" className="transition-colors hover:text-[#fafaf9]">
                  Advogado do Contra
                </a>
              </li>
              <li>
                <a href="#radar-djen" className="transition-colors hover:text-[#fafaf9]">
                  Radar DJEN & Prazos
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Segurança & Legal */}
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#d4af37]">
              Segurança
            </p>
            <ul className="mt-4 space-y-2.5 text-xs text-[#a1a1aa]">
              <li>
                <a href="#seguranca" className="transition-colors hover:text-[#fafaf9]">
                  Isolamento Multi-Tenant
                </a>
              </li>
              <li>
                <a href="#seguranca" className="transition-colors hover:text-[#fafaf9]">
                  Conformidade LGPD
                </a>
              </li>
              <li>
                <a href="#seguranca" className="transition-colors hover:text-[#fafaf9]">
                  Sigilo Profissional OAB
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-[#fafaf9]">
                  Garantia Anti-Alucinação
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Acesso */}
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#d4af37]">
              Acesso
            </p>
            <ul className="mt-4 space-y-2.5 text-xs text-[#a1a1aa]">
              <li>
                <Link href="/login" className="transition-colors hover:text-[#fafaf9]">
                  Entrar no Sistema
                </Link>
              </li>
              <li>
                <Link href="/cadastro" className="transition-colors hover:text-[#fafaf9]">
                  Criar Conta Gratuita
                </Link>
              </li>
              <li>
                <Link href="/portal" className="transition-colors hover:text-[#fafaf9]">
                  Portal do Cliente
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-6 text-xs text-[#71717a] sm:flex-row">
          <p>© {year} Jurídico IA Tecnologia Ltda. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Termos de Uso</span>
            <span>·</span>
            <span>Política de Privacidade</span>
            <span>·</span>
            <span>Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
