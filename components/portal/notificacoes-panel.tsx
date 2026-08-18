"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { marcarNotificacaoLidaAction, marcarTodasNotificacoesLidasAction } from "@/app/portal/actions";
import type { NotificacaoCliente } from "@/lib/types";

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificacoesPanel({ notificacoes }: { notificacoes: NotificacaoCliente[] }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const temNaoLidas = notificacoes.some((notificacao) => !notificacao.lida);

  if (notificacoes.length === 0) {
    return <p className="text-sm text-muted">Você ainda não recebeu nenhuma notificação sobre o seu caso.</p>;
  }

  return (
    <div className="space-y-3">
      {temNaoLidas && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setErro(null);
              startTransition(async () => {
                const resultado = await marcarTodasNotificacoesLidasAction();
                if (!resultado.ok) setErro(resultado.error);
              });
            }}
          >
            Marcar todas como lidas
          </Button>
        </div>
      )}

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      <ul>
        {notificacoes.map((notificacao) => (
          <li
            key={notificacao.id}
            className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border-b border-white/5 px-2 py-3 last:border-0 ${
              notificacao.lida ? "" : "bg-gold/5"
            }`}
          >
            <div className="min-w-0">
              <p className={`text-sm ${notificacao.lida ? "text-muted" : "font-medium text-ice"}`}>
                {notificacao.mensagem}
              </p>
              <p className="mt-1 text-xs text-muted">{formatarDataHora(notificacao.criado_em)}</p>
            </div>
            {!notificacao.lida && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setErro(null);
                  startTransition(async () => {
                    const resultado = await marcarNotificacaoLidaAction(notificacao.id);
                    if (!resultado.ok) setErro(resultado.error);
                  });
                }}
                className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
              >
                Marcar como lida
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
