"use client";

import { Badge } from "@/components/ui/badge";
import { ItemCitavel, SecaoAccordion } from "@/components/app/citacao-resultado";
import type {
  ArgumentoContrario,
  CategoriaFragilidade,
  Fragilidade,
  ForcaArgumento,
  ResultadoAdvogadoContra,
  SeveridadeFragilidade,
  Vulnerabilidade,
} from "@/lib/advogado-contra/tipos";
import { CATEGORIAS_FRAGILIDADE } from "@/lib/advogado-contra/tipos";

const LABEL_NAO_ENCONTRADO = "Não encontrado no texto analisado";

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

const FORCA_TONE: Record<ForcaArgumento, "muted" | "amber" | "red"> = {
  baixa: "muted",
  media: "amber",
  alta: "red",
};

const FORCA_LABEL: Record<ForcaArgumento, string> = {
  baixa: "Força baixa",
  media: "Força média",
  alta: "Força alta",
};

const SEVERIDADE_TONE: Record<SeveridadeFragilidade, "muted" | "amber" | "red"> = {
  leve: "muted",
  moderada: "amber",
  grave: "red",
};

const SEVERIDADE_LABEL: Record<SeveridadeFragilidade, string> = {
  leve: "Leve",
  moderada: "Moderada",
  grave: "Grave",
};

const CATEGORIA_LABEL: Record<CategoriaFragilidade, string> = {
  fundamentacao: "Fundamentação",
  fatos: "Fatos",
  provas: "Provas",
  pedidos: "Pedidos",
  argumentacao: "Argumentação",
  inconsistencia: "Inconsistência",
  clareza: "Clareza",
  estrutura: "Estrutura",
};

function fragilidadesPorCategoria(fragilidades: Fragilidade[]): Array<[CategoriaFragilidade, Fragilidade[]]> {
  return CATEGORIAS_FRAGILIDADE.map((categoria) => [
    categoria,
    fragilidades.filter((f) => f.categoria === categoria),
  ]).filter(([, itens]) => itens.length > 0) as Array<[CategoriaFragilidade, Fragilidade[]]>;
}

function ArgumentoContrarioItem({ argumento }: { argumento: ArgumentoContrario }) {
  return (
    <ItemCitavel
      citacao={argumento}
      texto={argumento.descricao}
      labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
      extra={<Badge tone={FORCA_TONE[argumento.forca]}>{FORCA_LABEL[argumento.forca]}</Badge>}
    />
  );
}

/**
 * Resultado do Advogado do Contra (`/app/advogado-contra/[id]`, ADR 0013):
 * dois avisos fixos e SEMPRE visíveis (nunca condicionais a nenhum veredito)
 * — o aviso geral de "simulação da IA" e um segundo, MAIS FORTE, específico
 * de `precedentesContrariosProvaveis` (a seção mais perigosa em termos de
 * risco de alucinação, ver guardrail em `lib/advogado-contra/prompt.ts`) —,
 * veredito categórico de vulnerabilidade com badge de cor semântica, e cada
 * categoria de achado numa seção própria com citação clicável, espelhando a
 * estrutura visual de `AuditorResultado` (Fase 4).
 */
export function AdvogadoContraResultado({ resultado }: { resultado: ResultadoAdvogadoContra }) {
  const gruposFragilidades = fragilidadesPorCategoria(resultado.fragilidades);

  return (
    <div className="space-y-5">
      {/* Aviso fixo geral — requisito funcional do ADR 0013, SEMPRE visível,
          nunca condicional a veredito/achados específicos. Banner âmbar claro
          (amber-50/200) com texto âmbar escuro, legível sobre papel. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          Simulação da IA — não é citação jurídica verificada nem avaliação definitiva
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-700">
          Esta análise simula a perspectiva da parte adversária a partir do texto fornecido, gerada por IA — não
          substitui a análise jurídica do advogado responsável nem representa uma avaliação oficial da tese. Revise
          cada argumento, fragilidade e precedente hipotético antes de tomar qualquer decisão com base neste
          relatório.
        </p>
      </div>

      <div className="rounded-lg border border-silver/30 bg-silver/5 p-4">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-silver-2">Tese identificada</h4>
        <p className="text-sm text-ice-2">{resultado.teseIdentificada}</p>
      </div>

      <div className="rounded-lg border border-ink/10 bg-navy-2 p-4">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Resumo executivo</h4>
        <p className="whitespace-pre-wrap text-sm text-ice-2">{resultado.resumoExecutivo}</p>
      </div>

      <div className="rounded-lg border border-ink/10 bg-navy-2 p-4">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Vulnerabilidade geral da tese</h4>
          <Badge tone={VULNERABILIDADE_TONE[resultado.vulnerabilidadeGeral]}>
            Vulnerabilidade {VULNERABILIDADE_LABEL[resultado.vulnerabilidadeGeral]}
          </Badge>
        </div>
        <p className="text-sm text-ice-2">{resultado.justificativaVulnerabilidade}</p>
      </div>

      <div className="space-y-2">
        <SecaoAccordion titulo="Argumentos contrários" contador={resultado.argumentosContrarios.length}>
          <ul className="space-y-2">
            {resultado.argumentosContrarios.map((argumento, i) => (
              <ArgumentoContrarioItem key={i} argumento={argumento} />
            ))}
          </ul>
        </SecaoAccordion>

        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Fragilidades por categoria</h4>
          {gruposFragilidades.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma fragilidade registrada.</p>
          ) : (
            gruposFragilidades.map(([categoria, itens]) => (
              <SecaoAccordion key={categoria} titulo={CATEGORIA_LABEL[categoria]} contador={itens.length}>
                <ul className="space-y-2">
                  {itens.map((fragilidade, i) => (
                    <ItemCitavel
                      key={i}
                      citacao={fragilidade}
                      texto={fragilidade.descricao}
                      labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
                      extra={
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Badge tone={SEVERIDADE_TONE[fragilidade.severidade]}>
                            {SEVERIDADE_LABEL[fragilidade.severidade]}
                          </Badge>
                          {fragilidade.sugestaoReforco && (
                            <span className="text-xs text-muted">
                              <span className="font-medium text-silver-2">Sugestão de reforço:</span>{" "}
                              {fragilidade.sugestaoReforco}
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
        </div>

        <SecaoAccordion titulo="Contradições internas" contador={resultado.contradicoes.length}>
          {resultado.contradicoes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma contradição interna identificada.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.contradicoes.map((contradicao, i) => (
                <ItemCitavel
                  key={i}
                  citacao={contradicao}
                  texto={contradicao.descricao}
                  labelNaoEncontrado={LABEL_NAO_ENCONTRADO}
                />
              ))}
            </ul>
          )}
        </SecaoAccordion>

        {/* Seção CLARAMENTE separada, com aviso reforçado próprio — a mais
            perigosa em termos de risco de alucinação (ADR 0013). Banner
            vermelho claro (red-50/200) com texto vermelho escuro sobre papel. */}
        <div className="rounded-lg border border-red-200">
          <div className="border-b border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-800">Precedentes contrários prováveis (hipótese da IA)</p>
            <p className="mt-1 text-xs leading-relaxed text-red-700">
              Isto é uma hipótese da IA sobre o TIPO de entendimento jurisprudencial/doutrinário que pode existir
              contra a tese — NÃO é uma citação verificada. Nenhum número de processo, relator, data de julgamento
              ou súmula específica aqui deve ser tratado como real: confirme sempre em uma base de jurisprudência
              oficial antes de citar qualquer precedente em uma peça.
            </p>
          </div>
          <div className="p-4">
            {resultado.precedentesContrariosProvaveis.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma hipótese de precedente contrário identificada.</p>
            ) : (
              <ul className="space-y-2">
                {resultado.precedentesContrariosProvaveis.map((precedente, i) => (
                  <li key={i} className="rounded-lg border border-ink/10 bg-navy-2 p-3.5">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-ice-2">{precedente.descricao}</p>
                      <Badge tone={FORCA_TONE[precedente.forca]}>{FORCA_LABEL[precedente.forca]}</Badge>
                    </div>
                    {precedente.areaJuridicaProvavel && (
                      <p className="text-xs text-muted">
                        <span className="font-medium text-silver-2">Área jurídica provável:</span>{" "}
                        {precedente.areaJuridicaProvavel}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SecaoAccordion titulo="Pontos que exigem prova" contador={resultado.pontosQueExigemProva.length}>
          {resultado.pontosQueExigemProva.length === 0 ? (
            <p className="text-sm text-muted">Nenhum ponto sem lastro probatório apontado pela IA.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.pontosQueExigemProva.map((texto, i) => (
                <li key={i} className="rounded-lg border border-ink/10 bg-navy-2 p-3.5 text-sm text-ice-2">
                  {texto}
                </li>
              ))}
            </ul>
          )}
        </SecaoAccordion>

        <SecaoAccordion titulo="Perguntas difíceis" contador={resultado.perguntasDificeis.length}>
          {resultado.perguntasDificeis.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma pergunta difícil apontada pela IA.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.perguntasDificeis.map((texto, i) => (
                <li key={i} className="rounded-lg border border-ink/10 bg-navy-2 p-3.5 text-sm italic text-muted">
                  {texto}
                </li>
              ))}
            </ul>
          )}
        </SecaoAccordion>

        <SecaoAccordion
          titulo="Recomendações de fortalecimento"
          contador={resultado.recomendacoesFortalecimento.length}
        >
          {resultado.recomendacoesFortalecimento.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma recomendação de reforço apontada pela IA.</p>
          ) : (
            <ul className="space-y-2">
              {resultado.recomendacoesFortalecimento.map((texto, i) => (
                <li key={i} className="rounded-lg border border-ink/10 bg-navy-2 p-3.5 text-sm text-ice-2">
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
