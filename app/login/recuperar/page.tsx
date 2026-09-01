import type { Metadata } from "next";
import Link from "next/link";
import { RecuperarSenhaForm } from "./recuperar-form";

export const metadata: Metadata = {
  title: "Recuperar senha — Jurídico IA",
  description:
    "Informe o e-mail da sua conta no Jurídico IA e receba um link para definir uma nova senha.",
};

export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-silver">IA</span>
        </Link>

        <div className="rounded-2xl border border-ink/10 bg-paper p-8 shadow-[0_8px_32px_rgba(20,20,18,0.08)]">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Recuperar senha</h1>
          <p className="mb-6 text-sm text-muted">
            Informe o e-mail da sua conta e enviaremos um link para você escolher uma nova senha.
          </p>
          <RecuperarSenhaForm />
        </div>
      </div>
    </main>
  );
}
