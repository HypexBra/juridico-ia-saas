const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// Gera PDF do histórico de uma conversa
async function gerarPDFConversa(conversa, mensagens, tags) {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const W = 595, H = 842; // A4
  const ML = 50, MR = 50, MT = 50, MB = 60;
  const maxW = W - ML - MR;

  let page = doc.addPage([W, H]);
  let y = H - MT;

  // Cores
  const preto    = rgb(0.1,  0.1,  0.1);
  const cinza    = rgb(0.45, 0.45, 0.45);
  const azul     = rgb(0.15, 0.35, 0.75);
  const bgClient = rgb(0.93, 0.96, 1.0);
  const bgIA     = rgb(0.96, 0.96, 0.96);
  const branco   = rgb(1, 1, 1);

  function novaPagina() {
    page = doc.addPage([W, H]);
    y = H - MT;
    rodape();
  }

  function rodape() {
    page.drawLine({ start:{x:ML,y:MB-10}, end:{x:W-MR,y:MB-10}, thickness:0.5, color:cinza });
    page.drawText('Assistente Jurídico IA — Confidencial', {
      x:ML, y:MB-25, size:8, font, color:cinza });
    page.drawText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, {
      x:W-MR-130, y:MB-25, size:8, font, color:cinza });
  }

  function checarEspaco(necessario) {
    if (y - necessario < MB + 10) novaPagina();
  }

  function wrapText(texto, tamanho, f, largura) {
    const palavras = texto.split(' ');
    const linhas = [];
    let atual = '';
    for (const p of palavras) {
      const teste = atual ? atual + ' ' + p : p;
      const w = f.widthOfTextAtSize(teste, tamanho);
      if (w > largura && atual) { linhas.push(atual); atual = p; }
      else atual = teste;
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  // ── Cabeçalho ──────────────────────────────────────────
  page.drawRectangle({ x:0, y:H-90, width:W, height:90, color:azul });
  page.drawText('⚖ ASSISTENTE JURÍDICO IA', { x:ML, y:H-38, size:18, font:bold, color:branco });
  page.drawText('Histórico de Conversa', { x:ML, y:H-58, size:11, font, color:rgb(0.8,0.88,1) });

  // Infos da conversa
  const info = [
    `Conversa #${conversa.id}`,
    `Cliente: ${conversa.nome || conversa.numero}  |  Número: ${conversa.numero}`,
    `Início: ${new Date(conversa.iniciada_em).toLocaleString('pt-BR')}  |  Mensagens: ${mensagens.length}`,
    tags.length ? `Áreas: ${tags.map(t=>t.nome).join(', ')}` : ''
  ].filter(Boolean);

  let iy = H - 80;
  for (const linha of info) {
    page.drawText(linha, { x: W-280, y: iy, size:8.5, font, color:rgb(0.85,0.9,1) });
    iy -= 13;
  }

  y = H - 110;
  rodape();

  // ── Mensagens ──────────────────────────────────────────
  for (const msg of mensagens) {
    const isIA     = msg.role === 'assistant';
    const bgCor    = isIA ? bgIA : bgClient;
    const label    = isIA ? '⚖ Assistente IA' : '👤 Cliente';
    const hora     = new Date(msg.criado_em).toLocaleString('pt-BR');
    const linhas   = msg.conteudo.split('\n');
    const fontSize = 9;
    const lineH    = 14;
    const pad      = 10;
    const indentX  = isIA ? ML : ML + 60;
    const boxW     = maxW - 60;

    // Expande linhas com wrap
    const expandidas = [];
    for (const l of linhas) {
      if (!l.trim()) { expandidas.push(''); continue; }
      const wrapped = wrapText(l, fontSize, font, boxW - pad * 2);
      expandidas.push(...wrapped);
    }

    const boxH = pad * 2 + lineH + expandidas.length * lineH + 4;
    checarEspaco(boxH + 20);

    // Label e hora
    page.drawText(label, { x: indentX, y: y - 2, size: 8, font: bold, color: isIA ? azul : cinza });
    page.drawText(hora,  { x: indentX + boxW - font.widthOfTextAtSize(hora, 7.5), y: y - 2, size: 7.5, font, color: cinza });
    y -= 14;

    // Caixa de fundo
    page.drawRectangle({ x: indentX, y: y - boxH + pad, width: boxW, height: boxH,
      color: bgCor, borderColor: isIA ? rgb(0.8,0.8,0.8) : rgb(0.7,0.82,0.95),
      borderWidth: 0.5, borderRadius: 6 });

    // Texto
    let ty = y - pad - lineH + 4;
    for (const linha of expandidas) {
      if (linha.trim()) {
        page.drawText(linha.substring(0, 100), {
          x: indentX + pad, y: ty, size: fontSize, font, color: preto,
          maxWidth: boxW - pad * 2
        });
      }
      ty -= lineH;
    }

    y = y - boxH - 12;
  }

  return await doc.save();
}

module.exports = { gerarPDFConversa };
