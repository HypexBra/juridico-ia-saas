// Gera ícones PNG para o PWA usando apenas canvas nativo do Node
// Execute: node gerar-icones.js
// Requer: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const DIR   = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function gerarIcone(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  // Fundo azul-marinho
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#0f2040');
  bg.addColorStop(1, '#0a1628');
  ctx.fillStyle = bg;
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Borda dourada
  ctx.strokeStyle = 'rgba(201,168,76,0.5)';
  ctx.lineWidth   = Math.max(1, size * 0.02);
  ctx.roundRect(ctx.lineWidth/2, ctx.lineWidth/2, size - ctx.lineWidth, size - ctx.lineWidth, size * 0.19);
  ctx.stroke();

  // Emoji ⚖️ centralizado
  const fontSize = Math.round(size * 0.45);
  ctx.font      = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚖️', size / 2, size / 2 + size * 0.03);

  const buffer = canvas.toBuffer('image/png');
  const file   = path.join(DIR, `icon-${size}.png`);
  fs.writeFileSync(file, buffer);
  console.log(`✅ icon-${size}.png`);
}

console.log('🎨 Gerando ícones PWA...\n');
SIZES.forEach(gerarIcone);
console.log('\n✅ Todos os ícones gerados em public/icons/');
