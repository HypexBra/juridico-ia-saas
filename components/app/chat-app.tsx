"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MarkdownLite } from "./markdown-lite";
import { PropostaAcaoCard } from "./proposta-acao-card";
import {
  carregarMensagensAction,
  enviarMensagemAction,
  excluirConversaAction,
  excluirTodasConversasAction,
  type ConversaResumo,
} from "@/app/app/chat/actions";
import type { Mensagem } from "@/lib/types";

type MensagemLocal = Pick<Mensagem, "id" | "role" | "conteudo" | "criado_em"> & {
  proposta_id?: string | null;
  fontes?: Mensagem["fontes"];
};

/** Fontes RAG citadas por uma resposta — clicáveis quando a fonte tem tela de detalhe (ver lib/rag/retrieval.ts#montarFontesCitaveis). */
function FontesCitadas({ fontes }: { fontes: Mensagem["fontes"] | undefined }) {
  if (!fontes || fontes.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {fontes.map((fonte) => {
        const conteudo = (
          <span className="truncate">{fonte.label}</span>
        );
        const classe =
          "inline-flex max-w-[220px] items-center gap-1 rounded-full border border-white/10 bg-navy-3/60 px-2.5 py-1 text-[11px] text-muted transition-colors";

        if (!fonte.href) {
          return (
            <span key={`${fonte.tipo}-${fonte.fonteId}`} className={classe} title={fonte.label}>
              {conteudo}
            </span>
          );
        }

        const externo = fonte.href.startsWith("http");
        return (
          <Link
            key={`${fonte.tipo}-${fonte.fonteId}`}
            href={fonte.href}
            target={externo ? "_blank" : undefined}
            rel={externo ? "noopener noreferrer" : undefined}
            className={`${classe} hover:border-silver/40 hover:text-silver-2`}
            title={fonte.label}
          >
            {conteudo}
          </Link>
        );
      })}
    </div>
  );
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatApp({
  conversasIniciais,
  usoInicial,
  perfilIdAtual,
}: {
  conversasIniciais: ConversaResumo[];
  usoInicial: { usados: number; limite: number };
  perfilIdAtual: string;
}) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [conversaId, setConversaId] = useState<string | null>(conversasIniciais[0]?.id ?? null);
  const [mensagens, setMensagens] = useState<MensagemLocal[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [avisoConversas, setAvisoConversas] = useState<string | null>(null);
  const [uso, setUso] = useState(usoInicial);
  const [isPending, startTransition] = useTransition();
  const [isPendingHistorico, startHistoricoTransition] = useTransition();
  const [isPendingExclusao, startExclusaoTransition] = useTransition();
  const [conversaExcluindo, setConversaExcluindo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversaId) {
      return;
    }
    let cancelado = false;
    startHistoricoTransition(async () => {
      try {
        const data = await carregarMensagensAction(conversaId);
        if (!cancelado) setMensagens(data);
      } catch {
        if (!cancelado) setErro("Não foi possível carregar o histórico desta conversa.");
      }
    });
    return () => {
      cancelado = true;
    };
  }, [conversaId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  const limiteAtingido = uso.usados >= uso.limite;

  function novaConversa() {
    setConversaId(null);
    setMensagens([]);
    setErro(null);
  }

  function excluirConversa(id: string) {
    if (!window.confirm("Excluir esta conversa? Essa ação não pode ser desfeita.")) return;

    setAvisoConversas(null);
    setConversaExcluindo(id);
    startExclusaoTransition(async () => {
      const resultado = await excluirConversaAction(id);
      setConversaExcluindo(null);
      if (!resultado.ok) {
        setAvisoConversas(resultado.error);
        return;
      }

      setConversas((prev) => prev.filter((c) => c.id !== id));
      if (conversaId === id) novaConversa();
      setAvisoConversas("Conversa excluída com sucesso.");
    });
  }

  function excluirTodasConversas() {
    const minhas = conversas.filter((c) => c.criado_por === perfilIdAtual);
    if (minhas.length === 0) return;
    if (
      !window.confirm(
        `Excluir TODAS as suas ${minhas.length} conversa(s)? Essa ação é IRREVERSÍVEL e não pode ser desfeita.`,
      )
    )
      return;

    setAvisoConversas(null);
    startExclusaoTransition(async () => {
      const resultado = await excluirTodasConversasAction();
      if (!resultado.ok) {
        setAvisoConversas(resultado.error);
        return;
      }

      const idsRemovidos = new Set(minhas.map((c) => c.id));
      setConversas((prev) => prev.filter((c) => !idsRemovidos.has(c.id)));
      if (conversaId && idsRemovidos.has(conversaId)) novaConversa();
      setAvisoConversas("Todas as suas conversas foram excluídas.");
    });
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const textoEnviado = texto.trim();
    if (!textoEnviado || isPending || limiteAtingido) return;

    setErro(null);
    const mensagemOtimista: MensagemLocal = {
      id: `local-${Date.now()}`,
      role: "user",
      conteudo: textoEnviado,
      criado_em: new Date().toISOString(),
    };
    setMensagens((prev) => [...prev, mensagemOtimista]);
    setTexto("");

    startTransition(async () => {
      const resultado = await enviarMensagemAction({ conversaId, texto: textoEnviado });
      if (!resultado.ok) {
        setErro(resultado.error);
        setMensagens((prev) => prev.filter((m) => m.id !== mensagemOtimista.id));
        return;
      }

      setUso((prev) => ({ ...prev, usados: resultado.usoMes }));
      setMensagens((prev) => [...prev, resultado.assistente]);

      if (!conversaId) {
        setConversaId(resultado.conversaId);
        setConversas((prev) => [
          {
            id: resultado.conversaId,
            titulo: textoEnviado.slice(0, 60),
            iniciada_em: new Date().toISOString(),
            total_msgs: 2,
            criado_por: perfilIdAtual,
          },
          ...prev,
        ]);
      } else {
        setConversas((prev) =>
          prev.map((c) => (c.id === conversaId ? { ...c, total_msgs: c.total_msgs + 2 } : c)),
        );
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-white/10 bg-navy-2/40 md:flex">
        <div className="border-b border-white/10 p-3">
          <Button size="sm" className="w-full" onClick={novaConversa} type="button">
            + Nova conversa
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversas.length === 0 && (
            <p className="p-2 text-xs text-muted">Nenhuma conversa ainda.</p>
          )}
          {conversas.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                c.id === conversaId ? "bg-silver/15" : "hover:bg-white/5"
              }`}
            >
              <button
                type="button"
                onClick={() => setConversaId(c.id)}
                className={`block min-w-0 flex-1 truncate px-3 py-2 text-left text-sm transition-colors ${
                  c.id === conversaId ? "text-silver-2" : "text-muted group-hover:text-ice"
                }`}
                title={c.titulo ?? "Conversa sem título"}
              >
                {c.titulo ?? "Nova conversa"}
              </button>
              {c.criado_por === perfilIdAtual && (
                <button
                  type="button"
                  onClick={() => excluirConversa(c.id)}
                  disabled={isPendingExclusao && conversaExcluindo === c.id}
                  title="Excluir conversa"
                  aria-label="Excluir conversa"
                  className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                >
                  {isPendingExclusao && conversaExcluindo === c.id ? "…" : "✕"}
                </button>
              )}
            </div>
          ))}
        </div>
        {conversas.some((c) => c.criado_por === perfilIdAtual) && (
          <div className="border-t border-white/10 p-2">
            <button
              type="button"
              onClick={excluirTodasConversas}
              disabled={isPendingExclusao}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            >
              Excluir todas as minhas conversas
            </button>
          </div>
        )}
        {avisoConversas && (
          <div className="border-t border-white/10 px-3 py-2 text-xs text-muted">{avisoConversas}</div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-white/10 bg-navy-2/40">
        {limiteAtingido && (
          <div className="border-b border-red-500/30 bg-red-950/30 px-4 py-2 text-xs text-red-300">
            Limite mensal de {uso.limite} mensagens de IA do plano free atingido.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {isPendingHistorico ? (
            <p className="text-sm text-muted">Carregando conversa…</p>
          ) : mensagens.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-lg text-ice">Como posso ajudar hoje?</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Descreva um caso, peça a minuta de uma peça ou tire uma dúvida jurídica.
              </p>
            </div>
          ) : (
            mensagens.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.role === "user" ? "bg-silver/15 text-ice" : "bg-navy-3/80 text-ice"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <MarkdownLite texto={m.conteudo} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{m.conteudo}</p>
                  )}
                  {m.role === "assistant" && <FontesCitadas fontes={m.fontes} />}
                  <p className="mt-1.5 text-right text-[10px] text-muted">{formatarHora(m.criado_em)}</p>
                </div>
                {m.role === "assistant" && m.proposta_id && <PropostaAcaoCard propostaId={m.proposta_id} />}
              </div>
            ))
          )}
          {isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-navy-3/80 px-4 py-3 text-sm text-muted">Pensando…</div>
            </div>
          )}
        </div>

        {erro && (
          <div className="border-t border-red-500/30 bg-red-950/30 px-4 py-2 text-xs text-red-300">{erro}</div>
        )}

        <form onSubmit={enviar} className="flex items-end gap-3 border-t border-white/10 p-4">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(e);
              }
            }}
            placeholder="Descreva o caso ou peça uma minuta…"
            rows={2}
            className="flex-1"
            disabled={limiteAtingido}
          />
          <Button type="submit" disabled={isPending || !texto.trim() || limiteAtingido}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
