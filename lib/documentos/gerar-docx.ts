import "server-only";

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

/**
 * Gera um .docx simples a partir de texto plano/markdown-lite: linhas que
 * começam com "# "/"## " viram heading, o resto vira parágrafo normal.
 * Suficiente para minutas de peças produzidas pelo modelo — não tenta
 * reproduzir markdown completo (tabelas, negrito inline), que exigiria um
 * parser dedicado fora do escopo desta feature.
 */
export async function gerarDocx(titulo: string, conteudo: string): Promise<Buffer> {
  const linhas = conteudo.split("\n");

  const paragrafos = linhas.map((linha) => {
    const linhaLimpa = linha.trimEnd();
    if (linhaLimpa.startsWith("## ")) {
      return new Paragraph({ text: linhaLimpa.slice(3), heading: HeadingLevel.HEADING_2 });
    }
    if (linhaLimpa.startsWith("# ")) {
      return new Paragraph({ text: linhaLimpa.slice(2), heading: HeadingLevel.HEADING_1 });
    }
    if (!linhaLimpa.trim()) {
      return new Paragraph({ text: "" });
    }
    return new Paragraph({ children: [new TextRun(linhaLimpa)] });
  });

  const doc = new Document({
    title: titulo,
    sections: [
      {
        children: [new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }), ...paragrafos],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
