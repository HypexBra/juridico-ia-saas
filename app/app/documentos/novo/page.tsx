import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { DocumentoUploadForm } from "@/components/app/documento-upload-form";

export const metadata = { title: "Analisar documento — Jurídico IA" };

/**
 * A chamada de IA aqui roda de forma síncrona dentro da própria Server
 * Action (`analisarDocumentoAction`) disparada pelo formulário desta página —
 * mesmo mecanismo de `app/app/fichas/[id]/page.tsx` (Fase 2). Teto de 120s
 * (ADR 0011, seção 2), igual à análise inteligente de processo.
 */
export const maxDuration = 120;

/**
 * Upload individual (`/app/documentos/novo`). Aceita `?fichaId=` na query
 * string para pré-vincular quando aberto a partir do botão "Analisar
 * documento" dentro de `/app/fichas/[id]` (ADR 0011, seção 6).
 */
export default async function NovoDocumentoPage({
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
        <h1 className="mt-2 font-display text-2xl font-semibold text-ice">Analisar documento</h1>
        <p className="mt-1 text-sm text-muted">
          Envie um documento avulso (contrato, petição, procuração etc.) para resumo executivo, classificação,
          cláusulas, extração de datas/valores/partes e riscos.
        </p>
      </div>

      <Card>
        {temAcesso ? (
          <DocumentoUploadForm fichaCasoId={fichaId ?? null} />
        ) : (
          <>
            <CardTitle className="mb-1">Document Intelligence</CardTitle>
            <p className="text-sm text-muted">
              Análise de documento avulso é uma feature do <span className="font-medium text-ice">Plano Pro</span>.
              Assine em{" "}
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
