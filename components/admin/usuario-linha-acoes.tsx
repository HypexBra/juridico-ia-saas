"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  alternarAtivoUsuarioAction,
  alterarRoleUsuarioAction,
  excluirUsuarioAction,
  promoverAdminPlataformaAction,
} from "@/app/admin/usuarios/actions";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { owner: "Titular", admin: "Administrador(a)", advogado: "Advogado(a)" };

export function UsuarioLinhaAcoes({
  perfilId,
  ativo,
  role,
  isAdminPlataforma,
}: {
  perfilId: string;
  ativo: boolean;
  role: Role;
  isAdminPlataforma: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function alternarAtivo() {
    const acao = ativo ? "desativar" : "ativar";
    if (!window.confirm(`Tem certeza que deseja ${acao} este usuário?`)) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await alternarAtivoUsuarioAction(perfilId, !ativo);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  function alterarRole(novoRole: string) {
    if (novoRole === role) return;
    if (!window.confirm(`Alterar o tipo deste usuário para "${ROLE_LABEL[novoRole as Role]}"?`)) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await alterarRoleUsuarioAction(perfilId, novoRole);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  function promoverAdmin() {
    if (!window.confirm("Promover este usuário a ADMINISTRADOR DA PLATAFORMA? Ele passará a ter acesso total ao painel /admin.")) return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await promoverAdminPlataformaAction(perfilId);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  function excluir() {
    if (
      !window.confirm(
        "Esta ação excluirá permanentemente o usuário e os dados associados. Deseja continuar?",
      )
    )
      return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await excluirUsuarioAction(perfilId);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <Link href={`/admin/usuarios/${perfilId}`} className="rounded-md border border-white/10 px-2 py-1 text-xs text-muted hover:text-ice">
          Ver
        </Link>
        <select
          value={role}
          disabled={isPending}
          onChange={(e) => alterarRole(e.target.value)}
          className="rounded-md border border-white/10 bg-navy-3 px-2 py-1 text-xs text-ice disabled:opacity-50"
        >
          {Object.entries(ROLE_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          onClick={alternarAtivo}
          className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
            ativo ? "border-red-500/30 text-red-300 hover:bg-red-500/10" : "border-green/30 text-green hover:bg-green/10"
          }`}
        >
          {ativo ? "Desativar" : "Ativar"}
        </button>
        {!isAdminPlataforma && (
          <button
            type="button"
            disabled={isPending}
            onClick={promoverAdmin}
            className="rounded-md border border-amber-500/30 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Promover a admin
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={excluir}
          className="rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
      {mensagem && <p className="text-[11px] text-muted">{mensagem}</p>}
    </div>
  );
}
