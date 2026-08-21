import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { DocumentoLoteForm } from "@/components/app/documento-lote-form";
import { MAX_ARQUIVOS_LOTE_DOCUMENTO } from "@/lib/analise-documento/analisar";

export const metadata = { title: "Analisar em lote — Jurídico IA" };

/**
 * Teto maior que os 120s do upload individual — lote pode ter até
 * `MAX_ARQUIVOS_LOTE_DOCUMENTO` arquivos processados sequencialmente (ADR
 * 0011, seção 2 e 8).
 */
export const maxDuration = 300;

/** Upload em lote (`/app/documentos/lote`), ADR 0011 seção 6. */
export default async function LoteDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ fichaId?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "analise_documento");
  const { fichaId } = await searchParams;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/app/documentos" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para Documentos
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ice">Analisar em lote</h1>
        <p className="mt-1 text-sm text-muted">
          Envie até {MAX_ARQUIVOS_LOTE_DOCUMENTO} documentos de uma vez — cada um é analisado
          individualmente, em sequência.
        </p>
      </div>

      <Card>
        {temAcesso ? (
          <DocumentoLoteForm fichaCasoId={fichaId ?? null} />
        ) : (
          <>
            <CardTitle className="mb-1">Document Intelligence</CardTitle>
            <p className="text-sm text-muted">
              Análise em lote de documentos avulsos é uma feature do{" "}
              <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
              <Link href="/app/perfil" className="text-ice underline underline-offset-2">
                Meu perfil
              </Link>{" "}
              para liberar.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
