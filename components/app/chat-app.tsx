"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MarkdownLite } from "./markdown-lite";
import {
  carregarMensagensAction,
  enviarMensagemAction,
  type ConversaResumo,
} from "@/app/app/chat/actions";
import type { Mensagem } from "@/lib/types";

type MensagemLocal = Pick<Mensagem, "id" | "role" | "conteudo" | "criado_em">;

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatApp({
  conversasIniciais,
  usoInicial,
}: {
  conversasIniciais: ConversaResumo[];
  usoInicial: { usados: number; limite: number };
}) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [conversaId, setConversaId] = useState<string | null>(conversasIniciais[0]?.id ?? null);
  const [mensagens, setMensagens] = useState<MensagemLocal[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [uso, setUso] = useState(usoInicial);
  const [isPending, startTransition] = useTransition();
  const [isPendingHistorico, startHistoricoTransition] = useTransition();
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
            <button
              key={c.id}
              type="button"
              onClick={() => setConversaId(c.id)}
              className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                c.id === conversaId ? "bg-gold/15 text-gold-2" : "text-muted hover:bg-white/5 hover:text-ice"
              }`}
              title={c.titulo ?? "Conversa sem título"}
            >
              {c.titulo ?? "Nova conversa"}
            </button>
          ))}
        </div>
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
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.role === "user" ? "bg-gold/15 text-ice" : "bg-navy-3/80 text-ice"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <MarkdownLite texto={m.conteudo} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{m.conteudo}</p>
                  )}
                  <p className="mt-1.5 text-right text-[10px] text-muted">{formatarHora(m.criado_em)}</p>
                </div>
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
