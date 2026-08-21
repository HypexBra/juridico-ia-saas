"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  alternarAtivoUsuarioAction,
  alterarRoleUsuarioAction,
  alterarPlanoEscritorioAction,
  excluirUsuarioAction,
  promoverAdminPlataformaAction,
  redefinirSenhaUsuarioAction,
} from "@/app/admin/usuarios/actions";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { owner: "Titular", admin: "Administrador(a)", advogado: "Advogado(a)" };
const PLANO_LABEL: Record<"free" | "pro", string> = { free: "Free", pro: "Pro" };

export function UsuarioLinhaAcoes({
  perfilId,
  ativo,
  role,
  isAdminPlataforma,
  escritorioId,
  plano,
}: {
  perfilId: string;
  ativo: boolean;
  role: Role;
  isAdminPlataforma: boolean;
  escritorioId: string;
  plano: "free" | "pro";
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
    if (
      !window.confirm(
        "Promover este usuário a ADMINISTRADOR DA PLATAFORMA (nós, operadores do SaaS)? " +
          "Isso é DIFERENTE do campo \"Tipo\" acima (que é o papel dele dentro do PRÓPRIO escritório). " +
          "Um admin da plataforma passa a ver e gerenciar TODOS os escritórios pelo painel /admin — " +
          "não use isto para tornar alguém \"admin do escritório dele\": para isso, altere o campo \"Tipo\" para " +
          "Administrador(a) ou peça para o titular do escritório fazer isso em Equipe.",
      )
    )
      return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await promoverAdminPlataformaAction(perfilId);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  function alterarPlano(novoPlano: string) {
    if (novoPlano === plano) return;
    if (
      !window.confirm(
        `Alterar o plano deste escritório para "${PLANO_LABEL[novoPlano as "free" | "pro"]}"? Isso muda o acesso a todas as features premium do escritório imediatamente.`,
      )
    )
      return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await alterarPlanoEscritorioAction(escritorioId, novoPlano);
      setMensagem(resultado.ok ? resultado.mensagem : resultado.error);
    });
  }

  function redefinirSenha() {
    if (
      !window.confirm(
        "Enviar e-mail de redefinição de senha para este usuário? Ele receberá um link do Supabase para escolher uma nova senha.",
      )
    )
      return;
    setMensagem(null);
    startTransition(async () => {
      const resultado = await redefinirSenhaUsuarioAction(perfilId);
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
        <span className="flex items-center gap-1 text-[11px] text-muted" title="Papel do usuário dentro do PRÓPRIO escritório (owner/admin/advogado) — não confundir com admin da plataforma.">
          Tipo (escritório):
        </span>
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
        <span className="flex items-center gap-1 text-[11px] text-muted" title="Plano do escritório — controla o acesso às features premium (lib/planos/gating.ts).">
          Plano:
        </span>
        <select
          value={plano}
          disabled={isPending}
          onChange={(e) => alterarPlano(e.target.value)}
          className="rounded-md border border-white/10 bg-navy-3 px-2 py-1 text-xs text-ice disabled:opacity-50"
        >
          {Object.entries(PLANO_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending}
          onClick={redefinirSenha}
          className="rounded-md border border-white/10 px-2 py-1 text-xs text-muted hover:text-ice disabled:opacity-50"
        >
          Redefinir senha
        </button>
        {!isAdminPlataforma && (
          <button
            type="button"
            disabled={isPending}
            onClick={promoverAdmin}
            title="Dá acesso cross-tenant ao painel /admin (todos os escritórios) — diferente do campo Tipo."
            className="rounded-md border border-amber-500/30 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Promover a admin da PLATAFORMA
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
