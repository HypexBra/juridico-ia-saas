// Menu guiado interativo para advogados no WhatsApp
// Detecta intenção e monta contexto antes de chamar a IA

const MENU_PRINCIPAL = `⚖️ *ASSISTENTE JURÍDICO IA*

Olá! O que você precisa hoje?

*1* — 📄 Elaborar peça processual
*2* — 📝 Redigir documento extrajudicial
*3* — 🔍 Analisar processo ou contrato
*4* — ⚖️ Pesquisar jurisprudência
*5* — 🧮 Calcular verbas (trabalhista/indenização)
*6* — 📚 Usar modelo salvo
*7* — ⏰ Gerenciar prazos
*0* — 💬 Conversa livre (sem menu)

_Responda com o número ou descreva diretamente o caso._`;

const MENUS = {
  '1': {
    titulo: 'Peça Processual',
    pergunta: `Qual peça você precisa?\n\n*1* — Petição inicial\n*2* — Contestação\n*3* — Recurso (Apelação/Agravo)\n*4* — Habeas Corpus\n*5* — Mandado de Segurança\n*6* — Tutela de urgência\n*7* — Outra (descreva)\n\n_Responda com o número ou descreva a peça._`,
    contexto: 'elaborar peça processual'
  },
  '2': {
    titulo: 'Documento Extrajudicial',
    pergunta: `Qual documento você precisa?\n\n*1* — Contrato\n*2* — Notificação extrajudicial\n*3* — Procuração\n*4* — Acordo/Distrato\n*5* — Parecer jurídico\n*6* — Termo de confidencialidade\n*7* — Outro (descreva)\n\n_Responda com o número._`,
    contexto: 'elaborar documento extrajudicial'
  },
  '3': {
    titulo: 'Análise',
    pergunta: `O que você quer analisar?\n\n*1* — Processo judicial (cole ou descreva)\n*2* — Contrato (envie ou descreva)\n*3* — Decisão judicial\n*4* — Documento recebido (envie o PDF/foto)\n\n_Responda com o número ou envie o documento._`,
    contexto: 'analisar documento jurídico'
  },
  '4': {
    titulo: 'Jurisprudência',
    pergunta: `Pesquisa de jurisprudência:\n\nDescreva o tema que você quer pesquisar.\n\nExemplo: _"horas extras habituais reflexos DSR trabalhista"_ ou _"revisão contrato bancário juros abusivos"_`,
    contexto: 'pesquisar jurisprudência'
  },
  '5': {
    titulo: 'Cálculo',
    pergunta: `Qual cálculo você precisa?\n\n*1* — Verbas rescisórias (dispensa sem justa causa)\n*2* — Indenização por danos morais\n*3* — Horas extras e reflexos\n*4* — Pensão alimentícia\n*5* — Correção monetária e juros\n*6* — Outro (descreva)\n\n_Me passe os valores e datas necessários._`,
    contexto: 'calcular verbas ou indenização'
  },
  '7': {
    titulo: 'Prazos',
    pergunta: `⏰ *Gerenciar Prazos*\n\nDigite no formato:\n\n*PRAZO: [título] | [data DD/MM/AAAA] | [cliente] | [processo]*\n\nExemplo:\n_PRAZO: Apelação | 15/08/2025 | João Silva | 1234567-89_\n\nOu acesse o painel para ver todos os prazos.`,
    contexto: 'gerenciar prazo processual'
  }
};

// Estados de menu por número (em memória)
const estadosMenu = new Map();

function getEstado(numero) {
  return estadosMenu.get(numero) || { etapa: null, contexto: null };
}

function setEstado(numero, estado) {
  estadosMenu.set(numero, estado);
}

function limparEstado(numero) {
  estadosMenu.delete(numero);
}

// Detecta se mensagem é um número de menu
function isOpcaoMenu(texto) {
  return /^[0-7]$/.test(texto.trim());
}

// Detecta comando de prazo inline
function detectarComandoPrazo(texto) {
  const match = texto.match(/PRAZO:\s*([^|]+)\|([^|]+)\|?([^|]*)\|?(.*)/i);
  if (!match) return null;
  return {
    titulo: match[1].trim(),
    data: match[2].trim(),
    cliente: match[3].trim() || null,
    processo: match[4].trim() || null
  };
}

// Processa interação com menu
function processarMenu(numero, texto) {
  const estado = getEstado(numero);
  const t = texto.trim();

  // Comando /menu explícito
  if (t === '/menu') {
    limparEstado(numero);
    return { tipo: 'menu', mensagem: MENU_PRINCIPAL };
  }

  // Comando /0 = modo livre
  if (t === '0') {
    limparEstado(numero);
    return { tipo: 'livre', mensagem: '💬 Modo livre ativado. Descreva o caso diretamente.' };
  }

  // Sem estado: mostra menu se for opção ou deixa passar
  if (!estado.etapa) {
    if (isOpcaoMenu(t) && MENUS[t]) {
      setEstado(numero, { etapa: 'submenu', opcao: t, contexto: MENUS[t].contexto });
      return { tipo: 'submenu', mensagem: MENUS[t].pergunta };
    }
    // Não é opção de menu — deixa ir direto para a IA
    return { tipo: 'ia', contexto: null };
  }

  // Tem estado de submenu — próxima mensagem vai para IA com contexto
  if (estado.etapa === 'submenu') {
    const contextoBase = estado.contexto;
    limparEstado(numero);
    return {
      tipo: 'ia',
      contexto: contextoBase,
      prefixo: `[Solicitação: ${contextoBase}]\n\n`
    };
  }

  return { tipo: 'ia', contexto: null };
}

module.exports = { MENU_PRINCIPAL, MENUS, getEstado, setEstado, limparEstado, processarMenu, detectarComandoPrazo };
