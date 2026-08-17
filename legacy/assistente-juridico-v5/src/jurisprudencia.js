const axios    = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Busca jurisprudência via web_search da Anthropic
async function buscarJurisprudencia(tema, area = '') {
  try {
    const query = `jurisprudência STJ STF ${area} ${tema} 2024 2025`;

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Pesquise jurisprudência brasileira atualizada (2023-2025) sobre: "${tema}" na área de ${area||'Direito brasileiro'}.

Foque em:
1. Decisões recentes do STF e STJ
2. Súmulas aplicáveis
3. Temas repetitivos e repercussão geral
4. Entendimento consolidado dos tribunais

Apresente os resultados de forma estruturada com: tribunal, número do acórdão/súmula, ementa resumida e data.`
      }]
    });

    // Extrai todo o texto da resposta (incluindo tool_use results)
    const textos = resp.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return textos || 'Nenhum resultado encontrado para este tema.';
  } catch (err) {
    console.error('❌ Erro na busca de jurisprudência:', err.message);
    return `Não foi possível buscar jurisprudência no momento. Tema pesquisado: "${tema}"`;
  }
}

// Busca rápida de súmulas por número
async function buscarSumula(numero, tribunal = 'STJ') {
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Qual é o texto completo da Súmula ${numero} do ${tribunal}? Informe o texto exato e contexto de aplicação.`
      }]
    });
    return resp.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  } catch (err) {
    return `Erro ao buscar Súmula ${numero} do ${tribunal}.`;
  }
}

module.exports = { buscarJurisprudencia, buscarSumula };
