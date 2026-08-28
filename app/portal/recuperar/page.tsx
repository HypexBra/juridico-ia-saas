import type { Metadata } from "next";
import Link from "next/link";
import { RecuperarSenhaPortalForm } from "./recuperar-form";

export const metadata: Metadata = {
  title: "Recuperar senha — Portal do Cliente",
};

export default function RecuperarSenhaPortalPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-silver">IA</span>
        </Link>

        <div className="rounded-2xl border border-ink/10 bg-paper-2 p-8 shadow-sm">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Recuperar senha</h1>
          <p className="mb-6 text-sm text-muted">
            Informe o e-mail da sua conta e enviaremos um link para você escolher uma nova senha.
          </p>
          <RecuperarSenhaPortalForm />
        </div>
      </div>
    </main>
  );
}
