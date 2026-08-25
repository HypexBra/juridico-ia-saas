/**
 * Validação de upload compartilhada entre as 4 features que aceitam
 * PDF/DOCX/imagem (análise de processo, Document Intelligence/comparador,
 * Auditor de Peças, Advogado do Contra) — antes cada uma tinha sua própria
 * cópia quase idêntica de `inferirTipoArquivo*`/`MIME_POR_TIPO_*`/
 * `EXTENSOES_POR_TIPO_*` (achado de tech lead review, Fase 5/6: 4 cópias do
 * mesmo helper de inferência de MIME de imagem espalhadas pelo projeto).
 *
 * Também fecha a dívida técnica registrada desde a Fase 3 ("upload valida
 * só extensão/MIME declarado, não conteúdo binário real, consistente em
 * todo o projeto, nunca corrigido"): `bufferBateComAssinatura` confere os
 * primeiros bytes do arquivo contra a assinatura real do formato (magic
 * bytes) — extensão/`Content-Type` são inteiramente controlados pelo
 * cliente (renomear um arquivo qualquer para `.pdf` engana as duas outras
 * checagens), os bytes iniciais do arquivo não. Não é uma sanitização
 * completa (não impede um PDF/DOCX malicioso *válido* no formato), só
 * fecha o caso mais barato de burlar: renomear/forjar Content-Type de um
 * arquivo de outro tipo qualquer.
 */

export const TIPOS_ARQUIVO_UPLOAD = ["pdf", "docx", "imagem"] as const;
export type TipoArquivoUpload = (typeof TIPOS_ARQUIVO_UPLOAD)[number];

const EXTENSOES_POR_TIPO: Record<TipoArquivoUpload, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  imagem: [".jpg", ".jpeg", ".png", ".webp"],
};

const MIME_POR_TIPO: Record<TipoArquivoUpload, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  imagem: ["image/jpeg", "image/png", "image/webp"],
};

/**
 * Infere o tipo do arquivo por MIME OU extensão (tolerante — alguns
 * navegadores/SOs não preenchem `File.type` corretamente para todo
 * formato), restrito à lista de tipos que a feature chamadora aceita.
 * Retorna `null` quando não bate com nenhum tipo permitido.
 */
export function inferirTipoArquivoUpload<T extends TipoArquivoUpload>(
  arquivo: File,
  tiposPermitidos: readonly T[],
): T | null {
  const nomeMinusculo = arquivo.name.toLowerCase();
  for (const tipo of tiposPermitidos) {
    const extensoes = EXTENSOES_POR_TIPO[tipo];
    const mimes = MIME_POR_TIPO[tipo];
    if (mimes.includes(arquivo.type) || extensoes.some((ext) => nomeMinusculo.endsWith(ext))) {
      return tipo;
    }
  }
  return null;
}

function bufferComecaCom(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, indice) => buffer[offset + indice] === byte);
}

/**
 * Confere os magic bytes do início do arquivo contra a assinatura real do
 * tipo declarado. DOCX é um ZIP por dentro (assinatura `PK\x03\x04` — ou,
 * mais raramente, `PK\x05\x06`/`PK\x07\x08` para arquivos zip vazios/
 * spanned, que na prática nunca ocorrem em DOCX gerado por Word/LibreOffice,
 * mas aceitos aqui por serem tecnicamente ZIP válido) — não valida que o
 * ZIP contém de fato a estrutura interna de um `.docx` (`word/document.xml`
 * etc.), só que É um ZIP, que já é a barreira mais barata e mais comum de
 * burlar (um arquivo `.txt` renomeado pra `.docx` falha aqui; um ZIP
 * qualquer renomeado passa — aceito, não é o objetivo desta checagem
 * cobrir esse caso mais raro).
 */
export function bufferBateComAssinatura(buffer: Buffer, tipo: TipoArquivoUpload): boolean {
  switch (tipo) {
    case "pdf":
      return bufferComecaCom(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    case "docx":
      return (
        bufferComecaCom(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
        bufferComecaCom(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
        bufferComecaCom(buffer, [0x50, 0x4b, 0x07, 0x08])
      );
    case "imagem":
      return (
        bufferComecaCom(buffer, [0xff, 0xd8, 0xff]) || // JPEG
        bufferComecaCom(buffer, [0x89, 0x50, 0x4e, 0x47]) || // PNG
        (bufferComecaCom(buffer, [0x52, 0x49, 0x46, 0x46]) && bufferComecaCom(buffer, [0x57, 0x45, 0x42, 0x50], 8)) // RIFF....WEBP
      );
  }
}

/** Mensagem amigável padrão quando os bytes reais não batem com o tipo declarado (nome/MIME). */
export const MENSAGEM_ARQUIVO_NAO_BATE_COM_TIPO =
  "O conteúdo do arquivo não corresponde ao tipo declarado pelo nome/formato. Verifique se o arquivo não está corrompido ou renomeado incorretamente.";
