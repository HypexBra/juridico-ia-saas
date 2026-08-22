import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { buscarJurisprudencia } from "@/lib/jurisprudencia/busca";
import { Card, CardTitle } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { PesquisaResultados } from "@/components/app/pesquisa-resultados";
import { VerificarCitacoesForm } from "@/components/app/verificar-citacoes-form";

export const metadata = { title: "Pesquisa Jurídica — Jurídico IA" };

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export default async function PesquisaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const { q, tab } = await searchParams;
  const supabase = await createClient();
  const termo = (q ?? "").trim();

  const busca = termo
    ? await buscarJurisprudencia(supabase, usuario.perfil.escritorio.id, termo)
    : { resultados: [], aviso: undefined as string | undefined };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Pesquisa Jurídica</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Jurisprudência verificável com fonte oficial: ementas integrais do STJ
            (dados abertos, licença CC-BY) + cadastros internos. Toda decisão mostra
            tribunal, órgão, relator e data — nunca cite o que não consegue conferir.
          </p>
        </div>
        <LinkButton href="/app/dashboard" variant="ghost" size="sm">
          ← Voltar
        </LinkButton>
      </div>

      {/* Busca */}
      <Card>
        <form method="GET" action="/app/pesquisa" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={termo}
            placeholder='Ex.: prescrição intercorrente, usucapião extraordinária, nº de processo…'
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-navy-3/60 px-3.5 py-2.5 text-sm text-ice placeholder:text-muted focus:border-silver/50 focus:outline-none"
            aria-label="Termo de pesquisa"
          />
          <Button type="submit" disabled={!termo}>
            Buscar
          </Button>
        </form>
        {busca.aviso ? (
          <p className="mt-2 text-xs text-amber-300/90">{busca.aviso}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          Busca lexical (termos exatos, nº CNJ) combinada com busca semântica por significado.
        </p>
      </Card>

      {tab === "verificar" || !termo ? (
        <section aria-label="Verificador de citações">
          <VerificarCitacoesForm />
        </section>
      ) : null}

      {termo ? (
        <section aria-label="Resultados da busca" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {busca.resultados.length === 0
                ? "Nenhum resultado na base local."
                : `${busca.resultados.length} resultado(s) para`}{" "}
              <span className="text-ice">{termo}</span>
            </p>
          </div>
          <PesquisaResultados resultados={busca.resultados} formatarData={formatarData} />
        </section>
      ) : null}

      {!termo ? (
        <Card className="border-dashed bg-transparent">
          <CardTitle className="text-sm">Base local</CardTitle>
          <p className="mt-1 text-sm text-muted">
            A base é alimentada automaticamente pelos espelhos mensais de acórdãos do STJ
            (todos os órgãos julgadores) e por cadastros manuais da equipe.
            Uma citação “não verificada” significa ausência na base local — não que a decisão não exista.
          </p>
          <Link href="/app/base-conhecimento" className="mt-2 inline-block text-sm text-silver-2 underline underline-offset-2">
            Gerenciar base de conhecimento →
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
