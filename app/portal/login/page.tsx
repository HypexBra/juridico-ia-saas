import type { Metadata } from "next";
import Link from "next/link";
import { PortalLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Portal do Cliente",
};

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/login">) {
  const params = await searchParams;
  const tokenParam = params.token;
  const tokenConvitePendente = typeof tokenParam === "string" ? tokenParam : null;

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-bold text-ice">
          Jurídico<span className="text-silver">IA</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-navy-2/60 p-8 shadow-2xl shadow-black/30">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ice">Portal do cliente</h1>
          <p className="mb-6 text-sm text-muted">Entre para acompanhar o andamento do seu caso.</p>
          <PortalLoginForm tokenConvitePendente={tokenConvitePendente} />
        </div>
      </div>
    </main>
  );
}
