import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdvogadoContraResultado } from "@/components/app/advogado-contra-resultado";
import { buscarAnaliseAdvogadoContraAction } from "../actions";
import { formatarDataHora } from "@/lib/app/formatar-data";
import type { StatusAdvogadoContra } from "@/lib/types";

export const metadata = { title: "Resultado da análise — Advogado do Contra — Jurídico IA" };

const STATUS_TONE: Record<StatusAdvogadoContra, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusAdvogadoContra, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

const ORIGEM_LABEL: Record<string, string> = {
  colado: "Texto colado",
  upload: "Upload",
  tese_cadastrada: "Tese cadastrada",
};

/**
 * Resultado de uma análise do Advogado do Contra (`/app/advogado-contra/[id]`,
 * ADR 0013): veredito categórico de vulnerabilidade, aviso fixo de
 * "simulação da IA" (sempre visível, cuidado é do próprio
 * `AdvogadoContraResultado`), achados adversariais agrupados por categoria
 * com citação clicável e seção separada/reforçada de precedentes contrários
 * prováveis.
 */
export default async function DetalheAnaliseAdvogadoContraPage({ params }: PageProps<"/app/advogado-contra/[id]">) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const resultado = await buscarAnaliseAdvogadoContraAction(id);
  if (!resultado.ok) notFound();

  const { analise } = resultado;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/app/advogado-contra" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para Advogado do Contra
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ice">
              {analise.titulo ??
                analise.nome_arquivo ??
                analise.resultado_advogado_contra?.teseIdentificada ??
                "Tese sem título"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {formatarDataHora(analise.criado_em)} · {ORIGEM_LABEL[analise.origem]}
              {analise.tipo_arquivo ? ` (${analise.tipo_arquivo.toUpperCase()})` : ""}
              {analise.modelo_ia_usado ? ` · ${analise.modelo_ia_usado}` : ""}
            </p>
          </div>
          <Badge tone={STATUS_TONE[analise.status]}>{STATUS_LABEL[analise.status]}</Badge>
        </div>

        {analise.status === "erro" && (
          <p className="text-sm text-red-400">{analise.erro ?? "Falha ao analisar como advogado do contra."}</p>
        )}

        {analise.status === "processando" && (
          <p className="text-sm text-muted">
            Esta análise ainda está sendo processada. Atualize a página em instantes.
          </p>
        )}
      </Card>

      {analise.status === "pronto" && analise.resultado_advogado_contra && (
        <Card>
          <CardTitle className="mb-4">Resultado da análise</CardTitle>
          <AdvogadoContraResultado resultado={analise.resultado_advogado_contra} />
        </Card>
      )}
    </div>
  );
}
