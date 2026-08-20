import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

/**
 * Extração de texto para a análise inteligente de processo (ADR 0004, seção
 * 3/6). Cada página extraída carrega o número de página para permitir que a
 * IA cite `pagina` em toda afirmação (`CitacaoAnaliseProcesso`,
 * `lib/analise-processo/tipos.ts`).
 *
 * Imagem (jpg/png) NÃO tem função de extração aqui: os bytes vão direto para
 * o Gemini como parte multimodal (`inlineData`) em
 * `lib/analise-processo/analisar.ts#analisarDocumentoProcesso` — o modelo lê
 * a imagem nativamente, sem OCR próprio (ver ADR 0004, alternativa 4,
 * rejeitada).
 */
export type PaginaTextoExtraido = {
  /** Número da página (1-based) para PDF; `null` quando o formato não tem
   * paginação real (DOCX — ver `extrairTextoDeDocx`). */
  pagina: number | null;
  texto: string;
};

/**
 * Teto de caracteres do texto extraído somado (todas as páginas), conforme
 * ADR 0004 seção 6 — ~75k tokens, processado em UMA chamada, sem chunking/
 * map-reduce nesta v1. Acima do teto: truncamos com aviso explícito em vez
 * de falhar silenciosamente ou mandar tudo pra IA sem controle de custo.
 */
export const TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO = 300_000;

/**
 * Extrai texto de um PDF preservando a divisão por página
 * (`extractText(pdf, { mergePages: false })` devolve `string[]`, uma entrada
 * por página) — diferente de `lib/rag/extrair-texto.ts#extrairTextoDePdf`
 * (mescla tudo, usado pela base de conhecimento, que não precisa de
 * `pagina`). PDF escaneado sem camada de texto (todas as páginas vazias) é
 * tratado como erro explícito: fora do escopo do v1 (ADR 0004 seção 3), o
 * usuário deve reenviar como imagem.
 */
export async function extrairTextoDePdfPorPagina(buffer: Uint8Array): Promise<PaginaTextoExtraido[]> {
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: false });
  const textosPorPagina = Array.isArray(text) ? text : [text];

  const paginas = textosPorPagina.map((texto, indice) => ({
    pagina: indice + 1,
    texto: texto.trim(),
  }));

  const temTextoExtraivel = paginas.some((pagina) => pagina.texto.length > 0);
  if (!temTextoExtraivel) {
    throw new Error(
      "Não foi possível extrair texto do PDF (documento provavelmente digitalizado como imagem, sem camada de texto). Reenvie como imagem (jpg/png) para análise.",
    );
  }

  return paginas;
}

/**
 * Extrai texto de um DOCX via `mammoth` (`extractRawText` — leitura simples
 * de texto corrido, sem preservar formatação/estilos, que não interessam
 * para a análise). DOCX não tem conceito de "página" real (paginação em
 * .docx é um efeito visual calculado pelo renderizador/impressora, não um
 * dado armazenado no arquivo) — por isso devolvemos UMA única entrada com
 * `pagina: null`, decisão documentada também em `CitacaoAnaliseProcesso`
 * (ADR 0004 seção 3).
 */
export async function extrairTextoDeDocx(buffer: Buffer): Promise<PaginaTextoExtraido[]> {
  const { value } = await mammoth.extractRawText({ buffer });
  const texto = value.trim();

  if (!texto) {
    throw new Error("Não foi possível extrair texto do DOCX (documento vazio ou sem conteúdo textual).");
  }

  return [{ pagina: null, texto }];
}

export type ResultadoTruncamento = {
  paginas: PaginaTextoExtraido[];
  truncado: boolean;
  tamanhoOriginal: number;
};

/**
 * Aplica o teto de `TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO` sobre o total de
 * caracteres somando todas as páginas — nunca corta no meio de silêncio: o
 * corte acontece na fronteira de uma página inteira (a última página que
 * ultrapassaria o teto é descartada por completo, nunca truncada no meio),
 * preservando a integridade de `pagina` para citação. `truncado: true`
 * sinaliza ao caller para incluir um aviso explícito no prompt/resultado —
 * nunca falha silenciosamente.
 */
export function truncarTextoExtraido(paginas: PaginaTextoExtraido[]): ResultadoTruncamento {
  const tamanhoOriginal = paginas.reduce((total, pagina) => total + pagina.texto.length, 0);

  if (tamanhoOriginal <= TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO) {
    return { paginas, truncado: false, tamanhoOriginal };
  }

  const paginasTruncadas: PaginaTextoExtraido[] = [];
  let acumulado = 0;
  for (const pagina of paginas) {
    if (acumulado + pagina.texto.length > TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO) break;
    paginasTruncadas.push(pagina);
    acumulado += pagina.texto.length;
  }

  return { paginas: paginasTruncadas, truncado: true, tamanhoOriginal };
}
