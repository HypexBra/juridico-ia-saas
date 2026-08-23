"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PrioridadeTarefaCaso, StatusTarefaCaso, TarefaCaso } from "@/lib/types";
import { compararTarefasPorUrgencia } from "@/lib/casos/tarefas";
import { atualizarPrioridadeTarefaCasoAction } from "./tarefas-actions";
import {
  criarTarefaCasoAction,
  atualizarStatusTarefaCasoAction,
  atribuirResponsavelTarefaCasoAction,
  removerTarefaCasoAction,
} from "./tarefas-actions";

const STATUS_LABEL: Record<StatusTarefaCaso, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const STATUS_TONE: Record<StatusTarefaCaso, "silver" | "blue" | "green"> = {
  pendente: "silver",
  em_andamento: "blue",
  concluida: "green",
};

const STATUS_OPCOES: StatusTarefaCaso[] = ["pendente", "em_andamento", "concluida"];

const PRIORIDADE_LABEL: Record<PrioridadeTarefaCaso, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORIDADE_TONE: Record<PrioridadeTarefaCaso, "red" | "amber" | "silver"> = {
  alta: "red",
  media: "amber",
  baixa: "silver",
};

const PRIORIDADES: PrioridadeTarefaCaso[] = ["alta", "media", "baixa"];

type FiltroStatus = "todas" | StatusTarefaCaso;
type FiltroPrioridade = "todas" | PrioridadeTarefaCaso;

export function TarefasCasoSection({
  fichaCasoId,
  tarefasIniciais,
  membrosEquipe,
}: {
  fichaCasoId: string;
  tarefasIniciais: TarefaCaso[];
  membrosEquipe: { id: string; nome: string }[];
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [titulo, setTitulo] = useState("");
  const [responsavelNovo, setResponsavelNovo] = useState("");
  const [prazoOpcional, setPrazoOpcional] = useState("");
  const [prioridadeNova, setPrioridadeNova] = useState<PrioridadeTarefaCaso>("media");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroPrioridade, setFiltroPrioridade] = useState<FiltroPrioridade>("todas");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function nomeResponsavel(id: string | null): string | null {
    if (!id) return null;
    return membrosEquipe.find((m) => m.id === id)?.nome ?? null;
  }

  function criar() {
    if (!titulo.trim()) {
      setErro("Informe o título da tarefa.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await criarTarefaCasoAction(fichaCasoId, {
        titulo,
        responsavelPerfilId: responsavelNovo || null,
        prazoOpcional: prazoOpcional || null,
        prioridade: prioridadeNova,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setTarefas((atual) => [...atual, resultado.tarefa]);
      setTitulo("");
      setResponsavelNovo("");
      setPrazoOpcional("");
    });
  }

  function alterarStatus(tarefaId: string, novoStatus: StatusTarefaCaso) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarStatusTarefaCasoAction(tarefaId, novoStatus);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, status: novoStatus } : t)));
    });
  }

  function alterarPrioridade(tarefaId: string, novaPrioridade: PrioridadeTarefaCaso) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarPrioridadeTarefaCasoAction(tarefaId, novaPrioridade);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setTarefas((atual) =>
        atual.map((t) => (t.id === tarefaId ? { ...t, prioridade: novaPrioridade } : t)),
      );
    });
  }

  function alterarResponsavel(tarefaId: string, perfilId: string) {
    const valor = perfilId || null;
    setErro(null);
    startTransition(async () => {
      const resultado = await atribuirResponsavelTarefaCasoAction(tarefaId, valor);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setTarefas((atual) =>
        atual.map((t) => (t.id === tarefaId ? { ...t, responsavel_perfil_id: valor } : t)),
      );
    });
  }

  function remover(tarefaId: string) {
    if (!confirm("Remover esta tarefa?")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await removerTarefaCasoAction(tarefaId);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setTarefas((atual) => atual.filter((t) => t.id !== tarefaId));
    });
  }

  // Filtro + ordenação canônica (prioridade desc, prazo próximo primeiro) —
  // a lista reflete "o que fazer primeiro", não a ordem de cadastro.
  const tarefasFiltradas = tarefas
    .filter((t) => (filtroStatus === "todas" ? true : t.status === filtroStatus))
    .filter((t) => (filtroPrioridade === "todas" ? true : (t.prioridade ?? "media") === filtroPrioridade))
    .sort((a, b) => compararTarefasPorUrgencia(a, b));

  return (
    <div className="space-y-4">
      <h3 className="font-display text-base font-semibold text-ice">
        Tarefas do caso ({tarefas.length}
        {filtroStatus !== "todas" || filtroPrioridade !== "todas"
          ? ` · ${tarefasFiltradas.length} no filtro`
          : ""}
        )
      </h3>

      <div className="rounded-lg border border-ink/10 bg-navy/40 p-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Label htmlFor="tarefa-titulo">Título</Label>
            <Input
              id="tarefa-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Protocolar contestação"
            />
          </div>
          <div>
            <Label htmlFor="tarefa-responsavel">Responsável (opcional)</Label>
            <Select
              id="tarefa-responsavel"
              value={responsavelNovo}
              onChange={(e) => setResponsavelNovo(e.target.value)}
            >
              <option value="">Sem responsável</option>
              {membrosEquipe.map((membro) => (
                <option key={membro.id} value={membro.id}>
                  {membro.nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tarefa-prazo">Prazo (opcional)</Label>
            <Input
              id="tarefa-prazo"
              type="date"
              value={prazoOpcional}
              onChange={(e) => setPrazoOpcional(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="tarefa-prioridade">Prioridade</Label>
            <Select
              id="tarefa-prioridade"
              value={prioridadeNova}
              onChange={(e) => setPrioridadeNova(e.target.value as PrioridadeTarefaCaso)}
            >
              {PRIORIDADES.map((prioridade) => (
                <option key={prioridade} value={prioridade}>
                  {PRIORIDADE_LABEL[prioridade]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <FieldError>{erro}</FieldError>

        <div className="mt-4">
          <Button size="sm" onClick={criar} disabled={isPending}>
            {isPending ? "Salvando…" : "+ Adicionar tarefa"}
          </Button>
        </div>
      </div>

      {tarefas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros de tarefas">
          <span className="text-xs text-muted">Filtrar:</span>
          <Select
            aria-label="Filtrar por status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="w-auto py-1.5 text-xs"
          >
            <option value="todas">Todos os status</option>
            {STATUS_OPCOES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por prioridade"
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value as FiltroPrioridade)}
            className="w-auto py-1.5 text-xs"
          >
            <option value="todas">Todas as prioridades</option>
            {PRIORIDADES.map((prioridade) => (
              <option key={prioridade} value={prioridade}>
                {PRIORIDADE_LABEL[prioridade]}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {tarefasFiltradas.length === 0 ? (
        <p className="text-sm text-muted">
          {tarefas.length === 0
            ? "Nenhuma tarefa cadastrada ainda. Use o formulário acima para criar o checklist operacional do caso."
            : "Nenhuma tarefa corresponde aos filtros selecionados."}
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {tarefasFiltradas.map((tarefa) => (
            <li key={tarefa.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`text-sm font-medium ${
                      tarefa.status === "concluida" ? "text-muted line-through" : "text-ice"
                    }`}
                  >
                    {tarefa.titulo}
                  </p>
                  <Badge tone={STATUS_TONE[tarefa.status]}>{STATUS_LABEL[tarefa.status]}</Badge>
                  <Badge tone={PRIORIDADE_TONE[tarefa.prioridade ?? "media"]}>
                    {PRIORIDADE_LABEL[tarefa.prioridade ?? "media"]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {nomeResponsavel(tarefa.responsavel_perfil_id)
                    ? `Responsável: ${nomeResponsavel(tarefa.responsavel_perfil_id)}`
                    : "Sem responsável"}
                  {tarefa.prazo_opcional
                    ? ` · Prazo: ${new Date(`${tarefa.prazo_opcional}T00:00:00`).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Status da tarefa"
                  value={tarefa.status}
                  disabled={isPending}
                  onChange={(e) => alterarStatus(tarefa.id, e.target.value as StatusTarefaCaso)}
                  className="w-auto py-1.5 text-xs"
                >
                  {STATUS_OPCOES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Prioridade da tarefa"
                  value={tarefa.prioridade ?? "media"}
                  disabled={isPending}
                  onChange={(e) => alterarPrioridade(tarefa.id, e.target.value as PrioridadeTarefaCaso)}
                  className="w-auto py-1.5 text-xs"
                >
                  {PRIORIDADES.map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {PRIORIDADE_LABEL[prioridade]}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Responsável da tarefa"
                  value={tarefa.responsavel_perfil_id ?? ""}
                  disabled={isPending}
                  onChange={(e) => alterarResponsavel(tarefa.id, e.target.value)}
                  className="w-auto py-1.5 text-xs"
                >
                  <option value="">Sem responsável</option>
                  {membrosEquipe.map((membro) => (
                    <option key={membro.id} value={membro.id}>
                      {membro.nome}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remover(tarefa.id)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
