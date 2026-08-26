import "server-only";

import type { ChatTurno } from "@/lib/ia/provider";

/**
 * Constantes e helpers compartilhados entre o Server Action do chat
 * (`app/app/chat/actions.ts`) e a rota de streaming
 * (`app/api/chat/mensagem/route.ts`) — extraídos para não duplicar regras de
 * janela de histórico/dedup/título em dois lugares.
 */

export const MAX_HISTORICO = 20;
export const MAX_TAMANHO_MENSAGEM = 8000;
// Teto de caracteres por TURNO ANTIGO (tudo exceto a mensagem atual) ao
// montar o histórico enviado ao modelo. Uma peça/minuta gerada pela IA pode
// ter até ~8192 tokens (~30-32k chars) — sem este corte, cada turno
// subsequente da MESMA conversa reenvia essa peça inteira de novo (custo de
// input token crescendo sem limite). O texto completo continua salvo no banco
// e visível na UI — só o que é reenviado como contexto ao modelo é truncado.
export const MAX_CHARS_TURNO_ANTIGO = 900;

// Janela anti-duplicidade: se a última troca user→assistant com o MESMO texto
// aconteceu há menos de 15s (double-click, retry desesperado), devolve a
// resposta já existente em vez de chamar o modelo de novo.
export const JANELA_DEDUP_MS = 15_000;

export function truncarTurnoAntigo(turno: ChatTurno): ChatTurno {
  if (turno.conteudo.length <= MAX_CHARS_TURNO_ANTIGO) return turno;
  return {
    ...turno,
    conteudo: `${turno.conteudo.slice(0, MAX_CHARS_TURNO_ANTIGO)}\n[…turno anterior truncado para economizar tokens; o conteúdo completo continua salvo nesta conversa, só não é reenviado por inteiro ao modelo…]`,
  };
}

export function tituloDoTexto(texto: string) {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo.length > 60 ? `${limpo.slice(0, 60)}…` : limpo;
}

export async function mesRefAtual() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Orcamento TOTAL de caracteres do historico reenviado ao modelo (soma de
 * todos os turnos anteriores, sem contar a mensagem atual).
 *
 * `MAX_CHARS_TURNO_ANTIGO` limita cada turno isoladamente, mas nao a soma:
 * 19 turnos anteriores no teto de 900 chars sao ~17.100 caracteres (~4.500
 * tokens) reenviados a CADA mensagem, crescendo ate esse patamar conforme a
 * conversa avanca. Como o custo de input e pago em toda mensagem, uma
 * conversa longa fica progressivamente mais cara e mais lenta sem que a
 * qualidade da resposta melhore · turnos de 15 mensagens atras quase nunca
 * mudam a resposta atual.
 *
 * 8.000 chars (~2.000 tokens) cobre com folga as ultimas trocas relevantes.
 */
export const ORCAMENTO_CHARS_HISTORICO = 8_000;

/**
 * Recorta o historico de tras para frente (do mais recente para o mais
 * antigo) ate estourar o orcamento. Sempre preserva pelo menos o ULTIMO
 * turno anterior, mesmo que sozinho ja estoure: perder a pergunta/resposta
 * imediatamente anterior quebra qualquer continuidade de conversa, e esse e
 * o unico turno que quase sempre importa.
 *
 * Recebe os turnos ANTERIORES ja em ordem cronologica (antigo -> recente) e
 * devolve na mesma ordem. A mensagem atual nao entra aqui: ela e sempre
 * enviada inteira, nunca truncada por orcamento.
 */
export function recortarHistoricoPorOrcamento(
  anteriores: readonly ChatTurno[],
  orcamentoChars: number = ORCAMENTO_CHARS_HISTORICO,
): ChatTurno[] {
  if (anteriores.length === 0) return [];

  const mantidos: ChatTurno[] = [];
  let total = 0;

  for (let i = anteriores.length - 1; i >= 0; i--) {
    const turno = anteriores[i];
    const custo = turno.conteudo.length;
    if (mantidos.length > 0 && total + custo > orcamentoChars) break;
    mantidos.push(turno);
    total += custo;
  }

  return mantidos.reverse();
}
