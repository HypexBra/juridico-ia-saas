"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { criarTeseManualAction } from "@/app/app/fichas/actions";
import { criarTarefaCasoAction } from "@/app/app/fichas/[id]/tarefas-actions";
import type {
  AcaoRecomendadaEstrategiaCaso,
  NivelRiscoEstrategia,
  OrigemContextoEstrategia,
  ProximoPassoEstrategiaCaso,
  ResultadoEstrategiaCaso,
  TeseEstrategiaCaso,
} from "@/lib/estrategia-caso/tipos";
import type { TarefaCaso, TeseCaso } from "@/lib/types";

const NIVEL_RISCO_TONE: Record<NivelRiscoEstrategia, "red" | "silver" | "green"> = {
  alto: "red",
  medio: "silver",
  baixo: "green",
};

const NIVEL_RISCO_LABEL: Record<NivelRiscoEstrategia, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

const PRIORIDADE_TONE: Record<ProximoPassoEstrategiaCaso["prioridade"], "red" | "silver" | "muted"> = {
  alta: "red",
  media: "silver",
  baixa: "muted",
};

const PRIORIDADE_LABEL: Record<ProximoPassoEstrategiaCaso["prioridade"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const ORIGEM_LABEL: Record<OrigemContextoEstrategia["tipo"], string> = {
  tese: "Tese cadastrada",
  evento: "Evento da linha do tempo",
  analise_documento: "Análise de documento",
  analise_processo: "Análise de processo",
  ficha: "Fatos da ficha",
};

function OrigemTags({ origens }: { origens: OrigemContextoEstrategia[] }) {
  if (origens.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {origens.map((origem, indice) => (
        <span
          key={indice}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-muted"
        >
          {ORIGEM_LABEL[origem.tipo]}
        </span>
      ))}
    </div>
  );
}

function TeseItem({
  fichaCasoId,
  tese,
  tesesCaso,
}: {
  fichaCasoId: string;
  tese: TeseEstrategiaCaso;
  tesesCaso: TeseCaso[];
}) {
  const [cadastrada, setCadastrada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const label = tese.papel === "principal" ? "Tese principal" : "Tese subsidiária";

  if (tese.origem === "tese_cadastrada") {
    const teseCadastrada = tesesCaso.find((item) => item.id === tese.teseCasoId);
    return (
      <li className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Badge tone={tese.papel === "principal" ? "blue" : "muted"}>{label}</Badge>
          <Badge tone="green">Tese cadastrada</Badge>
        </div>
        <p className="text-sm text-ice-2">
          {teseCadastrada?.tese ?? "Tese cadastrada não encontrada (pode ter sido removida)."}
        </p>
        {teseCadastrada?.fundamentacao && <p className="mt-1 text-xs text-muted">{teseCadastrada.fundamentacao}</p>}
      </li>
    );
  }

  function cadastrarTese() {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarTeseManualAction({
        fichaCasoId,
        titulo: (tese as Extract<TeseEstrategiaCaso, { origem: "sugerida" }>).tese,
        descricao: (tese as Extract<TeseEstrategiaCaso, { origem: "sugerida" }>).fundamentacao,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setCadastrada(true);
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={tese.papel === "principal" ? "blue" : "muted"}>{label}</Badge>
        <Badge tone="amber">Sugerida pela IA</Badge>
      </div>
      <p className="text-sm text-ice-2">{tese.tese}</p>
      <p className="mt-1 text-xs text-muted">{tese.fundamentacao}</p>
      <div className="mt-2.5">
        <Button size="sm" variant="secondary" disabled={isPending || cadastrada} onClick={cadastrarTese}>
          {cadastrada ? "Tese cadastrada" : isPending ? "Cadastrando…" : "Cadastrar como tese do caso"}
        </Button>
        {erro && <p className="mt-1.5 text-xs text-red-400">{erro}</p>}
      </div>
    </li>
  );
}

function jaViroutarefa(titulo: string, tarefasCaso: TarefaCaso[]): boolean {
  const tituloNormalizado = titulo.trim().toLowerCase();
  return tarefasCaso.some((tarefa) => tarefa.titulo.trim().toLowerCase() === tituloNormalizado);
}

function ItemAcionavel({
  fichaCasoId,
  item,
  tarefasCaso,
}: {
  fichaCasoId: string;
  item: ProximoPassoEstrategiaCaso | AcaoRecomendadaEstrategiaCaso;
  tarefasCaso: TarefaCaso[];
}) {
  const [criadaLocal, setCriadaLocal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const jaCriada = criadaLocal || jaViroutarefa(item.titulo, tarefasCaso);

  function criarTarefa() {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarTarefaCasoAction(fichaCasoId, {
        titulo: item.titulo,
        prazoOpcional: item.prazoSugerido,
        responsavelPerfilId: null,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setCriadaLocal(true);
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-ice-2">{item.titulo}</p>
        <Badge tone={PRIORIDADE_TONE[item.prioridade]}>Prioridade {PRIORIDADE_LABEL[item.prioridade]}</Badge>
      </div>
      {item.detalhe && <p className="text-sm text-muted">{item.detalhe}</p>}
      {item.prazoSugerido && (
        <p className="mt-1.5 text-xs text-amber-300">
          Prazo sugerido pela IA: {item.prazoSugerido} — estimativa operacional, nunca um prazo processual formal.
        </p>
      )}
      <OrigemTags origens={item.origem} />
      <div className="mt-2.5">
        <Button size="sm" variant="secondary" disabled={isPending || jaCriada} onClick={criarTarefa}>
          {jaCriada ? "Tarefa criada" : isPending ? "Criando tarefa…" : "Criar tarefa"}
        </Button>
        {erro && <p className="mt-1.5 text-xs text-red-400">{erro}</p>}
      </div>
    </li>
  );
}

export function EstrategiaCasoResultado({
  fichaCasoId,
  resultado,
  tesesCaso,
  tarefasCaso,
}: {
  fichaCasoId: string;
  resultado: ResultadoEstrategiaCaso;
  tesesCaso: TeseCaso[];
  tarefasCaso: TarefaCaso[];
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-silver/30 bg-silver/5 p-4">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-silver-2">Objetivo</h4>
        <p className="whitespace-pre-wrap text-sm text-ice-2">{resultado.objetivo}</p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Teses <span className="text-muted/70">({resultado.teses.length})</span>
        </h4>
        <ul className="space-y-2">
          {resultado.teses.map((tese, indice) => (
            <TeseItem key={indice} fichaCasoId={fichaCasoId} tese={tese} tesesCaso={tesesCaso} />
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Provas <span className="text-muted/70">({resultado.provas.length})</span>
        </h4>
        {resultado.provas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma prova identificada pela IA nesta geração.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.provas.map((prova, indice) => (
              <li key={indice} className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-ice-2">{prova.descricao}</p>
                  <Badge tone={prova.status === "disponivel" ? "green" : "amber"}>
                    {prova.status === "disponivel" ? "Disponível" : "Necessária"}
                  </Badge>
                </div>
                <OrigemTags origens={prova.origem} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Riscos <span className="text-muted/70">({resultado.riscos.length})</span>
        </h4>
        {resultado.riscos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum risco identificado pela IA nesta geração.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.riscos.map((risco, indice) => (
              <li key={indice} className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-ice-2">{risco.descricao}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="muted">{risco.categoria}</Badge>
                    <Badge tone={NIVEL_RISCO_TONE[risco.nivel]}>Risco {NIVEL_RISCO_LABEL[risco.nivel]}</Badge>
                  </div>
                </div>
                <OrigemTags origens={risco.origem} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Oportunidades <span className="text-muted/70">({resultado.oportunidades.length})</span>
        </h4>
        {resultado.oportunidades.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma oportunidade identificada pela IA nesta geração.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.oportunidades.map((oportunidade, indice) => (
              <li key={indice} className="rounded-lg border border-white/10 bg-navy-2 p-3.5">
                <p className="text-sm text-ice-2">{oportunidade.descricao}</p>
                <OrigemTags origens={oportunidade.origem} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Próximos passos <span className="text-muted/70">({resultado.proximosPassos.length})</span>
        </h4>
        {resultado.proximosPassos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum próximo passo operacional sugerido nesta geração.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.proximosPassos.map((item, indice) => (
              <ItemAcionavel key={indice} fichaCasoId={fichaCasoId} item={item} tarefasCaso={tarefasCaso} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Ações recomendadas <span className="text-muted/70">({resultado.acoesRecomendadas.length})</span>
        </h4>
        {resultado.acoesRecomendadas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação estratégica recomendada nesta geração.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.acoesRecomendadas.map((item, indice) => (
              <ItemAcionavel key={indice} fichaCasoId={fichaCasoId} item={item} tarefasCaso={tarefasCaso} />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-amber-300">Ressalvas</h4>
        {resultado.ressalvas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ressalva relevante apontada pela IA sobre o contexto lido.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4">
            {resultado.ressalvas.map((ressalva, indice) => (
              <li key={indice} className="text-sm text-ice-2">
                {ressalva}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
