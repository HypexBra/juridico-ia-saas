const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db/repositorio');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Etapas da triagem do cliente externo
const ETAPAS = [
  { key: 'nome',        pergunta: '👋 Olá! Seja bem-vindo(a) ao escritório.\n\nPrimeiro, qual é o seu nome completo?' },
  { key: 'area',        pergunta: '📋 Qual é o assunto do seu caso?\n\nExemplos: problema com empregador, dívida, divórcio, acidente, problema com empresa, questão de herança, outro.' },
  { key: 'fatos',       pergunta: '📝 Agora me conte o que aconteceu com o máximo de detalhes que puder.\n\nDescreva os fatos, datas importantes e quem está envolvido.' },
  { key: 'documentos',  pergunta: '📎 Você tem algum documento relacionado ao caso?\n\nExemplos: contratos, notificações, comprovantes, fotos, laudos, e-mails.\n\nSe sim, descreva quais você possui. Se não tiver nenhum, pode responder "não tenho".' },
  { key: 'urgencia',    pergunta: '⏰ Existe algum prazo urgente?\n\nPor exemplo: audiência marcada, prazo vencendo, situação de risco imediato.\n\nResponda SIM ou NÃO e, se sim, explique.' }
];

// Sessões de triagem em andamento (em memória — complementar ao banco)
const sessoesTriagem = new Map();

function getSessao(numero) {
  return sessoesTriagem.get(numero) || { etapa: 0, dados: {} };
}

function setSessao(numero, sessao) {
  sessoesTriagem.set(numero, sessao);
}

function limparSessao(numero) {
  sessoesTriagem.delete(numero);
}

// Retorna a próxima pergunta da triagem
function proximaPergunta(etapa) {
  return ETAPAS[etapa]?.pergunta || null;
}

// Salva a resposta da etapa atual e avança
function salvarResposta(numero, resposta) {
  const sessao = getSessao(numero);
  const etapaAtual = ETAPAS[sessao.etapa];
  if (etapaAtual) sessao.dados[etapaAtual.key] = resposta;
  sessao.etapa++;
  setSessao(numero, sessao);
  return sessao;
}

// Verifica se triagem está completa
function triagemCompleta(numero) {
  const sessao = getSessao(numero);
  return sessao.etapa >= ETAPAS.length;
}

// Gera resumo inteligente via IA com base nos dados coletados
async function gerarResumoIA(dados) {
  const prompt = `Você é um advogado sênior analisando uma triagem de cliente. Com base nos dados abaixo, produza uma análise jurídica estruturada para o advogado responsável.

DADOS DO CLIENTE:
- Nome: ${dados.nome}
- Área relatada: ${dados.area}
- Fatos: ${dados.fatos}
- Documentos disponíveis: ${dados.documentos}
- Urgência: ${dados.urgencia}

Produza a análise em formato estruturado:

I - RESUMO DO CASO (3-5 linhas objetivas)

II - ÁREA JURÍDICA IDENTIFICADA
(Identifique a área principal e subárea)

III - QUESTÕES JURÍDICAS ENVOLVIDAS
(Liste os principais pontos jurídicos a serem analisados)

IV - LEGISLAÇÃO POSSIVELMENTE APLICÁVEL
(Cite artigos de leis relevantes, sem inventar — apenas se tiver certeza)

V - URGÊNCIA E PRAZO
(Avalie o nível de urgência: BAIXA / MÉDIA / ALTA / CRÍTICA e explique)

VI - DOCUMENTOS NECESSÁRIOS
(Liste quais documentos o advogado deve solicitar ao cliente)

VII - ESTRATÉGIAS PRELIMINARES
(2-3 possíveis caminhos jurídicos, brevemente)

VIII - RECOMENDAÇÃO AO ADVOGADO
(O que fazer primeiro: contato urgente, agendar consulta, solicitar documentos etc.)`;

  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    return {
      texto: resp.content[0]?.text || '',
      tokens: resp.usage?.output_tokens || 0
    };
  } catch (err) {
    console.error('❌ Erro ao gerar resumo IA:', err.message);
    return { texto: 'Não foi possível gerar o resumo automático.', tokens: 0 };
  }
}

// Detecta área jurídica a partir do texto
function detectarArea(texto) {
  const t = texto.toLowerCase();
  if (/trabalh|empregad|demiss|ctps|fgts|hora extra|rescis/.test(t)) return 'Trabalhista';
  if (/divórcio|separação|pensão|guarda|aliment|família/.test(t)) return 'Família';
  if (/criminal|preso|prisão|policial|delegacia|inquérito|denúncia/.test(t)) return 'Penal';
  if (/imposto|tribut|receita|nota fiscal|icms|iss/.test(t)) return 'Tributário';
  if (/consumidor|produto|serviço|loja|banco|plano de saúde|empresa/.test(t)) return 'Consumidor';
  if (/herança|inventário|testamento|partilha/.test(t)) return 'Família';
  if (/acidente|indeniz|dano|batida|atropel/.test(t)) return 'Cível';
  if (/contrato|dívida|cobrança|empréstimo|aluguel/.test(t)) return 'Cível';
  if (/previdência|aposentadoria|inss|benefício/.test(t)) return 'Previdenciário';
  return 'Cível';
}

// Detecta urgência
function detectarUrgencia(texto) {
  const t = texto.toLowerCase();
  if (/sim|urgente|hoje|amanhã|prazo|audiência|vencendo|risco|crítico/.test(t)) return 'alta';
  return 'normal';
}

module.exports = {
  ETAPAS, getSessao, setSessao, limparSessao,
  proximaPergunta, salvarResposta, triagemCompleta,
  gerarResumoIA, detectarArea, detectarUrgencia
};
