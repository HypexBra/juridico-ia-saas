import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuditorForm } from "@/components/app/auditor-form";
import { listarAuditoriasPecaAction } from "./actions";
import { formatarDataHora } from "@/lib/app/formatar-data";
import type { OrigemAuditoriaPeca, StatusAuditoriaPeca } from "@/lib/types";
import type { VereditoRiscoAuditoria } from "@/lib/auditoria-peca/tipos";

export const metadata = { title: "Auditor de Peças — Jurídico IA" };

/**
 * A chamada de IA aqui roda de forma síncrona dentro da própria Server
 * Action disparada pelo formulário desta página — mesmo mecanismo de
 * `app/app/documentos/novo/page.tsx`. Teto de 120s (ADR 0012, seção 2, sem
 * lote nesta feature).
 */
export const maxDuration = 120;

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

const VEREDITO_RISCO_TONE: Record<VereditoRiscoAuditoria, "green" | "amber" | "red"> = {
  baixo: "green",
  medio: "amber",
  alto: "red",
};

const VEREDITO_RISCO_LABEL: Record<VereditoRiscoAuditoria, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

const ORIGEM_LABEL: Record<OrigemAuditoriaPeca, string> = {
  colado: "Texto colado",
  upload: "Upload",
};

/**
 * Auditor de Peças (`/app/auditor`, ADR 0012, seção 6): formulário
 * (colar/upload, toggle explícito) + lista de auditorias anteriores do
 * escritório. Nova seção standalone (não uma aba dentro de
 * `/app/fichas/[id]`), mesmo racional já usado para Documentos/Redline: nem
 * toda peça a auditar pertence a uma ficha aberta. Aceita `?fichaId=` na
 * query string para pré-vincular quando aberto a partir do botão de atalho
 * em `/app/fichas/[id]`.
 */
export default async function AuditorPage({
  searchParams,
}: {
  searchParams: Promise<{ fichaId?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "auditoria_peca");
  const { fichaId } = await searchParams;

  const resultado = temAcesso ? await listarAuditoriasPecaAction() : null;
  const auditorias = resultado?.ok ? resultado.auditorias : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Auditor de Peças</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cole o texto ou envie uma peça processual (petição, contestação, recurso) para receber notas por dimensão
          (fundamentação, coerência, pedidos, jurisprudência), um veredito de risco geral, achados citáveis e
          contra-argumentos prováveis do lado adverso.
        </p>
      </div>

      <Card>
        {temAcesso ? (
          <AuditorForm fichaCasoId={fichaId ?? null} />
        ) : (
          <>
            <CardTitle className="mb-1">Auditor de Peças</CardTitle>
            <p className="text-sm text-muted">
              Auditoria de peça processual (notas por dimensão, veredito de risco geral, contra-argumentos
              prováveis) é uma feature do <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
              <Link href="/app/perfil" className="text-ice underline underline-offset-2">
                Meu perfil
              </Link>{" "}
              para liberar.
            </p>
          </>
        )}
      </Card>

      {temAcesso && (
        <Card>
          <CardTitle className="mb-4">Auditorias anteriores</CardTitle>
          {!resultado?.ok ? (
            <p className="text-sm text-red-700">{resultado?.error ?? "Não foi possível carregar as auditorias."}</p>
          ) : auditorias.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma peça auditada ainda.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {auditorias.map((auditoria) => (
                <li key={auditoria.id} className="py-3">
                  <Link
                    href={`/app/auditor/${auditoria.id}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">
                        {auditoria.titulo ?? auditoria.nome_arquivo ?? "Peça sem título"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatarDataHora(auditoria.criado_em)} · {ORIGEM_LABEL[auditoria.origem]}
                        {auditoria.resultado_auditoria ? ` · ${auditoria.resultado_auditoria.tipoPeca}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {auditoria.status === "pronto" && auditoria.resultado_auditoria && (
                        <Badge tone={VEREDITO_RISCO_TONE[auditoria.resultado_auditoria.veredictoRisco]}>
                          Risco {VEREDITO_RISCO_LABEL[auditoria.resultado_auditoria.veredictoRisco]}
                        </Badge>
                      )}
                      <Badge tone={STATUS_TONE[auditoria.status]}>{STATUS_LABEL[auditoria.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
