import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuditorResultado } from "@/components/app/auditor-resultado";
import { buscarAuditoriaPecaAction } from "../actions";
import { formatarDataHora } from "@/lib/app/formatar-data";
import type { StatusAuditoriaPeca } from "@/lib/types";

export const metadata = { title: "Resultado da auditoria — Jurídico IA" };

const STATUS_TONE: Record<StatusAuditoriaPeca, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusAuditoriaPeca, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

/**
 * Resultado de uma auditoria de peça (`/app/auditor/[id]`, ADR 0012 seção
 * 6): notas por dimensão, veredito de risco geral, aviso fixo de "ferramenta
 * auxiliar" (sempre visível, cuidado é do próprio `AuditorResultado`),
 * achados agrupados por categoria com citação clicável e contra-argumentos
 * prováveis.
 */
export default async function DetalheAuditoriaPecaPage({ params }: PageProps<"/app/auditor/[id]">) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const resultado = await buscarAuditoriaPecaAction(id);
  if (!resultado.ok) notFound();

  const { auditoria } = resultado;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/app/auditor" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para Auditor de Peças
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ice">
              {auditoria.titulo ?? auditoria.nome_arquivo ?? "Peça sem título"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {formatarDataHora(auditoria.criado_em)} ·{" "}
              {auditoria.origem === "colado" ? "Texto colado" : "Upload"}
              {auditoria.tipo_arquivo ? ` (${auditoria.tipo_arquivo.toUpperCase()})` : ""}
              {auditoria.modelo_ia_usado ? ` · ${auditoria.modelo_ia_usado}` : ""}
            </p>
          </div>
          <Badge tone={STATUS_TONE[auditoria.status]}>{STATUS_LABEL[auditoria.status]}</Badge>
        </div>

        {auditoria.status === "erro" && (
          <p className="text-sm text-red-400">{auditoria.erro ?? "Falha ao auditar a peça."}</p>
        )}

        {auditoria.status === "processando" && (
          <p className="text-sm text-muted">
            Esta auditoria ainda está sendo processada. Atualize a página em instantes.
          </p>
        )}
      </Card>

      {auditoria.status === "pronto" && auditoria.resultado_auditoria && (
        <Card>
          <CardTitle className="mb-4">Resultado da auditoria</CardTitle>
          <AuditorResultado resultado={auditoria.resultado_auditoria} />
        </Card>
      )}
    </div>
  );
}
