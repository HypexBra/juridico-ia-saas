import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { ComparacaoForm } from "@/components/app/comparacao-form";
import { buscarAnaliseDocumentoAction } from "../actions";

export const metadata = { title: "Comparar documentos — Jurídico IA" };

/** Mesmo teto da análise individual (ADR 0011, seção 2). */
export const maxDuration = 120;

/**
 * Comparador A x B (`/app/documentos/comparar`, ADR 0011 seção 6). Aceita
 * `?a=[id]` vindo de "Comparar com outro documento" em
 * `/app/documentos/[id]` — usado só para exibir o nome do documento de
 * referência (o arquivo em si precisa ser reenviado, ver
 * `components/app/comparacao-form.tsx`).
 */
export default async function CompararDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "comparacao_documentos");
  const { a: analiseAId } = await searchParams;

  let nomeArquivoAReferencia: string | null = null;
  if (analiseAId) {
    const resultado = await buscarAnaliseDocumentoAction(analiseAId);
    if (resultado.ok) nomeArquivoAReferencia = resultado.analise.nome_arquivo;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/app/documentos" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para Documentos
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ice">Comparar documentos</h1>
        <p className="mt-1 text-sm text-muted">
          Envie duas versões do mesmo documento (Contrato A × Contrato B) para um diff estruturado:
          cláusulas adicionadas, removidas ou alteradas, riscos introduzidos e recomendações.
        </p>
      </div>

      <Card>
        {temAcesso ? (
          <ComparacaoForm analiseDocumentoAId={analiseAId ?? null} nomeArquivoAReferencia={nomeArquivoAReferencia} />
        ) : (
          <>
            <CardTitle className="mb-1">Comparador de documentos</CardTitle>
            <p className="text-sm text-muted">
              Comparação de documentos (diff de cláusulas, riscos, recomendações) é uma feature do{" "}
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
