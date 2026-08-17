const axios    = require('axios');
const FormData = require('form-data');

const BASE = () => `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;
const hdrs  = () => ({ 'Client-Token': process.env.ZAPI_CLIENT_TOKEN, 'Content-Type': 'application/json' });

async function enviarMensagem(numero, texto) {
  const partes = dividir(texto, 4000);
  for (const p of partes) {
    await axios.post(`${BASE()}/send-text`, { phone: numero, message: p }, { headers: hdrs() });
    if (partes.length > 1) await delay(800);
  }
}

async function enviarDigitando(numero) {
  try { await axios.post(`${BASE()}/send-option`, { phone: numero, typing: true }, { headers: hdrs() }); } catch {}
}

// Envia arquivo (DOCX, PDF) como documento no WhatsApp
async function enviarArquivo(numero, buffer, nomeArquivo, mimeType) {
  try {
    const base64 = buffer.toString('base64');
    await axios.post(`${BASE()}/send-document/base64`, {
      phone: numero,
      document: base64,
      filename: nomeArquivo,
      mimeType,
      caption: `📄 ${nomeArquivo}`
    }, { headers: hdrs() });
    console.log(`✅ Arquivo ${nomeArquivo} enviado para ${numero}`);
  } catch (err) {
    console.error('❌ Erro ao enviar arquivo:', err.message);
    throw err;
  }
}

function dividir(texto, limite) {
  if (texto.length <= limite) return [texto];
  const partes = []; let atual = '';
  for (const p of texto.split('\n\n')) {
    if ((atual + '\n\n' + p).length > limite) { if (atual) partes.push(atual.trim()); atual = p; }
    else atual = atual ? atual + '\n\n' + p : p;
  }
  if (atual) partes.push(atual.trim());
  return partes;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

module.exports = { enviarMensagem, enviarDigitando, enviarArquivo };
