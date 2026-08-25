"use client";

import { Badge } from "@/components/ui/badge";
import { ItemCitavel, SecaoAccordion } from "@/components/app/citacao-resultado";
import type { ResultadoAnaliseDocumento, VereditoClausulaDoc } from "@/lib/analise-documento/tipos";

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

const LABEL_NAO_ENCONTRADO = "Não encontrado no documento";

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
              <ItemCitavel key={i} citacao={item} texto={item.descricao} labelNaoEncontrado={LABEL_NAO_ENCONTRADO} />
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
                  labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
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
              <ItemCitavel
                key={i}
                citacao={item}
                texto={`${item.data} — ${item.descricao}`}
                labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Valores identificados" contador={resultado.entidades.valores.length}>
          <ul className="space-y-2">
            {resultado.entidades.valores.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={`${item.valor} — ${item.descricao}`}
                labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Partes identificadas" contador={resultado.entidades.partes.length}>
          <ul className="space-y-2">
            {resultado.entidades.partes.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={`${item.nome} — ${item.papel}`}
                labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Inconsistências" contador={resultado.inconsistencias.length}>
          <ul className="space-y-2">
            {resultado.inconsistencias.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.descricao} labelNaoEncontrado={LABEL_NAO_ENCONTRADO} />
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
                labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
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
                <li key={i} className="rounded-lg border border-ink/10 bg-navy-2 p-3.5 text-sm italic text-muted">
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
