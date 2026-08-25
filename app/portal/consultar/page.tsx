import type { Metadata } from "next";
import Link from "next/link";
import { ConsultarStatusForm } from "./consultar-form";

export const metadata: Metadata = {
  title: "Consultar status do caso — Portal do Cliente",
};

/**
 * Página PÚBLICA (sem autenticação) de consulta de status por CPF —
 * `/portal/consultar` está listada em `PUBLIC_PATHS`
 * (`lib/supabase/middleware.ts`), diferente do resto de `/portal`, que exige
 * sessão de cliente do portal.
 *
 * Existe para quem ainda não recebeu/ativou o convite do portal
 * (`/portal/ativar`) mas quer confirmar que o caso já está em andamento.
 * Usa a function `consultar_status_publico_por_cpf` (security definer,
 * migration 0008), que devolve só nome/área do direito/status
 * básico/data — nunca telefone, e-mail, resumo dos fatos ou qualquer dado
 * financeiro.
 */
export default async function ConsultarStatusPage({ searchParams }: PageProps<"/portal/consultar">) {
  const params = await searchParams;
  const slugParam = params.slug;
  const slugInicial = typeof slugParam === "string" ? slugParam : null;

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-silver">IA</span>
        </Link>

        <div className="rounded-2xl border border-ink/10 bg-paper-2 p-8 shadow-sm">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Consultar meu caso</h1>
          <p className="mb-6 text-sm text-muted">
            Confirme rapidamente se o seu caso já está com o escritório, sem precisar de senha.
          </p>
          <ConsultarStatusForm slugInicial={slugInicial} />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Já tem convite do portal?{" "}
          <Link href="/portal/login" className="text-silver underline underline-offset-4 hover:text-silver">
            Entrar no portal
          </Link>
        </p>
      </div>
    </main>
  );
}
