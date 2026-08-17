import type { Metadata } from "next";
import Link from "next/link";
import { CadastroForm } from "./cadastro-form";

export const metadata: Metadata = {
  title: "Criar conta — Jurídico IA",
};

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-gold">IA</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-navy-2/60 p-8 shadow-2xl shadow-black/30">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Comece grátis</h1>
          <p className="mb-6 text-sm text-muted">
            Crie o escritório e comece a usar o copiloto jurídico com IA em minutos.
          </p>
          <CadastroForm />
        </div>
      </div>
    </main>
  );
}
