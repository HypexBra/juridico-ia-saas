"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  listarAnotacoesAction,
  criarAnotacaoAction,
  excluirAnotacaoAction,
} from "@/app/app/chat/anotacoes-actions";
import type { AnotacaoConversa } from "@/lib/types";

/**
 * Painel de anotações colaborativas de equipe numa conversa (ver migration
 * 0054) — comentário interno tipo "usar esse trecho na petição", nunca
 * enviado ao LLM. Isolado do resto do chat-app.tsx de propósito: busca e
 * estado próprios, só recebe `conversaId` — reduz o risco de mexer numa tela
 * já complexa (streaming, histórico, propostas) para uma feature aditiva.
 */
export function AnotacoesConversa({ conversaId }: { conversaId: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [anotacoes, setAnotacoes] = useState<AnotacaoConversa[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir() {
    if (!conversaId) return;
    setAberto(true);
    setCarregando(true);
    setErro(null);
    listarAnotacoesAction(conversaId)
      .then(setAnotacoes)
      .catch(() => setErro("Não foi possível carregar as anotações."))
      .finally(() => setCarregando(false));
  }

  function enviar() {
    if (!conversaId || !texto.trim()) return;
    const textoEnviado = texto.trim();
    startTransition(async () => {
      const resultado = await criarAnotacaoAction(conversaId, textoEnviado);
      if (resultado.ok) {
        setAnotacoes((atual) => [...atual, resultado.anotacao]);
        setTexto("");
        setErro(null);
      } else {
        setErro(resultado.error);
      }
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      const resultado = await excluirAnotacaoAction(id);
      if (resultado.ok) {
        setAnotacoes((atual) => atual.filter((a) => a.id !== id));
      }
    });
  }

  if (!conversaId) return null;

  return (
    <div className="border-b border-ink/10 px-4 py-2">
      <button
        type="button"
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-ice"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Anotações da equipe {anotacoes.length > 0 ? `(${anotacoes.length})` : ""}
      </button>

      {aberto && (
        <div className="mt-2 space-y-2 rounded-lg border border-ink/10 bg-navy-3/40 p-3">
          {carregando ? (
            <p className="text-xs text-muted">Carregando…</p>
          ) : anotacoes.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma anotação ainda — deixe um comentário pra sua equipe.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {anotacoes.map((a) => (
                <li key={a.id} className="rounded-md bg-navy-2/60 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-ice">{a.autor_nome}</span>
                    <button
                      type="button"
                      onClick={() => excluir(a.id)}
                      disabled={isPending}
                      className="shrink-0 text-muted hover:text-red-500 disabled:opacity-50"
                      aria-label="Excluir anotação"
                    >
                      ×
                    </button>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-ice-2">{a.texto}</p>
                </li>
              ))}
            </ul>
          )}

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <div className="flex gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Deixar uma anotação para a equipe…"
              rows={2}
              className="flex-1 text-xs"
            />
            <Button size="sm" onClick={enviar} disabled={isPending || !texto.trim()} type="button">
              Comentar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
