"use client";

import { Badge } from "@/components/ui/badge";
import { ItemCitavel, SecaoAccordion } from "@/components/app/citacao-resultado";
import {
  CATEGORIAS_ACHADO_AUDITORIA,
  DIMENSOES_NOTA_AUDITORIA,
  type AchadoAuditoriaPeca,
  type CategoriaAchadoAuditoria,
  type ContraArgumentoProvavel,
  type DimensaoNotaAuditoria,
  type ResultadoAuditoriaPeca,
  type SeveridadeAchadoAuditoria,
  type VereditoRiscoAuditoria,
} from "@/lib/auditoria-peca/tipos";

const LABEL_NAO_ENCONTRADO = "Não encontrado na peça";

const DIMENSAO_LABEL: Record<DimensaoNotaAuditoria, string> = {
  fundamentacao: "Fundamentação",
  coerencia: "Coerência",
  pedidos: "Pedidos",
  jurisprudencia: "Jurisprudência",
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

const SEVERIDADE_TONE: Record<SeveridadeAchadoAuditoria, "muted" | "amber" | "red"> = {
  informativo: "muted",
  atencao: "amber",
  critico: "red",
};

const SEVERIDADE_LABEL: Record<SeveridadeAchadoAuditoria, string> = {
  informativo: "Informativo",
  atencao: "Atenção",
  critico: "Crítico",
};

const FORCA_TONE: Record<ContraArgumentoProvavel["forca"], "muted" | "amber" | "red"> = {
  baixa: "muted",
  media: "amber",
  alta: "red",
};

const FORCA_LABEL: Record<ContraArgumentoProvavel["forca"], string> = {
  baixa: "Força baixa",
  media: "Força média",
  alta: "Força alta",
};

const CATEGORIA_LABEL: Record<CategoriaAchadoAuditoria, string> = {
  estrutura: "Estrutura",
  fatos: "Fatos",
  fundamentacao: "Fundamentação",
  legislacao: "Legislação",
  jurisprudencia: "Jurisprudência",
  pedidos: "Pedidos",
  argumentacao: "Argumentação",
  inconsistencia: "Inconsistência",
  omissao: "Omissão",
  risco: "Risco",
  clareza: "Clareza",
};

/** Cor da barra de nota — só efeito visual, nunca esconde a humildade
 * epistêmica calibrada no prompt (ver aviso fixo abaixo). */
function corBarraNota(nota: number): string {
  if (nota >= 8) return "bg-green";
  if (nota >= 5) return "bg-amber-400";
  return "bg-red-400";
}

function CartaoNota({ dimensao, nota }: { dimensao: DimensaoNotaAuditoria; nota: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-navy-2 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{DIMENSAO_LABEL[dimensao]}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ice">
        {nota.toFixed(1)}
        <span className="text-sm font-normal text-muted">/10</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${corBarraNota(nota)}`} style={{ width: `${nota * 10}%` }} />
      </div>
    </div>
  );
}

function achadosPorCategoria(achados: AchadoAuditoriaPeca[]): Array<[CategoriaAchadoAuditoria, AchadoAuditoriaPeca[]]> {
  return CATEGORIAS_ACHADO_AUDITORIA.map((categoria) => [categoria, achados.filter((a) => a.categoria === categoria)]).filter(
    ([, itens]) => itens.length > 0,
  ) as Array<[CategoriaAchadoAuditoria, AchadoAuditoriaPeca[]]>;
}

/**
 * Resultado da auditoria de peça (`/app/auditor/[id]`, ADR 0012 seção 6):
 * notas 0-10 por dimensão em destaque, veredito de risco geral com badge de
 * cor semântica (baixo=verde, medio=âmbar, alto=vermelho — mesma paleta de
 * `RÓTULO_VEREDITO` do redline), aviso FIXO e PERMANENTE (não condicional a
 * nenhum veredito) de que a pontuação é ferramenta auxiliar e nunca verdade
 * jurídica absoluta, achados agrupados por categoria com citação clicável e
 * seção separada de contra-argumentos prováveis do lado adverso.
 */
export function AuditorResultado({ resultado }: { resultado: ResultadoAuditoriaPeca }) {
  const gruposAchados = achadosPorCategoria(resultado.achados);

  return (
    <div className="space-y-5">
      {/* Aviso fixo — requisito funcional do ADR 0012, seção 4/6, SEMPRE visível,
          nunca condicional a veredito/nota específicos. */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-sm font-medium text-amber-200">Ferramenta auxiliar — não é verdade jurídica absoluta</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
          Estas notas são uma ferramenta auxiliar de revisão, geradas por IA — não substituem a análise jurídica do
          advogado responsável nem representam uma avaliação oficial ou definitiva da peça. Revise cada achado e
          contra-argumento antes de tomar qualquer decisão com base neste relatório.
        </p>
      </div>

      <div className="rounded-lg border border-silver/30 bg-silver/5 p-4">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-silver-2">Resumo executivo</h4>
          <Badge tone="blue">{resultado.tipoPeca}</Badge>
        </div>
        <p className="whitespace-pre-wrap text-sm text-ice-2">{resultado.resumoExecutivo}</p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Notas por dimensão</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DIMENSOES_NOTA_AUDITORIA.map((dimensao) => (
            <CartaoNota key={dimensao} dimensao={dimensao} nota={resultado.notas[dimensao]} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-navy-2 p-4">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Veredito de risco geral</h4>
          <Badge tone={VEREDITO_RISCO_TONE[resultado.veredictoRisco]}>
            Risco {VEREDITO_RISCO_LABEL[resultado.veredictoRisco]}
          </Badge>
        </div>
        <p className="text-sm text-ice-2">{resultado.justificativaRisco}</p>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Achados por categoria</h4>
        {gruposAchados.length === 0 ? (
          <p className="text-sm text-muted">Nenhum achado registrado.</p>
        ) : (
          gruposAchados.map(([categoria, itens]) => (
            <SecaoAccordion key={categoria} titulo={CATEGORIA_LABEL[categoria]} contador={itens.length}>
              <ul className="space-y-2">
                {itens.map((achado, i) => (
                  <ItemCitavel
                    key={i}
                    citacao={achado}
                    texto={achado.descricao}
                    labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
                    extra={
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERIDADE_TONE[achado.severidade]}>{SEVERIDADE_LABEL[achado.severidade]}</Badge>
                        {achado.sugestao && (
                          <span className="text-xs text-muted">
                            <span className="font-medium text-silver-2">Sugestão:</span> {achado.sugestao}
                          </span>
                        )}
                      </div>
                    }
                  />
                ))}
              </ul>
            </SecaoAccordion>
          ))
        )}

        <SecaoAccordion titulo="Contra-argumentos prováveis" contador={resultado.contraArgumentosProvaveis.length}>
          {resultado.contraArgumentosProvaveis.length === 0 ? (
            <p className="text-sm text-muted">Nenhum contra-argumento provável identificado.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.contraArgumentosProvaveis.map((item, i) => (
                <ItemCitavel
                  key={i}
                  citacao={item}
                  texto={item.descricao}
                  labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
                  extra={<Badge tone={FORCA_TONE[item.forca]}>{FORCA_LABEL[item.forca]}</Badge>}
                />
              ))}
            </ul>
          )}
        </SecaoAccordion>

        <SecaoAccordion titulo="Omissões detectadas" contador={resultado.omissoesDetectadas.length}>
          {resultado.omissoesDetectadas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma omissão relevante apontada pela IA.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.omissoesDetectadas.map((texto, i) => (
                <li key={i} className="rounded-lg border border-white/10 bg-navy-2 p-3.5 text-sm italic text-muted">
                  {texto}
                </li>
              ))}
            </ul>
          )}
        </SecaoAccordion>
      </div>
    </div>
  );
}
