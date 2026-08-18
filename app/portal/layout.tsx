import Link from "next/link";
import { getClientePortalAtual } from "@/lib/app/current-client-portal";
import { portalLogoutAction } from "@/app/portal/actions";

export const metadata = {
  title: "Portal do Cliente — Jurídico IA",
  description: "Acompanhe o andamento do seu processo sem precisar ligar.",
};

/**
 * Layout raiz do PORTAL DO CLIENTE — deliberadamente separado de
 * `app/app/layout.tsx` (sidebar de advogado, `AppShell`): esta área é para
 * o cliente final do escritório, não para a equipe, e por isso não impõe
 * autenticação aqui (login/ativação vivem no mesmo segmento `/portal` e
 * precisam renderizar sem sessão). Cada página protegida
 * (`app/portal/page.tsx`) faz o próprio redirect com
 * `getClientePortalAtual()`.
 */
export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const clientePortalAtual = await getClientePortalAtual();

  return (
    <div className="min-h-screen bg-navy">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={clientePortalAtual ? "/portal" : "/portal/login"}
            className="flex items-center gap-2 font-display text-lg font-bold text-ice"
          >
            Jurídico<span className="text-gold">IA</span>
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted sm:inline">
              Portal do Cliente
            </span>
          </Link>

          {clientePortalAtual && (
            <form action={portalLogoutAction}>
              <button
                type="submit"
                className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ice"
              >
                Sair
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
