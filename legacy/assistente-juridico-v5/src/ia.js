const Anthropic = require('@anthropic-ai/sdk');
const SYSTEM_PROMPT = require('../config/system-prompt');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function processarMensagem(historico, contextoExtra = null) {
  const system = contextoExtra
    ? `${SYSTEM_PROMPT}\n\nCONTEXTO ADICIONAL: ${contextoExtra}`
    : SYSTEM_PROMPT;

  try {
    const resposta = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      messages: historico
    });

    return {
      texto: resposta.content[0]?.text || 'Não consegui processar. Tente novamente.',
      tokensIn: resposta.usage?.input_tokens || 0,
      tokensOut: resposta.usage?.output_tokens || 0
    };
  } catch (err) {
    console.error('❌ Erro na API Anthropic:', err.message);
    if (err.status === 429) return { texto: 'Assistente sobrecarregado. Aguarde 1 minuto.', tokensIn: 0, tokensOut: 0 };
    throw err;
  }
}

// Versão que detecta se precisa gerar DOCX
function precisaDocx(texto) {
  return /\b(gere?|crie?|elabore?|produza?|faça?|mont[ae])\b.*(docx|word|arquivo|documento)\b/i.test(texto)
    || /\benvie?\b.*(word|docx)\b/i.test(texto);
}

// Versão que detecta pedido de jurisprudência
function precisaJurisprudencia(texto) {
  return /\b(busqu[ea]|pesquise?|encontre?|traga?)\b.*(jurisprudência|súmula|precedente|stj|stf|decisão)\b/i.test(texto)
    || /\bjurisprudência\b.*(recente|atual|2024|2025)\b/i.test(texto);
}

module.exports = { processarMensagem, precisaDocx, precisaJurisprudencia };
