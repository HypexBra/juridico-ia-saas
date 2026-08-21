import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { DocumentoResultado } from "@/components/app/documento-resultado";
import { buscarAnaliseDocumentoAction } from "../actions";
import type { StatusAnaliseDocumento } from "@/lib/types";

export const metadata = { title: "Resultado da análise — Jurídico IA" };

const STATUS_TONE: Record<StatusAnaliseDocumento, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusAnaliseDocumento, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

/**
 * Resultado de uma análise individual (`/app/documentos/[id]`, ADR 0011
 * seção 6): badges de `certeza`/`veredito`, trecho de origem sempre visível
 * junto do item (mesmo padrão da Fase 2), botão "Comparar com outro
 * documento" → `/app/documentos/comparar?a=[id]`.
 */
export default async function DetalheDocumentoPage({ params }: PageProps<"/app/documentos/[id]">) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const resultado = await buscarAnaliseDocumentoAction(id);
  if (!resultado.ok) notFound();

  const { analise } = resultado;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/app/documentos" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para Documentos
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ice">{analise.nome_arquivo}</h1>
            <p className="mt-1 text-sm text-muted">
              {new Date(analise.criado_em).toLocaleString("pt-BR")} · {analise.tipo_arquivo.toUpperCase()}
              {analise.modelo_ia_usado ? ` · ${analise.modelo_ia_usado}` : ""}
            </p>
          </div>
          <Badge tone={STATUS_TONE[analise.status]}>{STATUS_LABEL[analise.status]}</Badge>
        </div>

        {analise.status === "erro" && (
          <p className="text-sm text-red-400">{analise.erro ?? "Falha ao analisar o documento."}</p>
        )}

        {analise.status === "processando" && (
          <p className="text-sm text-muted">
            Esta análise ainda está sendo processada. Atualize a página em instantes.
          </p>
        )}

        {analise.status === "pronto" && analise.resultado_analise && (
          <div className="mt-2">
            <LinkButton href={`/app/documentos/comparar?a=${analise.id}`} variant="secondary" size="sm">
              Comparar com outro documento
            </LinkButton>
          </div>
        )}
      </Card>

      {analise.status === "pronto" && analise.resultado_analise && (
        <Card>
          <CardTitle className="mb-4">Resultado da análise</CardTitle>
          <DocumentoResultado resultado={analise.resultado_analise} />
        </Card>
      )}
    </div>
  );
}
