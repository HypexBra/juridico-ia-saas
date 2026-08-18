import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AtivarForm } from "./ativar-form";

export const metadata: Metadata = {
  title: "Ativar acesso — Portal do Cliente",
};

type ConviteInfo = { nome: string; email: string; valido: boolean };

function MensagemErro({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-xl font-semibold text-ice">{titulo}</h1>
        <p className="text-sm text-muted">{descricao}</p>
        <Link href="/portal/login" className="inline-block text-sm font-medium text-gold hover:text-gold-2">
          Já tem uma conta? Entrar
        </Link>
      </div>
    </main>
  );
}

export default async function PortalAtivarPage({ searchParams }: PageProps<"/portal/ativar">) {
  const params = await searchParams;
  const tokenParam = params.token;
  const token = typeof tokenParam === "string" ? tokenParam : null;

  if (!token) {
    return (
      <MensagemErro
        titulo="Link incompleto"
        descricao="Este link de ativação está incompleto. Peça ao seu advogado para reenviar o convite."
      />
    );
  }

  const supabase = await createClient();
  const { data: convite } = await supabase
    .rpc("consultar_convite_cliente_portal", { p_token: token })
    .maybeSingle<ConviteInfo>();

  if (!convite || !convite.valido) {
    return (
      <MensagemErro
        titulo="Convite inválido ou expirado"
        descricao="Este link já foi usado ou não é mais válido. Peça ao seu advogado para gerar um novo convite."
      />
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold text-ice">
            Bem-vindo(a), {convite.nome.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Crie uma senha para acompanhar o andamento do seu processo pelo portal.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-navy-2/60 p-8 shadow-2xl shadow-black/30">
          <p className="mb-5 text-sm text-muted">
            E-mail do convite: <span className="text-ice-2">{convite.email}</span>
          </p>
          <AtivarForm token={token} />
        </div>
      </div>
    </main>
  );
}
