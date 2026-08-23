"use client";

import { useActionState, useState, useTransition } from "react";
import {
  adicionarAdminPorEmailAction,
  alternarAtivoAdminAction,
  removerAdminAction,
  type AdminActionResultado,
} from "@/app/admin/administradores/actions";
import { Button } from "@/components/ui/button";
import type { PlataformaAdmin } from "@/lib/types";

const INITIAL_STATE: AdminActionResultado | null = null;

export function AdicionarAdminForm() {
  const [state, formAction, isPending] = useActionState(adicionarAdminPorEmailAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="email"
        name="email"
        required
        placeholder="E-mail do usuário a promover…"
        className="flex-1 rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice placeholder:text-muted"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adicionando…" : "Adicionar administrador"}
      </Button>
      {state && (
        <p className={`text-xs sm:ml-3 ${state.ok ? "text-muted" : "text-red-700"}`}>{state.ok ? state.mensagem : state.error}</p>
      )}
    </form>
  );
}

export function AdministradorLinha({ admin, souVoce }: { admin: PlataformaAdmin; souVoce: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function alternarAtivo() {
    if (!window.confirm(`${admin.ativo ? "Desativar" : "Ativar"} este administrador?`)) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await alternarAtivoAdminAction(admin.id, !admin.ativo);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  function remover() {
    if (!window.confirm(`Remover ${admin.nome} da lista de administradores da plataforma? Ele perderá acesso ao /admin imediatamente.`)) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await removerAdminAction(admin.id);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  return (
    <tr>
      <td className="py-3 pr-3 text-ice">
        {admin.nome} {souVoce && <span className="text-xs text-muted">(você)</span>}
      </td>
      <td className="py-3 pr-3 text-muted">{admin.email}</td>
      <td className="py-3 pr-3 text-muted">{new Date(admin.criado_em).toLocaleDateString("pt-BR")}</td>
      <td className="py-3 pr-3">
        <span className={admin.ativo ? "text-green" : "text-red-700"}>{admin.ativo ? "Ativo" : "Inativo"}</span>
      </td>
      <td className="py-3">
        <div className="flex flex-col items-end gap-1">
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={alternarAtivo}
              className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
                admin.ativo ? "border-red-700/30 text-red-700 hover:bg-red-700/10" : "border-green/30 text-green hover:bg-green/10"
              }`}
            >
              {admin.ativo ? "Desativar" : "Ativar"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={remover}
              className="rounded-md border border-red-700/30 px-2 py-1 text-xs text-red-700 hover:bg-red-700/10 disabled:opacity-50"
            >
              Remover
            </button>
          </div>
          {mensagem && <p className="text-[11px] text-muted">{mensagem}</p>}
        </div>
      </td>
    </tr>
  );
}
