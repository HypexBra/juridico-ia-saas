"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { enviarMensagemEscritorioAction } from "@/app/app/fichas/[id]/mensagens-actions";
import { inserirSemDuplicar, ordenarMensagens } from "@/lib/mensagens-portal/mensagens";
import type { MensagemPortalCliente } from "@/lib/types";

function formatarHorario(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Espelho de `components/portal/chat-caso.tsx` do lado do escritório: mesmo
 * padrão de Realtime + envio, remetente invertido. Vive dentro da tela de
 * detalhe da ficha (`app/app/fichas/[id]/page.tsx`) porque a conversa é
 * escopada 1:1 por ficha (uma ficha tem no máximo um cliente do portal).
 */
export function ChatClienteCard({
  fichaId,
  clientePortalId,
  clienteNome,
  mensagensIniciais,
}: {
  fichaId: string;
  clientePortalId: string;
  clienteNome: string;
  mensagensIniciais: MensagemPortalCliente[];
}) {
  const [mensagens, setMensagens] = useState(() => ordenarMensagens(mensagensIniciais));
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`mensagens-portal-cliente-ficha-${fichaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens_portal_cliente", filter: `ficha_caso_id=eq.${fichaId}` },
        (payload) => {
          setMensagens((atual) => inserirSemDuplicar(atual, payload.new as MensagemPortalCliente));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [fichaId]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensagens.length]);

  function handleEnviar() {
    const texto = conteudo.trim();
    if (!texto) return;

    setErro(null);
    startTransition(async () => {
      const resultado = await enviarMensagemEscritorioAction(fichaId, clientePortalId, texto);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setMensagens((atual) => inserirSemDuplicar(atual, resultado.mensagem));
      setConteudo("");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Conversa com {clienteNome}.</p>

      <div ref={listaRef} className="max-h-80 space-y-2.5 overflow-y-auto rounded-lg border border-white/10 bg-navy p-3">
        {mensagens.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma mensagem ainda. Envie a primeira mensagem para o cliente.</p>
        ) : (
          mensagens.map((mensagem) => (
            <div
              key={mensagem.id}
              className={`flex ${mensagem.remetente === "escritorio" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  mensagem.remetente === "escritorio" ? "bg-silver/20 text-ice" : "bg-navy-3 text-ice-2"
                }`}
              >
                <p className="whitespace-pre-wrap">{mensagem.conteudo}</p>
                <p className="mt-1 text-[10px] text-muted">{formatarHorario(mensagem.criado_em)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      <div className="flex gap-2">
        <Textarea
          rows={2}
          placeholder={`Escreva sua mensagem para ${clienteNome}...`}
          value={conteudo}
          onChange={(event) => setConteudo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleEnviar();
            }
          }}
          disabled={isPending}
        />
        <Button type="button" onClick={handleEnviar} disabled={isPending || conteudo.trim().length === 0}>
          {isPending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
