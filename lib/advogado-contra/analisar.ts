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
  ADVOGADO_CONTRA_RESPONSE_SCHEMA,
  ADVOGADO_CONTRA_SYSTEM_PROMPT,
  montarPromptAdvogadoContra,
  parsearRespostaAdvogadoContra,
} from "./prompt";
import type { ResultadoAdvogadoContra } from "./tipos";

export const TIPOS_ARQUIVO_ADVOGADO_CONTRA = ["pdf", "docx", "imagem"] as const;
export type TipoArquivoAdvogadoContra = (typeof TIPOS_ARQUIVO_ADVOGADO_CONTRA)[number];

/** Teto de caracteres do texto colado direto pelo usuário — mesmo valor do
 * Auditor de Peças (`TAMANHO_MAXIMO_PECA_AUDITORIA`). O modo
 * `tese_cadastrada` não precisa desse teto: `teses_caso.tese`/
 * `teses_caso.fundamentacao` já vêm validados pela Fase 1. */
export const TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA = 60_000;

/**
 * Modelo isolado desta feature — mesmo racional de
 * `lib/auditoria-peca/auditar.ts`: não reaproveita as constantes de
 * `lib/ia/gemini.ts` (chat) para não acoplar o teto de tokens/retry do chat a
 * esta análise. "gemini-flash-latest" é o mesmo alias usado nas outras
 * features Gemini deste projeto (nomes fixos de modelo já causaram
 * indisponibilidade no passado — ver `.agents/memoria/erros-corrigidos.md`).
 */
const MODELO_ADVOGADO_CONTRA = "gemini-flash-latest";
const MODELO_FALLBACK_QUOTA_ADVOGADO_CONTRA = "gemini-flash-lite-latest";

export const MAX_OUTPUT_TOKENS_ADVOGADO_CONTRA = 8192;
export const THINKING_BUDGET_ADVOGADO_CONTRA = 1024;

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
 * União discriminada da entrada (mesmo padrão de
 * `lib/auditoria-peca/auditar.ts`, mais um 3º modo NOVO — `tese_cadastrada`,
 * sem upload/extração nenhuma, o texto do prompt é montado direto a partir
 * de `teses_caso.tese`/`teses_caso.fundamentacao`, Fase 1).
 */
type OrigemAdvogadoContra =
  | { origem: "colado"; titulo: string | null; texto: string }
  | {
      origem: "upload";
      titulo: string | null;
      buffer: Buffer;
      tipoArquivo: TipoArquivoAdvogadoContra;
      nomeArquivo: string;
    }
  | { origem: "tese_cadastrada"; tese: string; fundamentacao: string | null };

/**
 * `contextoJuridico`: bloco de jurisprudência recuperada do RAG, já
 * delimitado e marcado como NÃO CONFIÁVEL por
 * `lib/rag/contexto-juridico.ts#buscarContextoJurisprudencia`. Opcional de
 * propósito: `null`/ausente é o comportamento anterior (análise só com o
 * conhecimento do modelo), e é o que acontece quando a base não tem nada
 * relevante · nunca se inventa contexto para preencher o campo.
 */
export type ParametrosAnalisarComoAdvogadoContra = OrigemAdvogadoContra & {
  contextoJuridico?: string | null;
};

export type ResultadoAnalisarComoAdvogadoContra =
  | { ok: true; resultado: ResultadoAdvogadoContra; modeloIaUsado: string }
  | { ok: false; erro: string };

/**
 * Função principal do Advogado do Contra (ADR 0013, Onda 1). Espelha
 * `lib/auditoria-peca/auditar.ts#auditarPeca`: decide o caminho de obtenção
 * do texto por `origem`/`tipoArquivo`, monta o prompt final (texto colado,
 * texto extraído por página, imagem inline, ou tese cadastrada), chama o
 * Gemini via `gerarRespostaEstruturada` com `ADVOGADO_CONTRA_RESPONSE_SCHEMA`
 * e parseia a resposta de forma fail-closed. NUNCA lança exceção não
 * tratada — todo erro (extração, chamada de IA, parse) volta como
 * `{ ok: false, erro }` para o caller (Onda 2) decidir como
 * persistir/exibir.
 */
export async function analisarComoAdvogadoContra(
  parametros: ParametrosAnalisarComoAdvogadoContra,
): Promise<ResultadoAnalisarComoAdvogadoContra> {
  try {
    let promptTexto: string;
    let parteExtra: Part | null = null;

    if (parametros.origem === "colado") {
      promptTexto = montarPromptAdvogadoContra({ tipo: "colado", titulo: parametros.titulo, texto: parametros.texto });
    } else if (parametros.origem === "tese_cadastrada") {
      promptTexto = montarPromptAdvogadoContra({
        tipo: "tese_cadastrada",
        tese: parametros.tese,
        fundamentacao: parametros.fundamentacao,
      });
    } else if (parametros.tipoArquivo === "imagem") {
      promptTexto = montarPromptAdvogadoContra({
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
          erro: erroExtracao instanceof Error ? erroExtracao.message : "Falha ao extrair texto do arquivo.",
        };
      }

      const { paginas, truncado } = truncarTextoExtraido(paginasExtraidas);
      promptTexto = montarPromptAdvogadoContra({
        tipo: "extraido",
        titulo: parametros.titulo,
        nomeArquivo: parametros.nomeArquivo,
        paginas,
        truncado,
      });
    }

    // Contexto do RAG entra DEPOIS do texto a analisar, como bloco separado:
    // o modelo precisa saber o que é o alvo da análise (turno do usuário) e o
    // que é referência recuperada (dado externo, não instrução). Concatenar
    // antes misturaria os dois e enfraqueceria a marcação anti-injeção que
    // `montarBlocoContexto` estabelece.
    if (parametros.contextoJuridico) {
      promptTexto = `${promptTexto}

${parametros.contextoJuridico}`;
    }

    const jsonBruto = await gerarRespostaEstruturada({
      promptTexto,
      parteExtra,
      systemPrompt: ADVOGADO_CONTRA_SYSTEM_PROMPT,
      responseSchema: ADVOGADO_CONTRA_RESPONSE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS_ADVOGADO_CONTRA,
      thinkingBudget: THINKING_BUDGET_ADVOGADO_CONTRA,
      cadeiaModelos: [MODELO_ADVOGADO_CONTRA, MODELO_FALLBACK_QUOTA_ADVOGADO_CONTRA],
      logPrefixo: "[advogado-contra/analisar]",
    });

    const resultado = parsearRespostaAdvogadoContra(jsonBruto);

    if (!resultado) {
      return {
        ok: false,
        erro: "A IA devolveu uma resposta em formato inesperado. Tente novamente ou reenvie o texto.",
      };
    }

    return { ok: true, resultado, modeloIaUsado: MODELO_ADVOGADO_CONTRA };
  } catch (erro) {
    console.error("[advogado-contra/analisar] Falha ao analisar como advogado do contra:", erro);
    return { ok: false, erro: mensagemErroIaParaUsuario(erro) };
  }
}
