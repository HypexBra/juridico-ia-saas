import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TAMANHO_FONTE = 11;
const MARGEM = 50;
const ALTURA_LINHA = 16;

function quebrarLinha(texto: string, fonte: import("pdf-lib").PDFFont, larguraMaxima: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [""];

  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(candidato, TAMANHO_FONTE) > larguraMaxima && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidato;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Gera um PDF simples com quebra de linha manual (pdf-lib não faz word-wrap nativo). */
export async function gerarPdf(titulo: string, conteudo: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fonte = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let pagina = pdfDoc.addPage();
  let { width, height } = pagina.getSize();
  let y = height - MARGEM;
  const larguraUtil = width - MARGEM * 2;

  function novaPagina() {
    pagina = pdfDoc.addPage();
    ({ width, height } = pagina.getSize());
    y = height - MARGEM;
  }

  function escreverLinha(texto: string, negrito = false, tamanho = TAMANHO_FONTE) {
    if (y < MARGEM) novaPagina();
    pagina.drawText(texto, {
      x: MARGEM,
      y,
      size: tamanho,
      font: negrito ? fonteNegrito : fonte,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= ALTURA_LINHA;
  }

  escreverLinha(titulo, true, 16);
  y -= 6;

  for (const linhaBruta of conteudo.split("\n")) {
    const linha = linhaBruta.trimEnd();
    if (!linha.trim()) {
      y -= ALTURA_LINHA / 2;
      continue;
    }
    const negrito = linha.startsWith("# ") || linha.startsWith("## ");
    const textoLimpo = negrito ? linha.replace(/^#+\s*/, "") : linha;
    for (const parte of quebrarLinha(textoLimpo, negrito ? fonteNegrito : fonte, larguraUtil)) {
      escreverLinha(parte, negrito);
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
