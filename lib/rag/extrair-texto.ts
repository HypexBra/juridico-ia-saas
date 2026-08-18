import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extrai texto de um PDF (buffer) usando unpdf — wrapper do pdf.js
 * mantido pela unjs, ESM-first e sem efeitos colaterais de filesystem
 * (diferente de libs como `pdf-parse`, cujo módulo tenta ler um arquivo de
 * teste na importação e quebra em bundlers/serverless). `pdf-lib` (já
 * presente no projeto) não faz extração de texto — só criação/edição — por
 * isso essa lib nova foi necessária.
 */
export async function extrairTextoDePdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
