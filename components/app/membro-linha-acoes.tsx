"use client";

import { useState, useTransition } from "react";
import { alterarRoleMembroAction, alternarAtivoMembroAction } from "@/app/app/equipe/actions";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { owner: "Titular", admin: "Administrador(a)", advogado: "Advogado(a)" };

/**
 * Ações de "admin do escritório" (papel escopado por tenant, `perfis.role`)
 * — distinto do painel /admin (admin da plataforma, cross-tenant). Só
 * renderizado pela página quando quem está logado é owner/admin, e nunca
 * na própria linha do usuário logado (ver `EquipePage`).
 */
export function MembroLinhaAcoes({
  perfilId,
  ativo,
  role,
  podeAlterarRole,
}: {
  perfilId: string;
  ativo: boolean;
  role: Role;
  /** false quando o membro alvo é owner e quem está logado não é owner. */
  podeAlterarRole: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function alterarRole(novoRole: string) {
    if (novoRole === role) return;
    if (!window.confirm(`Alterar o papel deste membro para "${ROLE_LABEL[novoRole as Role]}" dentro do escritório?`)) return;
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const resultado = await alterarRoleMembroAction(perfilId, novoRole);
      if (resultado.ok) setMensagem(resultado.mensagem);
      else setErro(resultado.error);
    });
  }

  function alternarAtivo() {
    const acao = ativo ? "desativar" : "ativar";
    if (!window.confirm(`Tem certeza que deseja ${acao} este membro do escritório?`)) return;
    setMensagem(null);
    setErro(null);
    startTransition(async () => {
      const resultado = await alternarAtivoMembroAction(perfilId, !ativo);
      if (resultado.ok) setMensagem(resultado.mensagem);
      else setErro(resultado.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <select
          value={role}
          disabled={isPending || !podeAlterarRole}
          onChange={(e) => alterarRole(e.target.value)}
          title="Papel deste membro dentro do escritório"
          className="rounded-md border border-ink/10 bg-navy-3 px-2 py-1 text-xs text-ice disabled:opacity-50"
        >
          {Object.entries(ROLE_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || !podeAlterarRole}
          onClick={alternarAtivo}
          className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
            ativo ? "border-danger/30 text-danger hover:bg-danger/10" : "border-green/30 text-green hover:bg-green/10"
          }`}
        >
          {ativo ? "Desativar" : "Ativar"}
        </button>
      </div>
      {erro && <p className="text-[11px] text-danger">{erro}</p>}
      {mensagem && <p className="text-[11px] text-muted">{mensagem}</p>}
    </div>
  );
}
