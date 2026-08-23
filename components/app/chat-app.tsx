"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";
import { MarkdownLite } from "./markdown-lite";
import { PropostaAcaoCard } from "./proposta-acao-card";
import {
  carregarMensagensAction,
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

// ── Ditado por voz (Fase 15): MediaRecorder → /api/audio/transcrever → TEXTO
// no composer (HITL: revisão + envio manual — nunca submit automático). ──

type EstadoGravacaoAudio = "idle" | "gravando" | "transcrevendo";

/** Timer da gravação em mm:ss. */
function formatarDuracao(totalSegundos: number) {
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

/**
 * Escolhe o melhor mimeType suportado pelo navegador, priorizando webm/opus
 * (Chrome/Firefox) com fallback ogg e mp4 (Safari). `undefined` = deixa o
 * default nativo do MediaRecorder (o backend aceita qualquer audio/*).
 */
function escolherMimeTypeGravacao(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidatos.find((candidato) => MediaRecorder.isTypeSupported(candidato));
}

/** Extensão coerente com o mimeType gravado — o provider infere o container por ela. */
function extensaoDoMimeType(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg") || mimeType.includes("opus")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
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
  const [providerSelecionado, setProviderSelecionado] = useState<"auto" | "gemini" | "groq">("auto");
  const [erro, setErro] = useState<string | null>(null);
  const [avisoConversas, setAvisoConversas] = useState<string | null>(null);
  const [uso, setUso] = useState(usoInicial);
  const [isPending, startTransition] = useTransition();
  const [isPendingHistorico, startHistoricoTransition] = useTransition();
  const [isPendingExclusao, startExclusaoTransition] = useTransition();
  const [conversaExcluindo, setConversaExcluindo] = useState<string | null>(null);
  const [listaMobileAberta, setListaMobileAberta] = useState(false);
  // ── Ditado por voz (Fase 15) ──
  const [estadoAudio, setEstadoAudio] = useState<EstadoGravacaoAudio>("idle");
  const [duracaoGravacaoSeg, setDuracaoGravacaoSeg] = useState(0);
  const [erroAudio, setErroAudio] = useState<string | null>(null);
  const campoComposerRef = useRef<HTMLDivElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosAudioRef = useRef<Blob[]>([]);
  const streamMicrofoneRef = useRef<MediaStream | null>(null);
  const timerDuracaoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const montadoRef = useRef(true);
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

  // ── Ciclo de vida do ditado por voz: solta microfone/timer no unmount. ──
  // O evento "stop" do gravador pode disparar transcreverGravacao depois —
  // montadoRef a faz retornar sem setState (evita fetch/fantasma pós-unmount).
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      pararTimerDuracao();
      const gravador = gravadorRef.current;
      gravadorRef.current = null;
      if (gravador && gravador.state !== "inactive") gravador.stop();
      streamMicrofoneRef.current?.getTracks().forEach((track) => track.stop());
      streamMicrofoneRef.current = null;
    };
  }, []);

  function pararTimerDuracao() {
    if (timerDuracaoRef.current !== null) {
      clearInterval(timerDuracaoRef.current);
      timerDuracaoRef.current = null;
    }
  }

  /** Encerra a captura: para TODAS as tracks (apaga o ícone de mic ativo do SO). */
  function liberarMicrofone() {
    pararTimerDuracao();
    streamMicrofoneRef.current?.getTracks().forEach((track) => track.stop());
    streamMicrofoneRef.current = null;
  }

  /**
   * Pós-gravação: monta o blob, pede transcrição à API e preenche o TEXTAREA
   * com o texto + foco para revisão manual (HITL — NUNCA submete o form).
   */
  async function transcreverGravacao() {
    const pedacos = pedacosAudioRef.current;
    const mimeType = gravadorRef.current?.mimeType ?? "";
    gravadorRef.current = null;
    pedacosAudioRef.current = [];
    liberarMicrofone();

    if (!montadoRef.current) return;

    if (pedacos.length === 0) {
      setEstadoAudio("idle");
      setErroAudio("A gravação ficou vazia. Verifique se o microfone está funcionando e tente novamente.");
      return;
    }

    setEstadoAudio("transcrevendo");
    const blobAudio = new Blob(pedacos, { type: mimeType || "audio/webm" });

    try {
      const formulario = new FormData();
      formulario.append("audio", blobAudio, `ditado.${extensaoDoMimeType(mimeType)}`);
      const resposta = await fetch("/api/audio/transcrever", { method: "POST", body: formulario });

      let corpo: { texto?: unknown; error?: unknown } | null = null;
      try {
        corpo = await resposta.json();
      } catch {
        corpo = null; // resposta sem JSON (proxy/timeout) → mensagem genérica abaixo
      }

      if (!resposta.ok) {
        throw new Error(
          typeof corpo?.error === "string" && corpo.error
            ? corpo.error
            : "Não foi possível transcrever o áudio. Tente novamente.",
        );
      }

      const transcrito = typeof corpo?.texto === "string" ? corpo.texto.trim() : "";
      if (!transcrito) {
        throw new Error("A transcrição veio vazia. Fale um pouco mais perto do microfone e tente de novo.");
      }

      // Anexa ao que já estava digitado em vez de sobrescrever silenciosamente.
      setTexto((anterior) => (anterior.trim() ? `${anterior.trimEnd()} ${transcrito}` : transcrito));
      setErroAudio(null);
      campoComposerRef.current?.querySelector("textarea")?.focus();
    } catch (erroTranscricao) {
      setErroAudio(
        erroTranscricao instanceof Error && erroTranscricao.message
          ? erroTranscricao.message
          : "Não foi possível transcrever o áudio. Tente novamente.",
      );
    } finally {
      if (montadoRef.current) setEstadoAudio("idle");
    }
  }

  function pararGravacao() {
    pararTimerDuracao();
    const gravador = gravadorRef.current;
    if (gravador && gravador.state !== "inactive") {
      gravador.stop(); // dispara evento "stop" → transcreverGravacao()
    } else {
      void transcreverGravacao();
    }
  }

  /** Toggle do microfone: idle → gravando → (stop) → transcrevendo → idle. */
  async function alternarGravacao() {
    if (estadoAudio === "transcrevendo") return;
    if (estadoAudio === "gravando") {
      pararGravacao();
      return;
    }

    setErroAudio(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErroAudio("Este navegador não suporta gravação de áudio. Digite sua mensagem normalmente.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (erroPermissao) {
      const nome = erroPermissao instanceof DOMException ? erroPermissao.name : "";
      if (nome === "NotAllowedError" || nome === "SecurityError") {
        setErroAudio("Permita o acesso ao microfone para ditar.");
      } else if (nome === "NotFoundError" || nome === "OverconstrainedError") {
        setErroAudio("Nenhum microfone foi encontrado neste dispositivo.");
      } else {
        setErroAudio("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
      }
      return;
    }

    streamMicrofoneRef.current = stream;
    pedacosAudioRef.current = [];
    const mimeTypeEscolhido = escolherMimeTypeGravacao();

    let gravador: MediaRecorder;
    try {
      gravador = new MediaRecorder(stream, mimeTypeEscolhido ? { mimeType: mimeTypeEscolhido } : undefined);
    } catch {
      try {
        gravador = new MediaRecorder(stream); // fallback: default nativo do navegador
      } catch {
        liberarMicrofone();
        setErroAudio("Não foi possível iniciar a gravação neste navegador.");
        return;
      }
    }

    gravador.addEventListener("dataavailable", (evento) => {
      if (evento.data.size > 0) pedacosAudioRef.current.push(evento.data);
    });
    gravador.addEventListener("stop", () => {
      void transcreverGravacao();
    });

    gravadorRef.current = gravador;
    gravador.start(); // sem timeslice: um único blob ao parar (ditados curtos)
    setDuracaoGravacaoSeg(0);
    timerDuracaoRef.current = setInterval(
      () => setDuracaoGravacaoSeg((segundos) => segundos + 1),
      1000,
    );
    setEstadoAudio("gravando");
  }

  const limiteAtingido = uso.usados >= uso.limite;

  function novaConversa() {
    setConversaId(null);
    setMensagens([]);
    setErro(null);
    setListaMobileAberta(false);
  }

  function selecionarConversa(id: string) {
    setConversaId(id);
    setListaMobileAberta(false);
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
      // STREAMING via SSE (rota /api/chat/mensagem): a resposta aparece
      // conforme o modelo gera, em vez de esperar a geração inteira em
      // silêncio. O pipeline de negócio (quota, dedup, RAG, propostas,
      // persistência) roda server-side na rota — aqui é só transporte.
      const bolhaAssistenteId = `stream-${Date.now()}`;
      setMensagens((prev) => [
        ...prev,
        { id: bolhaAssistenteId, role: "assistant", conteudo: "", criado_em: new Date().toISOString() },
      ]);

      let conversaResolvida: string | null = null;
      let usoFinal: number | null = null;
      let respostaSalva: MensagemLocal | null = null;
      let falha: string | null = null;

      try {
        const resposta = await fetch("/api/chat/mensagem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversaId,
            texto: textoEnviado,
            provider: providerSelecionado === "auto" ? undefined : providerSelecionado,
          }),
        });

        if (!resposta.ok || !resposta.body) {
          // Erros HTTP (401/400/500) chegam com JSON {"tipo":"error"}.
          let mensagem = "Não foi possível enviar a mensagem.";
          try {
            const corpo = await resposta.json();
            if (corpo?.error) mensagem = corpo.error;
          } catch {
            /* mantém mensagem genérica */
          }
          throw new Error(mensagem);
        }

        const leitor = resposta.body.getReader();
        const decodificador = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          buffer += decodificador.decode(value, { stream: true });
          const partes = buffer.split("\n\n");
          buffer = partes.pop() ?? "";
          for (const parte of partes) {
            const linha = parte.trim();
            if (!linha.startsWith("data:")) continue;
            let evento: {
              tipo: string;
              texto?: string;
              conversaId?: string;
              error?: string;
              mensagem?: MensagemLocal;
              usoMes?: number;
              deduplicada?: boolean;
              interrompida?: boolean;
            };
            try {
              evento = JSON.parse(linha.slice(5).trim());
            } catch {
              continue;
            }

            if (evento.tipo === "meta" && evento.conversaId) {
              conversaResolvida = evento.conversaId;
            } else if (evento.tipo === "delta" && evento.texto) {
              setMensagens((prev) =>
                prev.map((m) =>
                  m.id === bolhaAssistenteId ? { ...m, conteudo: m.conteudo + evento.texto } : m,
                ),
              );
            } else if (evento.tipo === "done") {
              usoFinal = evento.usoMes ?? null;
              if (evento.mensagem) {
                respostaSalva = { ...evento.mensagem };
                // Troca a bolha de streaming pela mensagem persistida.
                setMensagens((prev) =>
                  prev.map((m) => (m.id === bolhaAssistenteId ? { ...m, ...respostaSalva } : m)),
                );
              }
              if (evento.interrompida) {
                setErro("A resposta foi interrompida no meio da geração — o texto parcial foi mantido.");
              }
            } else if (evento.tipo === "error") {
              falha = evento.error ?? "Erro inesperado do servidor.";
            }
          }
        }
      } catch (erroRede) {
        falha =
          erroRede instanceof Error
            ? erroRede.message
            : "Não foi possível enviar a mensagem. Verifique sua conexão.";
      }

      if (falha) {
        setErro(falha);
        // Remove bolhas otimistas (user + assistente parcial sem resposta).
        setMensagens((prev) =>
          prev.filter(
            (m) => m.id !== mensagemOtimista.id && !(m.id === bolhaAssistenteId && !respostaSalva),
          ),
        );
        return;
      }

      if (usoFinal !== null) setUso((prev) => ({ ...prev, usados: usoFinal as number }));

      const conversaFinal = conversaResolvida ?? conversaId;
      if (!conversaId && conversaFinal) {
        setConversaId(conversaFinal);
        setConversas((prev) => [
          {
            id: conversaFinal,
            titulo: textoEnviado.slice(0, 60),
            iniciada_em: new Date().toISOString(),
            total_msgs: 2,
            criado_por: perfilIdAtual,
          },
          ...prev,
        ]);
      } else if (conversaFinal) {
        setConversas((prev) =>
          prev.map((c) => (c.id === conversaFinal ? { ...c, total_msgs: c.total_msgs + 2 } : c)),
        );
      }
    });
  }

  const conversaAtual = conversas.find((c) => c.id === conversaId);

  const listaConversas = (
    <>
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
              onClick={() => selecionarConversa(c.id)}
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
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-white/10 bg-navy-2/40 md:flex">
        {listaConversas}
      </aside>

      {listaMobileAberta && (
        <div
          aria-hidden
          onClick={() => setListaMobileAberta(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col border-r border-white/10 bg-navy-2 shadow-2xl shadow-black/40 transition-transform duration-200 ease-out md:hidden ${
          listaMobileAberta ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
          <span className="text-sm font-medium text-ice">Conversas</span>
          <button
            type="button"
            aria-label="Fechar lista de conversas"
            onClick={() => setListaMobileAberta(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted hover:bg-white/5 hover:text-ice"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M5 5l14 14" />
              <path d="M19 5L5 19" />
            </svg>
          </button>
        </div>
        {listaConversas}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-white/10 bg-navy-2/40">
        <div className="flex items-center gap-2 border-b border-white/10 p-3 md:hidden">
          <button
            type="button"
            onClick={() => setListaMobileAberta(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-navy-3/60 px-3 py-2 text-left text-sm text-ice transition-colors hover:bg-navy-3"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0">
              <path d="M4 6.5h16" />
              <path d="M4 12h16" />
              <path d="M4 17.5h16" />
            </svg>
            <span className="min-w-0 flex-1 truncate">
              {conversaAtual?.titulo ?? "Conversas"}
            </span>
          </button>
          <Button size="sm" variant="secondary" onClick={novaConversa} type="button">
            + Nova
          </Button>
        </div>

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
              <div
                className="flex items-center gap-1.5 rounded-2xl bg-navy-3/80 px-4 py-3"
                role="status"
                aria-label="A IA está digitando"
              >
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
              </div>
            </div>
          )}
        </div>

        {erro && (
          <div className="border-t border-red-500/30 bg-red-950/30 px-4 py-2 text-xs text-red-300">{erro}</div>
        )}

        <form onSubmit={enviar} className="flex flex-col gap-2 border-t border-white/10 p-4">
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="chat-provider-ia" className="text-[11px] uppercase tracking-wide text-muted">
              Modelo
            </label>
            <Select
              id="chat-provider-ia"
              value={providerSelecionado}
              onChange={(e) => setProviderSelecionado(e.target.value as "auto" | "gemini" | "groq")}
              className="w-auto py-1.5 text-xs"
              title="Escolha manualmente o provedor de IA ou deixe em Automático (Gemini com fallback para Groq)."
            >
              <option value="auto">Automático</option>
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <div ref={campoComposerRef} className="min-w-0 flex-1">
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
                disabled={limiteAtingido}
              />
            </div>
            <button
              type="button"
              onClick={() => void alternarGravacao()}
              disabled={estadoAudio === "transcrevendo" || limiteAtingido}
              aria-label={estadoAudio === "gravando" ? "Parar gravação" : "Gravar áudio"}
              aria-pressed={estadoAudio === "gravando"}
              title={
                estadoAudio === "gravando"
                  ? "Parar e transcrever"
                  : estadoAudio === "transcrevendo"
                    ? "Transcrevendo áudio…"
                    : "Ditar mensagem por voz"
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-silver/50 ${
                estadoAudio === "gravando"
                  ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  : "border-white/10 text-muted hover:bg-white/5 hover:text-ice disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              {estadoAudio === "gravando" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="1.5" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
            </button>
            <Button type="submit" disabled={isPending || !texto.trim() || limiteAtingido}>
              Enviar
            </Button>
          </div>
          {/* Status do ditado (timer/transcrição) + erro discreto, sem pular layout. */}
          <div aria-live="polite" className="min-h-[18px] px-1">
            {estadoAudio === "gravando" ? (
              <p className="flex items-center gap-1.5 text-xs tabular-nums text-red-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" aria-hidden />
                Gravando · {formatarDuracao(duracaoGravacaoSeg)}
              </p>
            ) : estadoAudio === "transcrevendo" ? (
              <p className="text-xs text-muted" role="status">
                Transcrevendo…
              </p>
            ) : erroAudio ? (
              <p className="text-xs text-red-300/90">{erroAudio}</p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
