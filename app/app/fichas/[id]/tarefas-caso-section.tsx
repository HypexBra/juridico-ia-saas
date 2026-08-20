"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { StatusTarefaCaso, TarefaCaso } from "@/lib/types";
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

  return (
    <div className="space-y-4">
      <h3 className="font-display text-base font-semibold text-ice">Tarefas do caso ({tarefas.length})</h3>

      <div className="rounded-lg border border-white/10 bg-navy/40 p-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
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
        </div>

        <FieldError>{erro}</FieldError>

        <div className="mt-4">
          <Button size="sm" onClick={criar} disabled={isPending}>
            {isPending ? "Salvando…" : "+ Adicionar tarefa"}
          </Button>
        </div>
      </div>

      {tarefas.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma tarefa cadastrada ainda. Use o formulário acima para criar o checklist operacional do caso.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {tarefas.map((tarefa) => (
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
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
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
