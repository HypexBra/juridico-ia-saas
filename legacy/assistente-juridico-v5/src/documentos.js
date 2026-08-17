const axios   = require('axios');
const FormData = require('form-data');

const BASE_URL = () =>
  `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;
const headers  = () => ({ 'Client-Token': process.env.ZAPI_CLIENT_TOKEN });

// Baixa um documento/imagem enviado pelo cliente no WhatsApp
async function baixarArquivo(url) {
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: headers(),
      timeout: 30000
    });
    return {
      buffer: Buffer.from(resp.data),
      contentType: resp.headers['content-type'] || 'application/octet-stream'
    };
  } catch (err) {
    console.error('❌ Erro ao baixar arquivo:', err.message);
    return null;
  }
}

// Extrai texto de PDF usando Anthropic (envia como base64)
async function extrairTextoPDF(buffer, nomeArquivo) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const base64 = buffer.toString('base64');

  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          {
            type: 'text',
            text: `Este é o arquivo "${nomeArquivo}". Extraia e transcreva TODO o texto do documento fielmente, mantendo a estrutura original. Se for um contrato, petição ou documento jurídico, preserve cláusulas, artigos e formatação lógica.`
          }
        ]
      }]
    });
    return resp.content[0]?.text || '';
  } catch (err) {
    console.error('❌ Erro ao extrair PDF:', err.message);
    return null;
  }
}

// Analisa imagem (foto de contrato, documento etc.)
async function analisarImagem(buffer, contentType, instrucao = '') {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const base64 = buffer.toString('base64');
  const media  = contentType.includes('png') ? 'image/png'
               : contentType.includes('gif') ? 'image/gif'
               : contentType.includes('webp') ? 'image/webp'
               : 'image/jpeg';

  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: base64 } },
          { type: 'text', text: instrucao || 'Descreva e transcreva todo o conteúdo visível nesta imagem. Se for um documento jurídico, extraia o texto completo.' }
        ]
      }]
    });
    return resp.content[0]?.text || '';
  } catch (err) {
    console.error('❌ Erro ao analisar imagem:', err.message);
    return null;
  }
}

// Detecta tipo de arquivo recebido no webhook da Z-API
function detectarTipoArquivo(body) {
  if (body.document) return { tipo: 'document', url: body.document.url, nome: body.document.fileName || 'documento' };
  if (body.image)    return { tipo: 'image',    url: body.image.url,    nome: 'imagem.jpg' };
  if (body.audio)    return { tipo: 'audio',    url: body.audio.url,    nome: 'audio.ogg' };
  return null;
}

module.exports = { baixarArquivo, extrairTextoPDF, analisarImagem, detectarTipoArquivo };
