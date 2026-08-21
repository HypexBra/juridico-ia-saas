import "server-only";

import type { Part } from "@google/genai";
import { gerarRespostaEstruturada } from "../ia/chamada-estruturada";
import { mensagemErroIaParaUsuario } from "../ia/erros";
import {
  extrairTextoDeDocx,
  extrairTextoDePdfPorPagina,
  truncarTextoExtraido,
  type PaginaTextoExtraido,
} from "../analise-processo/extracao";
import {
  AUDITOR_PECA_RESPONSE_SCHEMA,
  AUDITOR_PECA_SYSTEM_PROMPT,
  montarPromptAuditoriaPeca,
  parsearRespostaAuditoriaPeca,
} from "./prompt";
import type { ResultadoAuditoriaPeca } from "./tipos";

export const TIPOS_ARQUIVO_AUDITORIA_PECA = ["pdf", "docx", "imagem"] as const;
export type TipoArquivoAuditoriaPeca = (typeof TIPOS_ARQUIVO_AUDITORIA_PECA)[number];

/** Teto de caracteres do texto colado direto pelo usuário (ADR 0012, seção
 * 7) — maior que o do redline (`TAMANHO_MAXIMO_CONTRATO = 40_000`) porque
 * peças processuais (recursos, contestações com preliminares e mérito)
 * tendem a ser mais longas que contratos comerciais típicos. Upload usa o
 * teto já existente de `lib/analise-processo/extracao.ts`
 * (`TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO`), sem duplicar constante. */
export const TAMANHO_MAXIMO_PECA_AUDITORIA = 60_000;

/**
 * Modelo isolado desta feature — mesmo racional de
 * `lib/analise-documento/analisar.ts` (ADR 0011, seção 6/ADR 0012): não
 * reaproveita as constantes de `lib/ia/gemini.ts` (chat) para não acoplar o
 * teto de tokens/retry do chat a esta auditoria. "gemini-flash-latest" é o
 * mesmo alias usado nas outras features Gemini deste projeto (nomes fixos de
 * modelo já causaram indisponibilidade no passado — ver
 * `.agents/memoria/erros-corrigidos.md`).
 */
const MODELO_AUDITORIA_PECA = "gemini-flash-latest";
const MODELO_FALLBACK_QUOTA_AUDITORIA_PECA = "gemini-flash-lite-latest";

export const MAX_OUTPUT_TOKENS_AUDITORIA_PECA = 8192;
export const THINKING_BUDGET_AUDITORIA_PECA = 1024;

const MIME_TYPE_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function inferirMimeTypeImagem(nomeArquivo: string): string {
  const extensao = nomeArquivo.toLowerCase().split(".").pop() ?? "";
  return MIME_TYPE_POR_EXTENSAO[extensao] ?? "image/jpeg";
}

/**
 * União discriminada da entrada (ADR 0012, seção 2): texto colado direto OU
 * upload de arquivo — um único caminho de código, sem duplicar a chamada de
 * IA/parse entre os dois modos (a bifurcação existe só até o ponto de
 * obtenção do texto final enviado ao Gemini).
 */
export type ParametrosAuditarPeca =
  | { origem: "colado"; titulo: string | null; texto: string }
  | { origem: "upload"; titulo: string | null; buffer: Buffer; tipoArquivo: TipoArquivoAuditoriaPeca; nomeArquivo: string };

export type ResultadoAuditarPeca =
  | { ok: true; resultado: ResultadoAuditoriaPeca; modeloIaUsado: string }
  | { ok: false; erro: string };

/**
 * Função principal do Auditor de Peças (ADR 0012, Onda 1). Espelha
 * `lib/analise-documento/analisar.ts#analisarDocumento`: decide o caminho de
 * obtenção do texto por `origem`/`tipoArquivo`, monta o prompt final (texto
 * colado, texto extraído por página, ou imagem inline), chama o Gemini via
 * `gerarRespostaEstruturada` com `AUDITOR_PECA_RESPONSE_SCHEMA` e parseia a
 * resposta de forma fail-closed. NUNCA lança exceção não tratada — todo erro
 * (extração, chamada de IA, parse) volta como `{ ok: false, erro }` para o
 * caller (Onda 2) decidir como persistir/exibir.
 */
export async function auditarPeca(parametros: ParametrosAuditarPeca): Promise<ResultadoAuditarPeca> {
  try {
    let promptTexto: string;
    let parteExtra: Part | null = null;

    if (parametros.origem === "colado") {
      promptTexto = montarPromptAuditoriaPeca({ tipo: "colado", titulo: parametros.titulo, texto: parametros.texto });
    } else if (parametros.tipoArquivo === "imagem") {
      promptTexto = montarPromptAuditoriaPeca({
        tipo: "imagem",
        titulo: parametros.titulo,
        nomeArquivo: parametros.nomeArquivo,
      });
      parteExtra = {
        inlineData: {
          mimeType: inferirMimeTypeImagem(parametros.nomeArquivo),
          data: parametros.buffer.toString("base64"),
        },
      };
    } else {
      let paginasExtraidas: PaginaTextoExtraido[];
      try {
        paginasExtraidas =
          parametros.tipoArquivo === "pdf"
            ? await extrairTextoDePdfPorPagina(new Uint8Array(parametros.buffer))
            : await extrairTextoDeDocx(parametros.buffer);
      } catch (erroExtracao) {
        return {
          ok: false,
          erro: erroExtracao instanceof Error ? erroExtracao.message : "Falha ao extrair texto da peça.",
        };
      }

      const { paginas, truncado } = truncarTextoExtraido(paginasExtraidas);
      promptTexto = montarPromptAuditoriaPeca({
        tipo: "extraido",
        titulo: parametros.titulo,
        nomeArquivo: parametros.nomeArquivo,
        paginas,
        truncado,
      });
    }

    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto,
      parteExtra,
      systemPrompt: AUDITOR_PECA_SYSTEM_PROMPT,
      responseSchema: AUDITOR_PECA_RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS_AUDITORIA_PECA,
      thinkingBudget: THINKING_BUDGET_AUDITORIA_PECA,
      cadeiaModelos: [MODELO_AUDITORIA_PECA, MODELO_FALLBACK_QUOTA_AUDITORIA_PECA],
      logPrefixo: "[auditoria-peca/auditar]",
    });

    const resultado = parsearRespostaAuditoriaPeca(jsonBruto);

    if (!resultado) {
      return {
        ok: false,
        erro: "A IA devolveu uma resposta em formato inesperado. Tente novamente ou reenvie a peça.",
      };
    }

    return { ok: true, resultado, modeloIaUsado: MODELO_AUDITORIA_PECA };
  } catch (erro) {
    console.error("[auditoria-peca/auditar] Falha ao auditar peça:", erro);
    return { ok: false, erro: mensagemErroIaParaUsuario(erro) };
  }
}
