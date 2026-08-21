"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gerarEstrategiaCasoAction } from "@/app/app/fichas/[id]/estrategia-actions";
import { EstrategiaCasoResultado } from "@/components/app/estrategia-caso-resultado";
import type { EstrategiaCaso, StatusEstrategiaCaso, TarefaCaso, TeseCaso } from "@/lib/types";

const STATUS_TONE: Record<StatusEstrategiaCaso, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusEstrategiaCaso, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

function ContadoresContexto({ contextoResumo }: { contextoResumo: Record<string, unknown> | null }) {
  if (!contextoResumo) return null;
  const totalTeses = contextoResumo.totalTeses;
  const totalEventos = contextoResumo.totalEventos;
  const totalPessoas = contextoResumo.totalPessoas;
  const totalJurisprudencias = contextoResumo.totalJurisprudencias;
  const totalAnalisesConsideradas = contextoResumo.totalAnalisesConsideradas;

  return (
    <p className="text-xs text-muted">
      Gerado com base em: {String(totalTeses ?? 0)} tese(s), {String(totalEventos ?? 0)} evento(s),{" "}
      {String(totalPessoas ?? 0)} pessoa(s), {String(totalJurisprudencias ?? 0)} jurisprudência(s) citada(s) e{" "}
      {String(totalAnalisesConsideradas ?? 0)} análise(s) de IA já realizada(s) sobre o caso.
    </p>
  );
}

function CartaoEstrategia({
  fichaCasoId,
  estrategia,
  tesesCaso,
  tarefasCaso,
}: {
  fichaCasoId: string;
  estrategia: EstrategiaCaso;
  tesesCaso: TeseCaso[];
  tarefasCaso: TarefaCaso[];
}) {
  return (
    <div className="space-y-4">
      <ContadoresContexto contextoResumo={estrategia.contexto_resumo} />

      {estrategia.status === "processando" && (
        <p className="text-sm text-muted">A IA ainda está sintetizando este caso. Isso pode levar até 2 minutos.</p>
      )}

      {estrategia.status === "erro" && (
        <p className="text-sm text-red-400">{estrategia.erro ?? "Não foi possível gerar a estratégia."}</p>
      )}

      {estrategia.status === "pronto" && estrategia.resultado_estrategia && (
        <EstrategiaCasoResultado
          fichaCasoId={fichaCasoId}
          resultado={estrategia.resultado_estrategia}
          tesesCaso={tesesCaso}
          tarefasCaso={tarefasCaso}
        />
      )}
    </div>
  );
}

export function EstrategiaCasoSecao({
  fichaCasoId,
  temAcesso,
  estrategias,
  tesesCaso,
  tarefasCaso,
}: {
  fichaCasoId: string;
  temAcesso: boolean;
  estrategias: EstrategiaCaso[];
  tesesCaso: TeseCaso[];
  tarefasCaso: TarefaCaso[];
}) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [idsExpandidos, setIdsExpandidos] = useState<Set<string>>(new Set());
  const router = useRouter();

  if (!temAcesso) {
    return (
      <p className="text-sm text-muted">
        O Estrategista Jurídico (síntese com IA de teses, linha do tempo, pessoas, jurisprudência citada e análises já
        feitas sobre este caso, com objetivo, provas, riscos, oportunidades, próximos passos e ações recomendadas) é
        uma feature do <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
        <Link href="/app/perfil" className="text-ice underline underline-offset-2">
          Meu perfil
        </Link>{" "}
        para liberar.
      </p>
    );
  }

  const [maisRecente, ...historico] = estrategias;

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await gerarEstrategiaCasoAction(fichaCasoId);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function alternarExpandido(id: string) {
    setIdsExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Sintetiza tudo que já se sabe sobre este caso em uma estratégia acionável: objetivo, teses, provas,
            riscos, oportunidades, próximos passos e ações recomendadas.
          </p>
        </div>
        <Button onClick={gerar} disabled={isPending} size="sm">
          {isPending ? "Gerando estratégia…" : estrategias.length > 0 ? "Gerar nova estratégia" : "Gerar estratégia"}
        </Button>
      </div>

      {isPending && (
        <p className="text-xs text-muted">
          A geração pode levar até 2 minutos — não saia desta página. O resultado aparece automaticamente abaixo
          quando concluído.
        </p>
      )}
      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {!maisRecente ? (
        <p className="text-sm text-muted">Nenhuma estratégia gerada ainda para este caso.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Estratégia mais recente — {new Date(maisRecente.criado_em).toLocaleString("pt-BR")}
              </span>
              <Badge tone={STATUS_TONE[maisRecente.status]}>{STATUS_LABEL[maisRecente.status]}</Badge>
            </div>
            <CartaoEstrategia
              fichaCasoId={fichaCasoId}
              estrategia={maisRecente}
              tesesCaso={tesesCaso}
              tarefasCaso={tarefasCaso}
            />
          </div>

          {historico.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted">
                Histórico de gerações anteriores ({historico.length})
              </h4>
              {historico.map((estrategia) => {
                const aberto = idsExpandidos.has(estrategia.id);
                return (
                  <div key={estrategia.id} className="rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => alternarExpandido(estrategia.id)}
                      className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="text-sm text-ice-2">
                        {new Date(estrategia.criado_em).toLocaleString("pt-BR")}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[estrategia.status]}>{STATUS_LABEL[estrategia.status]}</Badge>
                        <span className="text-xs text-muted">{aberto ? "Recolher" : "Expandir"}</span>
                      </div>
                    </button>
                    {aberto && (
                      <div className="border-t border-white/10 p-4">
                        <CartaoEstrategia
                          fichaCasoId={fichaCasoId}
                          estrategia={estrategia}
                          tesesCaso={tesesCaso}
                          tarefasCaso={tarefasCaso}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
