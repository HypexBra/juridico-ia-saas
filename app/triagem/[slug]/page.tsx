import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TriagemForm } from "./triagem-form";

type EscritorioPublico = { id: string; nome: string };

export async function generateMetadata({ params }: PageProps<"/triagem/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: escritorio } = await supabase
    .rpc("escritorio_publico_por_slug", { p_slug: slug })
    .maybeSingle<EscritorioPublico>();

  return { title: escritorio ? `Fale com ${escritorio.nome}` : "Triagem de caso" };
}

/**
 * Página pública de triagem, sem autenticação — link que cada escritório
 * (multi-tenant) publica no próprio site com o próprio `slug`
 * (`escritorios.slug`, migration 0001). Resolve o escritório via
 * `escritorio_publico_por_slug()` (migration 0008), a única superfície segura
 * de expor esse identificador: nunca lê a tabela `escritorios` inteira
 * (tem `plano`, dado interno) diretamente aqui.
 */
export default async function TriagemPublicaPage({ params }: PageProps<"/triagem/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: escritorio } = await supabase
    .rpc("escritorio_publico_por_slug", { p_slug: slug })
    .maybeSingle<EscritorioPublico>();

  if (!escritorio) notFound();

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-silver">{escritorio.nome}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ice">Conte seu caso</h1>
          <p className="mt-2 text-sm text-muted">
            Preencha o formulário abaixo e a equipe do escritório vai analisar sua situação o quanto antes.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-navy-2/60 p-8 shadow-2xl shadow-black/30">
          <TriagemForm slug={slug} />
        </div>
      </div>
    </main>
  );
}
