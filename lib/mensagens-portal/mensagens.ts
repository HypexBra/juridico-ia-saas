import { z } from "zod";
import type { MensagemPortalCliente } from "@/lib/types";

/** Limite alinhado ao mesmo teto usado em `notificarClienteAction` (portal-actions.ts). */
export const CONTEUDO_MENSAGEM_MAX = 2000;

export const enviarMensagemPortalSchema = z.object({
  fichaId: z.string().uuid("Ficha inválida."),
  conteudo: z
    .string()
    .trim()
    .min(1, "Escreva uma mensagem antes de enviar.")
    .max(CONTEUDO_MENSAGEM_MAX, `Mensagem muito longa (máximo de ${CONTEUDO_MENSAGEM_MAX} caracteres).`),
});

export type EnviarMensagemPortalInput = z.infer<typeof enviarMensagemPortalSchema>;

/**
 * Ordena mensagens por horário de envio (mais antiga primeiro — ordem
 * natural de leitura de um chat). Extraída como função pura porque tanto o
 * carregamento inicial (query já ordenada no servidor) quanto a inserção
 * via Realtime no client (que só faz `append` no fim do array, sem garantia
 * de ordem entre múltiplas tabs/latências de rede) precisam da mesma
 * garantia de ordenação antes de renderizar.
 */
export function ordenarMensagens(mensagens: MensagemPortalCliente[]): MensagemPortalCliente[] {
  return [...mensagens].sort((a, b) => {
    const diff = new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
    if (diff !== 0) return diff;
    // Desempate estável quando dois registros têm o mesmo timestamp
    // (mesma transação/granularidade do relógio do banco): usa o id como
    // critério secundário determinístico em vez de deixar ao sabor da
    // ordem de chegada do evento Realtime.
    return a.id.localeCompare(b.id);
  });
}

/**
 * Evita duplicar uma mensagem já presente na lista ao inserir um evento
 * Realtime — pode acontecer quando o próprio remetente já fez um append
 * otimista local e o evento INSERT do Postgres chega logo em seguida
 * ecoando a mesma linha.
 */
export function inserirSemDuplicar(
  mensagens: MensagemPortalCliente[],
  novaMensagem: MensagemPortalCliente,
): MensagemPortalCliente[] {
  if (mensagens.some((mensagem) => mensagem.id === novaMensagem.id)) return mensagens;
  return ordenarMensagens([...mensagens, novaMensagem]);
}

/** Quantidade de mensagens do ESCRITÓRIO ainda não lidas pelo cliente — usada para o badge de "novas" no portal. */
export function contarNaoLidasDoEscritorio(mensagens: MensagemPortalCliente[]): number {
  return mensagens.filter((mensagem) => mensagem.remetente === "escritorio" && !mensagem.lida).length;
}
