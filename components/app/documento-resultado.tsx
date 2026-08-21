"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  CitacaoAnaliseProcesso,
  ResultadoAnaliseDocumento,
  VereditoClausulaDoc,
} from "@/lib/analise-documento/tipos";

const CERTEZA_TONE: Record<CitacaoAnaliseProcesso["certeza"], "green" | "silver" | "muted"> = {
  confirmado: "green",
  inferido: "silver",
  nao_encontrado: "muted",
};

const CERTEZA_LABEL: Record<CitacaoAnaliseProcesso["certeza"], string> = {
  confirmado: "Confirmado",
  inferido: "Inferido",
  nao_encontrado: "Não encontrado no documento",
};

const VEREDITO_TONE: Record<VereditoClausulaDoc, "green" | "amber" | "red"> = {
  ok: "green",
  atencao: "amber",
  risco_alto: "red",
};

const VEREDITO_LABEL: Record<VereditoClausulaDoc, string> = {
  ok: "OK",
  atencao: "Atenção",
  risco_alto: "Risco alto",
};

/**
 * Bloco de um item citável (ponto-chave, cláusula, entidade, risco etc.).
 * Mesmo padrão visual da Fase 2 (`analise-processo-section.tsx`, ADR 0004):
 * um item `certeza: "nao_encontrado"` nunca é apresentado como fato — texto
 * em itálico/cinza — e o trecho de origem (`trechoOriginal`/`pagina`) fica
 * sempre visível junto do item, sem exigir um clique extra.
 */
function ItemCitavel({ texto, citacao, extra }: { texto: string; citacao: CitacaoAnaliseProcesso; extra?: ReactNode }) {
  const naoEncontrado = citacao.certeza === "nao_encontrado";
  return (
    <li className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <p className={naoEncontrado ? "text-sm italic text-muted" : "text-sm text-ice-2"}>{texto}</p>
        <Badge tone={CERTEZA_TONE[citacao.certeza]}>{CERTEZA_LABEL[citacao.certeza]}</Badge>
      </div>
      {extra}
      {citacao.trechoOriginal && (
        <p className="mt-2 border-t border-white/5 pt-2 text-xs text-muted">
          <span className="font-medium text-silver-2">Trecho de origem</span>
          {citacao.pagina !== null ? ` (pág. ${citacao.pagina})` : ""}: &ldquo;{citacao.trechoOriginal}&rdquo;
        </p>
      )}
    </li>
  );
}

function SecaoAccordion({ titulo, contador, children }: { titulo: string; contador: number; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border border-white/10">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-ice">
          {titulo} <span className="ml-1 text-xs text-muted">({contador})</span>
        </span>
        <span className="text-xs text-muted">{aberto ? "Recolher" : "Expandir"}</span>
      </button>
      {aberto && <div className="border-t border-white/10 p-4">{children}</div>}
    </div>
  );
}

export function DocumentoResultado({ resultado }: { resultado: ResultadoAnaliseDocumento }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-silver/30 bg-silver/5 p-4">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-silver-2">Resumo executivo</h4>
          <Badge tone="blue">{resultado.tipoDocumento}</Badge>
        </div>
        <p className="whitespace-pre-wrap text-sm text-ice-2">{resultado.resumoExecutivo}</p>
      </div>

      <div className="space-y-2">
        <SecaoAccordion titulo="Pontos-chave" contador={resultado.pontosChave.length}>
          <ul className="space-y-2">
            {resultado.pontosChave.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.descricao} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Cláusulas" contador={resultado.clausulas.length}>
          {resultado.clausulas.length === 0 ? (
            <p className="text-sm text-muted">Este documento não tem estrutura clausular identificada.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.clausulas.map((item, i) => (
                <ItemCitavel
                  key={i}
                  citacao={item}
                  texto={`Cláusula ${item.numero}${item.problema ? ` — ${item.problema}` : ""}`}
                  extra={
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={VEREDITO_TONE[item.veredito]}>{VEREDITO_LABEL[item.veredito]}</Badge>
                      {item.sugestao && <span className="text-xs text-muted">Sugestão: {item.sugestao}</span>}
                    </div>
                  }
                />
              ))}
            </ul>
          )}
        </SecaoAccordion>

        <SecaoAccordion titulo="Datas identificadas" contador={resultado.entidades.datas.length}>
          <ul className="space-y-2">
            {resultado.entidades.datas.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={`${item.data} — ${item.descricao}`} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Valores identificados" contador={resultado.entidades.valores.length}>
          <ul className="space-y-2">
            {resultado.entidades.valores.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={`${item.valor} — ${item.descricao}`} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Partes identificadas" contador={resultado.entidades.partes.length}>
          <ul className="space-y-2">
            {resultado.entidades.partes.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={`${item.nome} — ${item.papel}`} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Inconsistências" contador={resultado.inconsistencias.length}>
          <ul className="space-y-2">
            {resultado.inconsistencias.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.descricao} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Riscos" contador={resultado.riscos.length}>
          <ul className="space-y-2">
            {resultado.riscos.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={item.descricao}
                extra={
                  <Badge tone={item.nivel === "alto" ? "red" : item.nivel === "medio" ? "amber" : "green"}>
                    Risco {item.nivel}
                  </Badge>
                }
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Informações ausentes" contador={resultado.informacoesAusentes.length}>
          {resultado.informacoesAusentes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma lacuna relevante apontada pela IA.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.informacoesAusentes.map((texto, i) => (
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
