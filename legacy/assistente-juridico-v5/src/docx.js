const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType } = require('docx');

async function gerarDOCX(titulo, conteudo, nomeArquivo = 'peca-juridica') {
  // Processa o texto em parágrafos inteligentes
  const linhas = conteudo.split('\n');
  const children = [];

  // Cabeçalho do escritório
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'ASSISTENTE JURÍDICO IA', bold: true, size: 28, color: '1e3a5f' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1e3a5f' } },
      children: [new TextRun({ text: titulo, bold: true, size: 24 })]
    })
  );

  for (const linha of linhas) {
    const l = linha.trim();
    if (!l) { children.push(new Paragraph({ spacing: { after: 100 } })); continue; }

    // Seções romanas (I -, II -, etc.)
    if (/^[IVX]+\s*[-—]\s/.test(l)) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: l, bold: true, size: 24, color: '1e3a5f' })]
      }));
      continue;
    }

    // Títulos em maiúsculas
    if (l === l.toUpperCase() && l.length > 3 && l.length < 80 && /[A-Z]/.test(l)) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 300, after: 150 },
        children: [new TextRun({ text: l, bold: true, size: 22 })]
      }));
      continue;
    }

    // Linhas com negrito marcado com *
    if (l.includes('*')) {
      const partes = l.split('*');
      const runs = partes.map((p, i) => new TextRun({ text: p, bold: i % 2 !== 0, size: 20 }));
      children.push(new Paragraph({ spacing: { after: 120 }, children: runs }));
      continue;
    }

    // Itens de lista
    if (/^[•\-]\s/.test(l)) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 100 },
        children: [new TextRun({ text: l.replace(/^[•\-]\s/, ''), size: 20 })]
      }));
      continue;
    }

    // Parágrafo normal com recuo (estilo petição)
    children.push(new Paragraph({
      indent: { firstLine: 720 },
      spacing: { after: 120, line: 360 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: l, size: 20 })]
    }));
  }

  // Rodapé com data
  children.push(
    new Paragraph({ spacing: { before: 600 } }),
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' } },
      spacing: { before: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `Gerado por Assistente Jurídico IA — ${new Date().toLocaleDateString('pt-BR')}`,
        size: 16, color: '888888', italics: true
      })]
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: 360 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 } // margens ABNT
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { gerarDOCX };
