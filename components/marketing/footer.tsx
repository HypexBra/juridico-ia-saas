import Link from "next/link";
import { IconLockSecure, IconLogoMark } from "./icons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-silver/10 bg-[#060b14] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 lg:gap-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 font-display text-base font-bold text-ice">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-silver/30 bg-silver/10 text-silver">
                <IconLogoMark className="h-3.5 w-3.5" />
              </span>
              <span>
                Jurídico <span className="font-mono text-xs text-silver uppercase font-semibold">IA</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-muted">
              O sistema operacional inteligente para escritórios de advocacia que valorizam precisão, tempo e autoridade.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400/90">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Sistemas 100% Operacionais</span>
            </div>
          </div>

          {/* Links: Produto */}
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-silver">
              Produto
            </p>
            <ul className="mt-4 space-y-2.5 text-xs text-muted">
              <li>
                <a href="#caso-sistema" className="transition-colors hover:text-ice">
                  Dossiê do Caso
                </a>
              </li>
              <li>
                <a href="#documentos" className="transition-colors hover:text-ice">
                  Auditoria de Documentos
                </a>
              </li>
              <li>
                <a href="#automacao" className="transition-colors hover:text-ice">
                  Automação & DJEN
                </a>
              </li>
              <li>
                <a href="#precos" className="transition-colors hover:text-ice">
                  Planos & Valores
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Segurança & Legal */}
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-silver">
              Segurança
            </p>
            <ul className="mt-4 space-y-2.5 text-xs text-muted">
              <li>
                <a href="#seguranca" className="transition-colors hover:text-ice">
                  Isolamento Multi-Tenant
                </a>
              </li>
              <li>
                <a href="#seguranca" className="transition-colors hover:text-ice">
                  Conformidade LGPD
                </a>
              </li>
              <li>
                <a href="#seguranca" className="transition-colors hover:text-ice">
                  Sigilo Profissional OAB
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-ice">
                  Garantia Anti-Alucinação
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Acesso */}
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-silver">
              Acesso
            </p>
            <ul className="mt-4 space-y-2.5 text-xs text-muted">
              <li>
                <Link href="/login" className="transition-colors hover:text-ice">
                  Entrar no Sistema
                </Link>
              </li>
              <li>
                <Link href="/cadastro" className="transition-colors hover:text-ice">
                  Criar Conta Gratuita
                </Link>
              </li>
              <li>
                <Link href="/portal" className="transition-colors hover:text-ice">
                  Portal do Cliente
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-silver/10 pt-6 text-xs text-muted/80 sm:flex-row">
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
