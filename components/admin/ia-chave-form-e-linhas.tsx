"use client";

import { useActionState, useState, useTransition } from "react";
import { criarChaveIa, desativarChaveIa, type GestaoChaveResultado } from "@/lib/ia/chaves/gestao-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { ChaveIaAdmin } from "@/lib/ia/chaves/tipos";

const INITIAL_STATE: GestaoChaveResultado | null = null;

export function CriarChaveIaForm() {
  const [state, formAction, isPending] = useActionState(criarChaveIa, INITIAL_STATE);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <div>
        <Label htmlFor="provider">Provedor</Label>
        <Select id="provider" name="provider" required defaultValue="gemini">
          <option value="gemini">Gemini</option>
          <option value="groq">Groq</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required placeholder="Ex: conta principal" />
      </div>
      <div>
        <Label htmlFor="chave">Chave (API key)</Label>
        <Input id="chave" name="chave" type="password" required placeholder="Cole a chave aqui" autoComplete="off" />
      </div>
      <div>
        <Label htmlFor="rpmLimite">Limite RPM</Label>
        <Input id="rpmLimite" name="rpmLimite" type="number" min={1} required placeholder="Ex: 15" />
      </div>
      <div className="sm:col-span-4 flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Cadastrando…" : "Cadastrar chave"}
        </Button>
        {state && (
          <p className={`text-xs ${state.ok ? "text-muted" : "text-danger"}`}>{state.ok ? state.mensagem : state.error}</p>
        )}
      </div>
    </form>
  );
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

const STATUS_LABEL: Record<ChaveIaAdmin["status"], string> = {
  ativa: "Ativa",
  desativada_temporariamente_por_quota: "Em cooldown (quota)",
  desativada_manual: "Desativada",
};

const STATUS_CLASSE: Record<ChaveIaAdmin["status"], string> = {
  ativa: "text-green",
  desativada_temporariamente_por_quota: "text-amber-700",
  desativada_manual: "text-danger",
};

export function ChaveIaLinha({ chave }: { chave: ChaveIaAdmin }) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const ativa = chave.status !== "desativada_manual";

  function alternar() {
    const acao = ativa ? "Desativar" : "Reativar";
    if (!window.confirm(`${acao} a chave "${chave.nome}" (${chave.provider})?`)) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await desativarChaveIa(chave.id, !ativa);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  return (
    <tr>
      <td className="py-3 pr-3 text-ice uppercase text-xs font-medium">{chave.provider}</td>
      <td className="py-3 pr-3 text-ice">{chave.nome}</td>
      <td className="py-3 pr-3 font-mono text-xs text-muted">{chave.chave_preview ?? "—"}</td>
      <td className="py-3 pr-3 text-muted">{chave.rpm_limite}</td>
      <td className="py-3 pr-3 text-muted">
        {chave.contador_requisicoes}/{chave.rpm_limite}
      </td>
      <td className="py-3 pr-3">
        <span className={STATUS_CLASSE[chave.status]}>{STATUS_LABEL[chave.status]}</span>
        {chave.ultima_falha_motivo && (
          <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-muted" title={chave.ultima_falha_motivo}>
            {chave.ultima_falha_motivo}
          </p>
        )}
      </td>
      <td className="py-3 pr-3 text-muted">{formatarData(chave.ultima_utilizada_em)}</td>
      <td className="py-3">
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={alternar}
            className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
              ativa ? "border-danger/30 text-danger hover:bg-danger/10" : "border-green/30 text-green hover:bg-green/10"
            }`}
          >
            {ativa ? "Desativar" : "Reativar"}
          </button>
          {mensagem && <p className="text-[11px] text-muted">{mensagem}</p>}
        </div>
      </td>
    </tr>
  );
}
