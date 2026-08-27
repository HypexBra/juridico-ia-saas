"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { RÓTULO_TIPO_PECA, TIPOS_PECA, type TipoPeca } from "@/lib/pecas/tipos";

/** Eventos SSE emitidos por `app/api/pecas/gerar/route.ts` (ver doc do arquivo). */
type EventoStreamPeca =
  | { tipo: "delta"; texto: string }
  | { tipo: "done"; conteudoGerado: string; modeloIaUsado: string }
  | { tipo: "error"; error: string };

/**
 * "Redação assistida (Pro)": evolução do mail-merge de `GerarPeticaoCard`
 * (petição por modelo, plano free) — aqui a IA REDIGE a minuta completa da
 * peça a partir dos fatos da ficha, sem exigir um modelo cadastrado.
 * Gate de plano acontece no servidor (rota SSE `/api/pecas/gerar`, ver
 * app/api/pecas/gerar/route.ts); quando o escritório é free, mostra o mesmo
 * padrão de upsell da seção premium de `/app/relatorios`.
 */
export function RedacaoAssistidaCard({ fichaId, temAcesso }: { fichaId: string; temAcesso: boolean }) {
  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("peticao_inicial");
  const [instrucoesExtras, setInstrucoesExtras] = useState("");
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [conteudoGerado, setConteudoGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (!temAcesso) {
    return (
      <Card>
        <CardTitle className="mb-1">Redação assistida de peças completas</CardTitle>
        <p className="text-sm text-muted">
          Gerar uma minuta completa (petição inicial, contestação, recurso ou parecer) redigida pela IA a partir
          dos fatos do caso é uma feature do <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
          <a href="/app/perfil" className="text-ice underline underline-offset-2">
            Meu perfil
          </a>{" "}
          para liberar.
        </p>
      </Card>
    );
  }

  function gerar() {
    setErro(null);
    setCopiado(false);
    setConteudoGerado(null);

    startTransition(async () => {
      // STREAMING via SSE (rota /api/pecas/gerar) — mesmo transporte do
      // chat (app/api/chat/mensagem/route.ts): a minuta aparece conforme a
      // IA gera, em vez do usuário ver "Gerando peça completa…" parado por
      // 15-40s (peças roteiam para o modelo com teto de saída maior).
      let textoAcumulado = "";
      let falha: string | null = null;
      let concluida = false;

      try {
        const resposta = await fetch("/api/pecas/gerar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fichaId, tipoPeca, instrucoesExtras }),
        });

        if (!resposta.ok || !resposta.body) {
          let mensagem = "Não foi possível gerar a peça.";
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
            let evento: EventoStreamPeca;
            try {
              evento = JSON.parse(linha.slice(5).trim());
            } catch {
              continue;
            }

            if (evento.tipo === "delta") {
              textoAcumulado += evento.texto;
              setConteudoGerado(textoAcumulado);
            } else if (evento.tipo === "done") {
              concluida = true;
              textoAcumulado = evento.conteudoGerado;
              setConteudoGerado(evento.conteudoGerado);
            } else if (evento.tipo === "error") {
              falha = evento.error;
            }
          }
        }
      } catch (erroRede) {
        falha =
          erroRede instanceof Error
            ? erroRede.message
            : "Não foi possível gerar a peça. Verifique sua conexão.";
      }

      // Erro reportado pelo servidor (antes ou durante o stream) OU conexão
      // que caiu sem nunca emitir "done": nunca deixa a UI travada em
      // "gerando" para sempre nem finge que uma peça incompleta é o
      // resultado final — remove o texto parcial e mostra o erro.
      if (falha || !concluida) {
        setErro(falha ?? "A geração foi interrompida antes de concluir a peça. Tente novamente.");
        setConteudoGerado(null);
      }
    });
  }

  async function copiar() {
    if (!conteudoGerado) return;
    try {
      await navigator.clipboard.writeText(conteudoGerado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  function baixar() {
    if (!conteudoGerado) return;
    const blob = new Blob([conteudoGerado], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${RÓTULO_TIPO_PECA[tipoPeca].toLowerCase().replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Redação assistida de peças completas</CardTitle>
        <span className="rounded-full border border-ink/10 bg-ink/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-silver-2">
          Pro
        </span>
      </div>

      <p className="mb-4 text-sm text-muted">
        A IA redige uma minuta completa a partir dos fatos desta ficha — revise sempre antes de protocolar.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="tipo-peca">Tipo de peça</Label>
          <Select
            id="tipo-peca"
            value={tipoPeca}
            onChange={(e) => setTipoPeca(e.target.value as TipoPeca)}
            disabled={isPending}
          >
            {TIPOS_PECA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {RÓTULO_TIPO_PECA[tipo]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="instrucoes-extras">Instruções extras (opcional)</Label>
          <Textarea
            id="instrucoes-extras"
            rows={3}
            placeholder="Ex: focar em dano moral, pedir tutela de urgência, mencionar recidiva..."
            value={instrucoesExtras}
            onChange={(e) => setInstrucoesExtras(e.target.value)}
            disabled={isPending}
          />
        </div>

        <Button onClick={gerar} disabled={isPending} size="sm">
          {isPending ? "Gerando peça completa…" : "Gerar peça completa"}
        </Button>

        <FieldError>{erro}</FieldError>

        {conteudoGerado && (
          <div className="space-y-3">
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-ink/10 bg-navy-2 p-4 text-sm leading-relaxed text-ice-2">
              {conteudoGerado}
              {isPending && <span className="animate-pulse text-muted">▍</span>}
            </pre>

            {/* Ações só liberadas depois do stream concluir (evita copiar/baixar peça pela metade). */}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={copiar} disabled={isPending}>
                {copiado ? "Copiado!" : "Copiar texto"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={baixar} disabled={isPending}>
                Baixar (.txt)
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
