import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { listarAnalisesAdvogadoContraAction } from "./actions";
import type { OrigemAdvogadoContra, StatusAdvogadoContra } from "@/lib/types";
import type { Vulnerabilidade } from "@/lib/advogado-contra/tipos";

export const metadata = { title: "Advogado do Contra — Jurídico IA" };

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

const VULNERABILIDADE_TONE: Record<Vulnerabilidade, "green" | "amber" | "red"> = {
  baixa: "green",
  media: "amber",
  alta: "red",
};

const VULNERABILIDADE_LABEL: Record<Vulnerabilidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const ORIGEM_LABEL: Record<OrigemAdvogadoContra, string> = {
  colado: "Texto colado",
  upload: "Upload",
  tese_cadastrada: "Tese cadastrada",
};

/**
 * Advogado do Contra (`/app/advogado-contra`, ADR 0013, seção 6): lista de
 * análises anteriores do escritório + atalho para uma nova análise —
 * espelhando exatamente `AuditorPage` (Fase 4). Seção standalone (não uma
 * aba dentro de `/app/fichas/[id]`), mesmo racional já usado para o Auditor
 * de Peças: nem toda tese a testar pertence a uma ficha aberta.
 */
export default async function AdvogadoContraPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "advogado_do_contra");

  const resultado = temAcesso ? await listarAnalisesAdvogadoContraAction() : null;
  const analises = resultado?.ok ? resultado.analises : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Advogado do Contra</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            A IA assume a perspectiva da parte adversária de uma tese, petição ou argumento jurídico e produz
            contra-argumentos, fragilidades, contradições, pontos que exigem prova e perguntas difíceis — para você
            testar a força da estratégia antes de protocolar.
          </p>
        </div>
        {temAcesso && (
          <LinkButton href="/app/advogado-contra/novo" size="sm">
            Nova análise
          </LinkButton>
        )}
      </div>

      {!temAcesso && (
        <Card>
          <CardTitle className="mb-1">Advogado do Contra</CardTitle>
          <p className="text-sm text-muted">
            A análise adversarial de teses e peças é uma feature do <span className="font-medium text-ice">Plano Pro</span>.
            Assine em{" "}
            <Link href="/app/perfil" className="text-ice underline underline-offset-2">
              Meu perfil
            </Link>{" "}
            para liberar.
          </p>
        </Card>
      )}

      {temAcesso && (
        <Card>
          <CardTitle className="mb-4">Análises anteriores</CardTitle>
          {!resultado?.ok ? (
            <p className="text-sm text-red-400">{resultado?.error ?? "Não foi possível carregar as análises."}</p>
          ) : analises.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma análise gerada ainda.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {analises.map((analise) => (
                <li key={analise.id} className="py-3">
                  <Link
                    href={`/app/advogado-contra/${analise.id}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">
                        {analise.titulo ??
                          analise.nome_arquivo ??
                          analise.resultado_advogado_contra?.teseIdentificada ??
                          "Tese sem título"}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(analise.criado_em).toLocaleString("pt-BR")} · {ORIGEM_LABEL[analise.origem]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {analise.status === "pronto" && analise.resultado_advogado_contra && (
                        <Badge tone={VULNERABILIDADE_TONE[analise.resultado_advogado_contra.vulnerabilidadeGeral]}>
                          Vulnerabilidade {VULNERABILIDADE_LABEL[analise.resultado_advogado_contra.vulnerabilidadeGeral]}
                        </Badge>
                      )}
                      <Badge tone={STATUS_TONE[analise.status]}>{STATUS_LABEL[analise.status]}</Badge>
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
