require('dotenv').config();
const express       = require('express');
const session       = require('express-session');
const db            = require('./db/repositorio');
const { processarMensagem, precisaDocx, precisaJurisprudencia } = require('./ia');
const { enviarMensagem, enviarDigitando, enviarArquivo } = require('./whatsapp');
const { baixarArquivo, extrairTextoPDF, analisarImagem, detectarTipoArquivo } = require('./documentos');
const { garantirAdminInicial }  = require('./auth');
const { gerarDOCX }             = require('./docx');
const { buscarJurisprudencia }  = require('./jurisprudencia');
const { iniciarAgendador, criarPrazo } = require('./prazos');
const { iniciarNotificacoes }   = require('./notificacoes');
const { registrarCusto }        = require('./financeiro');
const { processarMenu, detectarComandoPrazo, MENU_PRINCIPAL } = require('./menu');
const triagem  = require('./triagem');
const painel   = require('./painel');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'juridico-secret-2025',
  resave: false, saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use('/painel', painel);
app.use('/painel/financeiro', require('./painel-financeiro'));
app.use('/painel/modelos', require('./painel-modelos'));
app.use('/painel/prazos', require('./painel-prazos'));
app.get('/', (req, res) => res.redirect('/painel'));

// ─── Notifica advogados sobre nova triagem ────────────────────────────────────
async function notificarAdvogados(ficha) {
  const numeros = await db.getAdminNumeros();
  if (!numeros.length) return;
  const emoji = ficha.urgencia === 'alta' ? '🔴 URGENTE' : '🟡 Normal';
  const msg = `🆕 *NOVA TRIAGEM DE CLIENTE*\n\n👤 *${ficha.nome_cliente||'Sem nome'}*\n📱 ${ficha.telefone}\n⚖️ ${ficha.area_direito||'A identificar'} — ${emoji}\n\n📋 ${(ficha.resumo_fatos||'').substring(0,250)}...\n\n🤖 Análise da IA disponível no painel:\n${process.env.PAINEL_URL||'http://localhost:3000'}/painel/fichas`;
  for (const n of numeros) { try { await enviarMensagem(n, msg); } catch {} }
}

// ─── Fluxo cliente externo ────────────────────────────────────────────────────
async function processarClienteExterno(numero, texto, conversa, cliente) {
  const sessao = triagem.getSessao(numero);

  if (sessao.etapa === 0) {
    const msg = `Olá! Bem-vindo(a) ao escritório! 👋\n\nVou fazer algumas perguntas para registrar seu caso.\n\n${triagem.proximaPergunta(0)}`;
    await enviarMensagem(numero, msg);
    await db.salvarMensagem(conversa.id, cliente.id, 'assistant', msg);
    return;
  }

  const sessaoAtualizada = triagem.salvarResposta(numero, texto);
  await db.salvarMensagem(conversa.id, cliente.id, 'user', texto);

  if (triagem.triagemCompleta(numero)) {
    const dados = sessaoAtualizada.dados;
    const encerramento = `✅ Obrigado, ${dados.nome||'cliente'}!\n\nRecebemos suas informações e nossa equipe jurídica entrará em contato em breve.\n\nTenha um ótimo dia! ⚖️`;
    await enviarMensagem(numero, encerramento);
    await db.salvarMensagem(conversa.id, cliente.id, 'assistant', encerramento);

    const { texto: resumoIA } = await triagem.gerarResumoIA(dados);
    const area     = triagem.detectarArea(dados.area + ' ' + dados.fatos);
    const urgencia = triagem.detectarUrgencia(dados.urgencia);

    const ficha = await db.salvarFichaCaso({
      conversaId: conversa.id, clienteId: cliente.id,
      nomeCliente: dados.nome, telefone: numero,
      areaDireito: area, resumoFatos: dados.fatos,
      documentos: dados.documentos, urgencia,
      resumoIa: resumoIA, questoesIa: '', estrategiaIa: '', documentosIa: ''
    });

    await db.atualizarStatusConversa(conversa.id, 'triagem_completa');
    await notificarAdvogados({ ...ficha, nome_cliente: dados.nome, telefone: numero, area_direito: area, urgencia });
    triagem.limparSessao(numero);
    return;
  }

  const proxima = triagem.proximaPergunta(sessaoAtualizada.etapa);
  if (proxima) {
    await enviarMensagem(numero, proxima);
    await db.salvarMensagem(conversa.id, cliente.id, 'assistant', proxima);
  }
}

// ─── Webhook ───────────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const body = req.body;
    if (body.fromMe || body.isGroup) return;

    const numero   = body.phone;
    const nome     = body.senderName || null;
    const arquivo  = detectarTipoArquivo(body);
    const textoMsg = body.text?.message?.trim() || '';

    if (!textoMsg && !arquivo) return;
    console.log(`📩 [${numero}] ${arquivo ? `[${arquivo.tipo}]` : textoMsg.substring(0, 80)}`);

    const ehAdvogado = await db.isAdvogado(numero);
    const cliente    = await db.upsertCliente(numero, nome, ehAdvogado ? 'advogado' : 'externo');
    let conversa     = await db.getConversaAtiva(cliente.id);

    // ── CLIENTE EXTERNO ───────────────────────────────────────────────────────
    if (!ehAdvogado) {
      if (!conversa) conversa = await db.criarConversa(cliente.id, 'triagem');
      if (conversa.status === 'triagem_completa') {
        await enviarMensagem(numero, '✅ Seu caso já foi registrado. Entraremos em contato em breve! ⚖️');
        return;
      }
      await processarClienteExterno(numero, textoMsg, conversa, cliente);
      return;
    }

    // ── ADVOGADO ──────────────────────────────────────────────────────────────
    if (!conversa) conversa = await db.criarConversa(cliente.id, 'interno');

    // Comandos especiais
    if (textoMsg === '/menu') { await enviarMensagem(numero, MENU_PRINCIPAL); return; }
    if (textoMsg === '/limpar') { await db.encerrarConversa(conversa.id); await enviarMensagem(numero, '🗑️ Conversa encerrada.'); return; }
    if (textoMsg === '/ajuda') { await enviarMensagem(numero, MENU_PRINCIPAL); return; }

    // Detecta comando de prazo inline
    const dadosPrazo = textoMsg ? detectarComandoPrazo(textoMsg) : null;
    if (dadosPrazo) {
      const [dia, mes, ano] = dadosPrazo.data.split('/');
      const dataPrazo = `${ano}-${mes}-${dia}`;
      const usuarios = await db.listarUsuarios ? await db.listarUsuarios() : [];
      const usuarioId = usuarios[0]?.id || 1;
      await criarPrazo({ usuarioId, titulo: dadosPrazo.titulo, dataPrazo, clienteNome: dadosPrazo.cliente, processo: dadosPrazo.processo });
      await enviarMensagem(numero, `⏰ *Prazo cadastrado!*\n\n📁 ${dadosPrazo.titulo}\n📅 ${dadosPrazo.data}${dadosPrazo.cliente?'\n👤 '+dadosPrazo.cliente:''}${dadosPrazo.processo?'\n📄 '+dadosPrazo.processo:''}\n\nVocê receberá lembretes 7, 3 e 1 dia antes.`);
      return;
    }

    // Processa menu guiado
    const resultadoMenu = processarMenu(numero, textoMsg || '');
    if (resultadoMenu.tipo === 'menu' || resultadoMenu.tipo === 'submenu' || resultadoMenu.tipo === 'livre') {
      await enviarMensagem(numero, resultadoMenu.mensagem);
      return;
    }

    await enviarDigitando(numero);

    let conteudoParaIA = textoMsg;
    let tipoMensagem   = 'text';
    let nomeArquivo    = null;

    // Processa arquivo enviado
    if (arquivo) {
      tipoMensagem = arquivo.tipo;
      nomeArquivo  = arquivo.nome;
      await enviarMensagem(numero, `📎 Recebi *${arquivo.nome}*. Analisando...`);
      const result = await baixarArquivo(arquivo.url);
      if (!result?.buffer) { await enviarMensagem(numero, '❌ Não consegui baixar o arquivo.'); return; }
      const { buffer, contentType } = result;
      let textoExtraido = '';
      if (arquivo.tipo === 'document' && contentType?.includes('pdf')) {
        textoExtraido = await extrairTextoPDF(buffer, arquivo.nome);
      } else if (arquivo.tipo === 'image') {
        textoExtraido = await analisarImagem(buffer, contentType, textoMsg || 'Analise este documento.');
      }
      if (!textoExtraido) { await enviarMensagem(numero, '❌ Não consegui extrair o conteúdo.'); return; }
      conteudoParaIA = textoMsg
        ? `Arquivo "${arquivo.nome}" com instrução: "${textoMsg}"\n\nCONTEÚDO:\n${textoExtraido}`
        : `Arquivo "${arquivo.nome}":\n\nCONTEÚDO:\n${textoExtraido}`;
    }

    // Adiciona prefixo de contexto do menu se houver
    if (resultadoMenu.prefixo) conteudoParaIA = resultadoMenu.prefixo + conteudoParaIA;

    // Busca jurisprudência em tempo real se solicitado
    if (precisaJurisprudencia(conteudoParaIA)) {
      await enviarMensagem(numero, '🔍 Buscando jurisprudência atualizada...');
      const { buscarJurisprudencia: busca } = require('./jurisprudencia');
      const jurisprudencia = await busca(conteudoParaIA.substring(0, 200));
      conteudoParaIA += `\n\n[JURISPRUDÊNCIA PESQUISADA EM TEMPO REAL]\n${jurisprudencia}`;
    }

    await db.salvarMensagem(conversa.id, cliente.id, 'user', conteudoParaIA, 0, tipoMensagem, nomeArquivo);
    const historico = await db.getHistoricoConversa(conversa.id);
    const { texto: resposta, tokensIn, tokensOut } = await processarMensagem(historico, resultadoMenu.contexto);
    await db.salvarMensagem(conversa.id, cliente.id, 'assistant', resposta, tokensOut);
    await registrarCusto(conversa.id, cliente.id, tokensIn, tokensOut);

    // Gera e envia DOCX se solicitado
    if (precisaDocx(conteudoParaIA)) {
      try {
        await enviarMensagem(numero, resposta);
        await enviarMensagem(numero, '📄 Gerando arquivo Word...');
        const buffer = await gerarDOCX('Peça Jurídica', resposta);
        await enviarArquivo(numero, buffer, 'peca-juridica.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return;
      } catch (err) {
        console.error('❌ Erro ao gerar DOCX:', err.message);
      }
    }

    await enviarMensagem(numero, resposta);

  } catch (err) {
    console.error('❌ Erro no webhook:', err.message);
  }
});

app.get('/health', async (req, res) => {
  try { const s = await db.getEstatisticas(); res.json({ status: 'ok', uptime: Math.floor(process.uptime()), ...s }); }
  catch { res.json({ status: 'ok', uptime: Math.floor(process.uptime()) }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await garantirAdminInicial();
  iniciarAgendador();
  iniciarNotificacoes();
  console.log(`
╔══════════════════════════════════════════════╗
║   Assistente Jurídico IA v5.0  ⚖️            ║
╠══════════════════════════════════════════════╣
║  Servidor:  http://localhost:${PORT}            ║
║  Painel:    http://localhost:${PORT}/painel     ║
║  Webhook:   POST /webhook                    ║
╠══════════════════════════════════════════════╣
║  ✅ Menu guiado                              ║
║  ✅ DOCX automático                          ║
║  ✅ Jurisprudência em tempo real             ║
║  ✅ Controle de prazos                       ║
║  ✅ Dashboard financeiro                     ║
║  ✅ Notificações proativas                   ║
║  ✅ Biblioteca de modelos                    ║
║  ✅ Modo cliente externo                     ║
╚══════════════════════════════════════════════╝
  `);
});
