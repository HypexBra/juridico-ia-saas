import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Jurídico IA",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-silver">IA</span>
        </Link>

        <div className="rounded-2xl border border-ink/10 bg-paper p-8 shadow-[0_8px_32px_rgba(20,20,18,0.08)]">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Bem-vindo de volta</h1>
          <p className="mb-6 text-sm text-muted">Entre para acessar o painel do seu escritório.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
