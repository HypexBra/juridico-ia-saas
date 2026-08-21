"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/input";
import type { CitacaoAnaliseProcesso, ResultadoAnaliseProcesso } from "@/lib/analise-processo/tipos";
import type { AnaliseProcesso, StatusAnaliseProcesso } from "@/lib/types";
import {
  uploadEAnalisarProcessoAction,
  aplicarWriteBackAnaliseProcessoAction,
  type AplicarWritebackResultado,
} from "./analise-processo-actions";

const STATUS_TONE: Record<StatusAnaliseProcesso, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusAnaliseProcesso, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

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

/**
 * Bloco de um item citável (linha do tempo, pessoa, tese, risco etc.). Nunca
 * apresenta um item `certeza: "nao_encontrado"` como fato: o texto principal
 * fica em itálico/cinza e o badge deixa explícito que o documento não deu
 * base para a afirmação — mesmo requisito do ADR 0004, seção 5.
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
          {citacao.pagina !== null ? ` (pág. ${citacao.pagina})` : ""}: “{citacao.trechoOriginal}”
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

function ResultadoAnaliseView({ resultado }: { resultado: ResultadoAnaliseProcesso }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-silver/30 bg-silver/5 p-4">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-silver-2">Resumo executivo</h4>
        <p className="whitespace-pre-wrap text-sm text-ice-2">{resultado.resumoExecutivo}</p>
      </div>

      <div className="space-y-2">
        <SecaoAccordion titulo="Linha do tempo" contador={resultado.linhaDoTempo.length}>
          <ul className="space-y-2">
            {resultado.linhaDoTempo.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={`${item.data ? `${item.data} — ` : ""}${item.descricao}`}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Pessoas e partes" contador={resultado.pessoasPartes.length}>
          <ul className="space-y-2">
            {resultado.pessoasPartes.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={`${item.nome} — ${item.papel}${item.documento ? ` (${item.documento})` : ""}`}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Documentos encontrados" contador={resultado.documentosEncontrados.length}>
          <ul className="space-y-2">
            {resultado.documentosEncontrados.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={`${item.tipo}: ${item.descricao}`} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Questões jurídicas" contador={resultado.questoesJuridicas.length}>
          <ul className="space-y-2">
            {resultado.questoesJuridicas.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.questao} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Teses possíveis" contador={resultado.tesesPossiveis.length}>
          <ul className="space-y-2">
            {resultado.tesesPossiveis.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={item.tese}
                extra={<p className="mt-1 text-xs text-muted">{item.fundamentacao}</p>}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Evidências" contador={resultado.evidencias.length}>
          <ul className="space-y-2">
            {resultado.evidencias.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.descricao} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Contradições" contador={resultado.contradicoes.length}>
          <ul className="space-y-2">
            {resultado.contradicoes.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.descricao} />
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

        <SecaoAccordion titulo="Riscos" contador={resultado.riscos.length}>
          <ul className="space-y-2">
            {resultado.riscos.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={item.descricao}
                extra={
                  <Badge tone={item.nivel === "alto" ? "red" : item.nivel === "medio" ? "silver" : "green"}>
                    Risco {item.nivel}
                  </Badge>
                }
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Prazos identificados" contador={resultado.prazosIdentificados.length}>
          <p className="mb-2 text-xs text-muted">
            Prazos nunca são criados automaticamente — cada item com data reconhecida gera uma proposta pendente de
            aprovação em <span className="text-ice-2">Chat</span> ao clicar em &quot;Aplicar ao caso&quot;.
          </p>
          <ul className="space-y-2">
            {resultado.prazosIdentificados.map((item, i) => (
              <ItemCitavel
                key={i}
                citacao={item}
                texto={`${item.titulo}${item.data ? ` — ${item.data}` : " — sem data identificada"}: ${item.descricao}`}
              />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Próximas ações" contador={resultado.proximasAcoes.length}>
          <ul className="space-y-2">
            {resultado.proximasAcoes.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.acao} />
            ))}
          </ul>
        </SecaoAccordion>

        <SecaoAccordion titulo="Perguntas a investigar" contador={resultado.perguntasInvestigar.length}>
          <ul className="space-y-2">
            {resultado.perguntasInvestigar.map((item, i) => (
              <ItemCitavel key={i} citacao={item} texto={item.pergunta} />
            ))}
          </ul>
        </SecaoAccordion>
      </div>
    </div>
  );
}

function ResumoWriteback({ resultado }: { resultado: AplicarWritebackResultado }) {
  if (!resultado.ok) return <p className="text-xs text-red-400">{resultado.error}</p>;
  const { contagem } = resultado;
  const partes = [
    `${contagem.pessoasInseridas} pessoa(s)`,
    `${contagem.eventosInseridos} evento(s) na linha do tempo`,
    `${contagem.tesesInseridas} tese(s)`,
    `${contagem.propostasPrazoCriadas} proposta(s) de prazo`,
  ];
  return (
    <p className="text-xs text-green">
      Aplicado ao caso: {partes.join(", ")}.
      {contagem.prazosIgnoradosSemData > 0
        ? ` ${contagem.prazosIgnoradosSemData} prazo(s) sem data reconhecida não geraram proposta.`
        : ""}
    </p>
  );
}

export function AnaliseProcessoSection({
  fichaCasoId,
  analisesIniciais,
  temAcesso,
}: {
  fichaCasoId: string;
  analisesIniciais: AnaliseProcesso[];
  temAcesso: boolean;
}) {
  const [analises, setAnalises] = useState(analisesIniciais);
  const [analiseAbertaId, setAnaliseAbertaId] = useState<string | null>(analisesIniciais[0]?.id ?? null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [writebackPorAnalise, setWritebackPorAnalise] = useState<Record<string, AplicarWritebackResultado>>({});
  const [isPendingUpload, startUpload] = useTransition();
  const [isPendingWriteback, startWriteback] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!temAcesso) {
    return (
      <p className="text-sm text-muted">
        Análise inteligente de processo (upload de PDF/DOCX/imagem, com resumo executivo, linha do tempo, teses,
        riscos e prazos extraídos automaticamente) é uma feature do{" "}
        <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
        <a href="/app/perfil" className="text-ice underline underline-offset-2">
          Meu perfil
        </a>{" "}
        para liberar.
      </p>
    );
  }

  function enviar(formData: FormData) {
    setErroUpload(null);
    startUpload(async () => {
      const resultado = await uploadEAnalisarProcessoAction(fichaCasoId, formData);
      if (!resultado.ok) {
        setErroUpload(resultado.error);
        return;
      }
      setAnalises((atual) => [resultado.analise, ...atual]);
      setAnaliseAbertaId(resultado.analise.id);
      formRef.current?.reset();
    });
  }

  function aplicarAoCaso(analiseId: string) {
    startWriteback(async () => {
      const resultado = await aplicarWriteBackAnaliseProcessoAction(analiseId);
      setWritebackPorAnalise((atual) => ({ ...atual, [analiseId]: resultado }));
      if (resultado.ok) {
        setAnalises((atual) =>
          atual.map((a) => (a.id === analiseId ? { ...a, writeback_aplicado_em: new Date().toISOString() } : a)),
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        action={enviar}
        className="flex flex-col gap-3 rounded-lg border border-white/10 bg-navy/40 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="analise-processo-arquivo" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
            Documento do processo (PDF, DOCX ou imagem — até 15MB)
          </label>
          <input
            id="analise-processo-arquivo"
            name="arquivo"
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            required
            disabled={isPendingUpload}
            className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
          />
        </div>
        <Button type="submit" disabled={isPendingUpload} size="sm">
          {isPendingUpload ? "Analisando documento…" : "Analisar documento"}
        </Button>
      </form>
      <FieldError>{erroUpload}</FieldError>
      {isPendingUpload && (
        <p className="text-xs text-muted">
          A análise pode levar até 2 minutos — não saia desta página. O resultado aparece automaticamente na lista
          abaixo quando concluída.
        </p>
      )}

      {analises.length === 0 ? (
        <p className="text-sm text-muted">Nenhum documento analisado ainda para este caso.</p>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-white/5">
            {analises.map((analise) => (
              <li key={analise.id} className="py-3">
                <button
                  type="button"
                  onClick={() => setAnaliseAbertaId((atual) => (atual === analise.id ? null : analise.id))}
                  className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-ice">{analise.nome_arquivo}</p>
                    <p className="text-xs text-muted">
                      {new Date(analise.criado_em).toLocaleString("pt-BR")} · {analise.tipo_arquivo.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analise.writeback_aplicado_em && <Badge tone="blue">Aplicado ao caso</Badge>}
                    <Badge tone={STATUS_TONE[analise.status]}>{STATUS_LABEL[analise.status]}</Badge>
                  </div>
                </button>

                {analise.status === "erro" && analise.erro && (
                  <p className="mt-2 text-xs text-red-400">{analise.erro}</p>
                )}

                {analiseAbertaId === analise.id && analise.status === "pronto" && analise.resultado_analise && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPendingWriteback || Boolean(analise.writeback_aplicado_em)}
                        onClick={() => aplicarAoCaso(analise.id)}
                      >
                        {analise.writeback_aplicado_em
                          ? "Já aplicado ao caso"
                          : isPendingWriteback
                            ? "Aplicando…"
                            : "Aplicar ao caso"}
                      </Button>
                      {writebackPorAnalise[analise.id] && <ResumoWriteback resultado={writebackPorAnalise[analise.id]} />}
                    </div>
                    <ResultadoAnaliseView resultado={analise.resultado_analise} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
