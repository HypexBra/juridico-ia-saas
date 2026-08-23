import type { Metadata } from "next";
import Link from "next/link";
import { DefinirSenhaForm } from "./definir-senha-form";

export const metadata: Metadata = {
  title: "Definir senha — Jurídico IA",
};

// Nunca estático: a página só faz sentido por trás de um link de e-mail
// único (convite/redefinição de senha) e o form client-side depende da
// sessão do momento (`supabase.auth.getSession()`, ver definir-senha-form).
// Também evita o build tentar pré-renderizar um client component que
// instancia o client do Supabase sem as env vars `NEXT_PUBLIC_*` presentes
// no ambiente de build (só relevante localmente sem `.env.local`; em
// produção essas vars já existem, mas a página não deve ser cacheada de
// qualquer forma).
export const dynamic = "force-dynamic";

export default function DefinirSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-silver">IA</span>
        </Link>

        <div className="rounded-2xl border border-ink/10 bg-paper p-8 shadow-[0_8px_32px_rgba(20,20,18,0.08)]">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Defina sua senha</h1>
          <p className="mb-6 text-sm text-muted">
            Última etapa para acessar o escritório — escolha uma senha para sua conta.
          </p>
          <DefinirSenhaForm />
        </div>
      </div>
    </main>
  );
}
