const express  = require('express');
const router   = express.Router();
const db       = require('./db/repositorio');
const auth     = require('./auth');
const { gerarPDFConversa } = require('./pdf');
const { hashSenha }        = require('./auth');
const { autenticado, apenasAdmin } = auth;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
a{color:#60a5fa;text-decoration:none} a:hover{text-decoration:underline}
.nav{background:#1e293b;padding:.875rem 1.5rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid #334155;position:sticky;top:0;z-index:100;flex-wrap:wrap}
.nav-logo{font-size:1rem;font-weight:700;color:#f8fafc;margin-right:auto}
.nav a{font-size:.8rem;color:#94a3b8;padding:.3rem .6rem;border-radius:6px;position:relative}
.nav a:hover,.nav a.ativo{background:#334155;color:#f8fafc;text-decoration:none}
.notif-badge{position:absolute;top:-4px;right:-4px;background:#dc2626;color:#fff;font-size:.6rem;font-weight:700;padding:1px 5px;border-radius:99px;min-width:16px;text-align:center}
.nav .user-badge{font-size:.75rem;color:#64748b;padding:.3rem .75rem;border:1px solid #334155;border-radius:99px}
.container{max-width:1300px;margin:0 auto;padding:1.5rem}
.page-title{font-size:1.1rem;font-weight:600;color:#f8fafc;margin-bottom:1.25rem}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.25rem}
.card .label{font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
.card .value{font-size:1.75rem;font-weight:700;color:#f8fafc;margin-top:.2rem}
.card .sub{font-size:.72rem;color:#64748b;margin-top:.3rem}
.card.destaque{border-color:#dc2626;background:#1a0a0a}
.card.destaque .value{color:#f87171}
.section{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:1.25rem}
.section-header{padding:.875rem 1.25rem;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
.section-header h2{font-size:.875rem;font-weight:600;color:#f8fafc}
table{width:100%;border-collapse:collapse}
th{padding:.625rem 1rem;text-align:left;font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #334155;white-space:nowrap}
td{padding:.625rem 1rem;font-size:.8rem;border-bottom:1px solid #1a2436;color:#cbd5e1;vertical-align:middle}
tr:last-child td{border-bottom:none} tr:hover td{background:#1a2a40}
.badge{display:inline-block;padding:.15rem .55rem;border-radius:99px;font-size:.65rem;font-weight:600;white-space:nowrap}
.badge-green{background:#064e3b;color:#34d399} .badge-blue{background:#1e3a5f;color:#60a5fa}
.badge-red{background:#450a0a;color:#fca5a5} .badge-gray{background:#1e293b;color:#94a3b8}
.badge-yellow{background:#431407;color:#fb923c} .badge-purple{background:#2e1065;color:#c4b5fd}
.badge-orange{background:#431407;color:#fb923c}
.tag{display:inline-flex;align-items:center;gap:4px;padding:.15rem .55rem;border-radius:99px;font-size:.65rem;font-weight:600;margin:1px}
.ficha-card{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.ficha-card.nao-lida{border-color:#3b82f6}
.ficha-card h3{font-size:.9rem;font-weight:600;color:#f8fafc;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem}
.ficha-section{margin-bottom:.875rem}
.ficha-section .label{font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem}
.ficha-section .value{font-size:.82rem;color:#cbd5e1;line-height:1.6;white-space:pre-wrap}
.ficha-ia{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:1rem;margin-top:.75rem;font-size:.8rem;color:#cbd5e1;line-height:1.7;white-space:pre-wrap;max-height:400px;overflow-y:auto}
.bubble-user{background:#1e3a5f;border-radius:12px 12px 2px 12px;padding:.75rem 1rem;max-width:78%;margin-left:auto;margin-bottom:.75rem;font-size:.8rem;white-space:pre-wrap;line-height:1.6;border:1px solid #2d4f7c}
.bubble-ai{background:#1a2436;border:1px solid #334155;border-radius:2px 12px 12px 12px;padding:.75rem 1rem;max-width:85%;margin-bottom:.75rem;font-size:.8rem;white-space:pre-wrap;line-height:1.6}
.msg-meta{font-size:.65rem;color:#475569;margin-bottom:.2rem}
.msgs{padding:1.25rem;display:flex;flex-direction:column;max-height:600px;overflow-y:auto}
.search-bar{display:flex;gap:.5rem;padding:.875rem 1.25rem;border-bottom:1px solid #334155;flex-wrap:wrap}
.search-bar input,.search-bar select{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.45rem .75rem;color:#e2e8f0;font-size:.8rem}
.search-bar input{flex:1;min-width:140px}
.btn-sm{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:.35rem .75rem;cursor:pointer;font-size:.75rem;font-weight:500;text-decoration:none;display:inline-block}
.btn-sm:hover{opacity:.85;text-decoration:none;color:#fff}
.btn-danger{background:#dc2626} .btn-ghost{background:#334155;color:#94a3b8}
.btn-success{background:#059669} .btn-purple{background:#7c3aed}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center}
.login-box{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem;width:380px}
.login-box h2{font-size:1.15rem;font-weight:700;margin-bottom:1.5rem;color:#f8fafc;text-align:center}
.form-group{margin-bottom:1rem}
.form-group label{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:.35rem;font-weight:500}
.form-group input,.form-group select{width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.6rem .75rem;color:#e2e8f0;font-size:.875rem}
.form-group input:focus,.form-group select:focus{outline:none;border-color:#3b82f6}
.btn-full{width:100%;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:.75rem;font-size:.875rem;font-weight:500;cursor:pointer;margin-top:.5rem}
.erro{background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:.75rem;color:#fca5a5;font-size:.78rem;margin-bottom:1rem;text-align:center}
.sucesso{background:#064e3b;border:1px solid #065f46;border-radius:8px;padding:.75rem;color:#6ee7b7;font-size:.78rem;margin-bottom:1rem;text-align:center}
.highlight{background:#422006;padding:.1rem .2rem;border-radius:3px;color:#fbbf24}
.flex{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
.tag-check{display:inline-flex;align-items:center;gap:5px;padding:.3rem .75rem;border-radius:99px;font-size:.72rem;cursor:pointer;border:1.5px solid transparent;user-select:none}
.tag-check input{display:none}
.empty{padding:2.5rem;text-align:center;color:#475569;font-size:.85rem}
.urgencia-alta{color:#f87171;font-weight:600}
.urgencia-normal{color:#34d399}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:700px){.grid-2{grid-template-columns:1fr}}
`;

function layout(titulo, conteudo, usuario, fichasNaoLidas = 0) {
  const isAdmin = usuario?.role === 'admin';
  const badgeFichas = fichasNaoLidas > 0
    ? `<span class="notif-badge">${fichasNaoLidas}</span>` : '';
  return `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${titulo} — Jurídico IA</title><style>${CSS}</style></head><body>
    <nav class="nav">
      <div class="nav-logo">⚖️ Jurídico IA</div>
      <a href="/painel">Dashboard</a>
      <a href="/painel/fichas" style="position:relative">Triagens${badgeFichas}</a>
      <a href="/painel/conversas">Conversas</a>
      <a href="/painel/busca">Busca</a>
      ${isAdmin ? '<a href="/painel/usuarios">Usuários</a><a href="/painel/autorizados">Autorizados</a>' : ''}
      <span class="user-badge">${esc(usuario?.nome||'')}</span>
      <a href="/painel/perfil">Perfil</a>
      <a href="/painel/logout">Sair</a>
    </nav>
    <div class="container">${conteudo}</div>
  </body></html>`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  const erros = { credenciais:'Email ou senha incorretos.', campos:'Preencha todos os campos.' };
  const erro  = erros[req.query.erro] || '';
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Login</title><style>${CSS}</style></head><body>
    <div class="login-wrap"><div class="login-box">
      <h2>⚖️ Assistente Jurídico IA</h2>
      ${erro?`<div class="erro">${erro}</div>`:''}
      <form method="POST" action="/painel/login">
        <div class="form-group"><label>Email</label><input name="email" type="email" autofocus required></div>
        <div class="form-group"><label>Senha</label><input name="senha" type="password" required></div>
        <button class="btn-full" type="submit">Entrar</button>
      </form>
    </div></div></body></html>`);
});
router.post('/login', auth.login);
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/painel/login'); });

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/', autenticado, async (req, res) => {
  const [stats, conversas, fichas] = await Promise.all([
    db.getEstatisticas(),
    db.listarConversas({ limite: 10 }),
    db.listarFichas(true)
  ]);

  const linhasConv = conversas.map(c => {
    const tagsHtml = (c.tags||[]).map(t =>
      `<span class="tag" style="background:${t.cor}22;color:${t.cor};border:1px solid ${t.cor}44">${esc(t.nome)}</span>`).join('');
    const tipoBadge = c.tipo === 'triagem'
      ? '<span class="badge badge-purple">Cliente</span>'
      : '<span class="badge badge-blue">Interno</span>';
    return `<tr>
      <td><a href="/painel/conversa/${c.id}">#${c.id}</a></td>
      <td>${tipoBadge}</td>
      <td>${esc(c.numero)}</td><td>${esc(c.nome||'—')}</td>
      <td>${tagsHtml||'—'}</td><td>${c.total_msgs}</td>
      <td>${new Date(c.iniciada_em).toLocaleString('pt-BR')}</td>
    </tr>`;
  }).join('');

  const fichasHtml = fichas.slice(0,3).map(f => `
    <div class="ficha-card nao-lida">
      <h3>🆕 ${esc(f.nome_cliente||'Sem nome')}
        <span class="badge ${f.urgencia==='alta'?'badge-red':'badge-green'}">${f.urgencia==='alta'?'URGENTE':'Normal'}</span>
        <a href="/painel/fichas/${f.conversa_id}" class="btn-sm" style="margin-left:auto;font-size:.7rem">Ver ficha →</a>
      </h3>
      <div class="flex">
        <span class="badge badge-purple">${esc(f.area_direito||'A identificar')}</span>
        <span style="font-size:.75rem;color:#64748b">${esc(f.telefone)}</span>
        <span style="font-size:.75rem;color:#64748b">${new Date(f.criado_em).toLocaleString('pt-BR')}</span>
      </div>
    </div>`).join('');

  res.send(layout('Dashboard', `
    <p class="page-title">Dashboard</p>
    <div class="cards">
      <div class="card"><div class="label">Clientes externos</div><div class="value">${stats.clientes_externos}</div></div>
      <div class="card ${stats.fichas_nao_lidas>0?'destaque':''}">
        <div class="label">Triagens pendentes</div>
        <div class="value">${stats.fichas_nao_lidas}</div>
        <div class="sub">Aguardando análise</div>
      </div>
      <div class="card"><div class="label">Conversas</div><div class="value">${stats.total_conversas}</div>
        <div class="sub">${stats.conversas_semana} esta semana</div></div>
      <div class="card"><div class="label">Mensagens</div><div class="value">${stats.total_mensagens}</div></div>
      <div class="card"><div class="label">Tokens usados</div><div class="value">${Number(stats.total_tokens).toLocaleString('pt-BR')}</div></div>
    </div>
    ${fichasHtml ? `<div class="section">
      <div class="section-header"><h2>🆕 Triagens não lidas</h2>
        <a href="/painel/fichas" class="btn-sm">Ver todas →</a></div>
      <div style="padding:1rem">${fichasHtml}</div>
    </div>` : ''}
    <div class="section">
      <div class="section-header"><h2>Conversas recentes</h2>
        <a href="/painel/conversas" style="font-size:.78rem;color:#60a5fa">Ver todas →</a></div>
      <table><thead><tr><th>#</th><th>Tipo</th><th>Número</th><th>Nome</th><th>Áreas</th><th>Msgs</th><th>Início</th></tr></thead>
      <tbody>${linhasConv||'<tr><td colspan="7" class="empty">Sem conversas.</td></tr>'}</tbody></table>
    </div>
  `, req.session.usuario, parseInt(stats.fichas_nao_lidas)));
});

// ─── FICHAS DE TRIAGEM ────────────────────────────────────────────────────────
router.get('/fichas', autenticado, async (req, res) => {
  const { naoLidas } = req.query;
  const fichas = await db.listarFichas(naoLidas === '1');
  const naoLidasCount = await db.contarFichasNaoLidas();

  const cards = fichas.map(f => `
    <div class="ficha-card ${!f.lida?'nao-lida':''}">
      <h3>
        ${!f.lida?'🆕 ':''}${esc(f.nome_cliente||'Sem nome')}
        <span class="badge ${f.urgencia==='alta'?'badge-red':'badge-green'}">${f.urgencia==='alta'?'🔴 URGENTE':'Normal'}</span>
        <span class="badge badge-purple" style="margin-left:.25rem">${esc(f.area_direito||'A identificar')}</span>
        <a href="/painel/fichas/${f.conversa_id}" class="btn-sm" style="margin-left:auto">Ver detalhes →</a>
      </h3>
      <div class="flex" style="margin-bottom:.5rem">
        <span style="font-size:.78rem;color:#94a3b8">📱 ${esc(f.telefone)}</span>
        <span style="font-size:.78rem;color:#64748b">•</span>
        <span style="font-size:.78rem;color:#64748b">${new Date(f.criado_em).toLocaleString('pt-BR')}</span>
      </div>
      <div class="ficha-section">
        <div class="label">Resumo dos fatos</div>
        <div class="value">${esc((f.resumo_fatos||'').substring(0,200))}${(f.resumo_fatos||'').length>200?'...':''}</div>
      </div>
    </div>`).join('') || '<div class="empty">Nenhuma ficha encontrada.</div>';

  res.send(layout('Triagens', `
    <div class="flex" style="margin-bottom:1.25rem">
      <p class="page-title" style="margin:0">Triagens de Clientes</p>
      <a href="/painel/fichas" class="btn-sm btn-ghost" style="margin-left:auto">Todas</a>
      <a href="/painel/fichas?naoLidas=1" class="btn-sm">Não lidas (${naoLidasCount})</a>
    </div>
    ${cards}
  `, req.session.usuario, naoLidasCount));
});

// ─── FICHA INDIVIDUAL ─────────────────────────────────────────────────────────
router.get('/fichas/:conversaId', autenticado, async (req, res) => {
  const cid = parseInt(req.params.conversaId);
  const [ficha, msgs] = await Promise.all([
    db.getFicha(cid),
    db.getMensagensConversa(cid)
  ]);

  if (!ficha) return res.redirect('/painel/fichas');
  await db.marcarFichaLida(cid);
  const naoLidas = await db.contarFichasNaoLidas();

  const bubbles = msgs.map(m => {
    const hora = new Date(m.criado_em).toLocaleString('pt-BR');
    if (m.role === 'user') return `<div>
      <div class="msg-meta" style="text-align:right">Cliente · ${hora}</div>
      <div class="bubble-user">${esc(m.conteudo)}</div></div>`;
    return `<div>
      <div class="msg-meta">⚖️ Assistente · ${hora}</div>
      <div class="bubble-ai">${esc(m.conteudo)}</div></div>`;
  }).join('');

  res.send(layout(`Ficha — ${ficha.nome_cliente||ficha.telefone}`, `
    <div class="flex" style="margin-bottom:1rem">
      <a href="/painel/fichas">← Triagens</a>
      <a href="/painel/conversa/${cid}/pdf" target="_blank" class="btn-sm btn-purple" style="margin-left:auto">⬇ Exportar PDF</a>
    </div>
    <div class="grid-2">
      <div>
        <div class="section">
          <div class="section-header"><h2>Dados do cliente</h2></div>
          <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">
            <div class="ficha-section"><div class="label">Nome</div><div class="value">${esc(ficha.nome_cliente||'Não informado')}</div></div>
            <div class="ficha-section"><div class="label">Telefone</div><div class="value">${esc(ficha.telefone)}</div></div>
            <div class="ficha-section"><div class="label">Área jurídica</div><div class="value"><span class="badge badge-purple">${esc(ficha.area_direito||'A identificar')}</span></div></div>
            <div class="ficha-section"><div class="label">Urgência</div>
              <div class="value ${ficha.urgencia==='alta'?'urgencia-alta':'urgencia-normal'}">${ficha.urgencia==='alta'?'🔴 ALTA':'🟢 Normal'}</div></div>
            <div class="ficha-section"><div class="label">Recebido em</div><div class="value">${new Date(ficha.criado_em).toLocaleString('pt-BR')}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-header"><h2>Informações relatadas</h2></div>
          <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">
            <div class="ficha-section"><div class="label">Fatos</div><div class="value">${esc(ficha.resumo_fatos||'Não informado')}</div></div>
            <div class="ficha-section"><div class="label">Documentos disponíveis</div><div class="value">${esc(ficha.documentos||'Não informado')}</div></div>
          </div>
        </div>
      </div>
      <div>
        <div class="section">
          <div class="section-header"><h2>🤖 Análise da IA</h2></div>
          <div style="padding:1rem">
            <div class="ficha-ia">${esc(ficha.resumo_ia||'Análise não disponível.')}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header"><h2>Conversa de triagem</h2><span style="font-size:.75rem;color:#64748b">${msgs.length} mensagens</span></div>
      <div class="msgs">${bubbles||'<div class="empty">Sem mensagens.</div>'}</div>
    </div>
  `, req.session.usuario, naoLidas));
});

// ─── CONVERSAS ────────────────────────────────────────────────────────────────
router.get('/conversas', autenticado, async (req, res) => {
  const { tag, numero, tipo, pagina = 0 } = req.query;
  const [conversas, tags, naoLidas] = await Promise.all([
    db.listarConversas({ tagId: tag, numero, tipo, limite: 30, pagina: parseInt(pagina) }),
    db.listarTags(),
    db.contarFichasNaoLidas()
  ]);

  const tagsFilter = tags.map(t =>
    `<a href="/painel/conversas?tag=${t.id}" style="text-decoration:none">
      <span class="tag" style="background:${tag==t.id?t.cor+'33':'#1e293b'};color:${t.cor};border:1px solid ${t.cor}55;cursor:pointer">${esc(t.nome)}</span>
    </a>`).join('');

  const linhas = conversas.map(c => {
    const tagsHtml = (c.tags||[]).map(t =>
      `<span class="tag" style="background:${t.cor}22;color:${t.cor};border:1px solid ${t.cor}44">${esc(t.nome)}</span>`).join('');
    const tipoBadge = c.tipo === 'triagem'
      ? '<span class="badge badge-purple">Cliente</span>'
      : '<span class="badge badge-blue">Interno</span>';
    return `<tr>
      <td><a href="/painel/${c.tipo==='triagem'?'fichas':'conversa'}/${c.id}">#${c.id}</a></td>
      <td>${tipoBadge}</td><td>${esc(c.numero)}</td><td>${esc(c.nome||'—')}</td>
      <td>${tagsHtml||'—'}</td><td>${c.total_msgs}</td>
      <td>${new Date(c.iniciada_em).toLocaleString('pt-BR')}</td>
      <td>${c.status==='encerrada'?'<span class="badge badge-gray">Encerrada</span>':c.status==='triagem_completa'?'<span class="badge badge-purple">Triagem ok</span>':'<span class="badge badge-green">Ativa</span>'}</td>
    </tr>`;
  }).join('');

  res.send(layout('Conversas', `
    <p class="page-title">Conversas</p>
    <div class="section">
      <form class="search-bar" method="GET" action="/painel/conversas">
        <input name="numero" value="${esc(numero||'')}" placeholder="Filtrar por número...">
        <select name="tipo"><option value="">Todos os tipos</option>
          <option value="interno" ${tipo==='interno'?'selected':''}>Interno (advogado)</option>
          <option value="triagem" ${tipo==='triagem'?'selected':''}>Triagem (cliente)</option>
        </select>
        <button type="submit" class="btn-sm">Filtrar</button>
        ${numero||tag||tipo?`<a href="/painel/conversas"><button type="button" class="btn-sm btn-ghost">Limpar</button></a>`:''}
      </form>
      <div style="padding:.75rem 1.25rem;display:flex;gap:.4rem;flex-wrap:wrap;border-bottom:1px solid #334155">
        <a href="/painel/conversas" style="text-decoration:none"><span class="badge badge-gray" style="cursor:pointer;padding:.25rem .65rem">Todas</span></a>
        ${tagsFilter}
      </div>
      ${linhas?`<table><thead><tr><th>#</th><th>Tipo</th><th>Número</th><th>Nome</th><th>Áreas</th><th>Msgs</th><th>Início</th><th>Status</th></tr></thead>
      <tbody>${linhas}</tbody></table>`:'<div class="empty">Nenhuma conversa encontrada.</div>'}
    </div>
  `, req.session.usuario, naoLidas));
});

// ─── CONVERSA INDIVIDUAL ──────────────────────────────────────────────────────
router.get('/conversa/:id', autenticado, async (req, res) => {
  const id = parseInt(req.params.id);
  const [msgs, tags, todasTags, naoLidas] = await Promise.all([
    db.getMensagensConversa(id), db.getTagsConversa(id),
    db.listarTags(), db.contarFichasNaoLidas()
  ]);
  const conv = (await db.listarConversas({ limite: 999 })).find(c => c.id == id) || {};
  const tagIds = new Set(tags.map(t => t.id));
  const tagCheckboxes = todasTags.map(t => `
    <label class="tag-check" style="background:${tagIds.has(t.id)?t.cor+'33':'#1e293b'};color:${t.cor};border-color:${tagIds.has(t.id)?t.cor:'#334155'};cursor:pointer">
      <input type="checkbox" ${tagIds.has(t.id)?'checked':''} onchange="toggleTag(${id},${t.id},this.checked)">
      ${esc(t.nome)}
    </label>`).join('');

  const bubbles = msgs.map(m => {
    const hora = new Date(m.criado_em).toLocaleString('pt-BR');
    if (m.role === 'user') return `<div>
      <div class="msg-meta" style="text-align:right">Cliente · ${hora}</div>
      <div class="bubble-user">${esc(m.conteudo)}</div></div>`;
    return `<div>
      <div class="msg-meta">⚖️ IA · ${hora} · ${m.tokens_usados} tokens</div>
      <div class="bubble-ai">${esc(m.conteudo)}</div></div>`;
  }).join('');

  res.send(layout(`Conversa #${id}`, `
    <div class="flex" style="margin-bottom:1rem">
      <a href="/painel/conversas">← Conversas</a>
      <a href="/painel/conversa/${id}/pdf" target="_blank" class="btn-sm btn-purple" style="margin-left:auto">⬇ PDF</a>
    </div>
    <div class="section" style="margin-bottom:1rem">
      <div class="section-header"><h2>Tags</h2></div>
      <div style="padding:.875rem 1.25rem;display:flex;gap:.4rem;flex-wrap:wrap">${tagCheckboxes}</div>
    </div>
    <div class="section">
      <div class="section-header"><h2>Conversa #${id} — ${esc(conv.numero||'')} ${conv.nome?'('+esc(conv.nome)+')':''}</h2>
        <span style="font-size:.75rem;color:#64748b">${msgs.length} mensagens</span>
      </div>
      <div class="msgs">${bubbles||'<div class="empty">Sem mensagens.</div>'}</div>
    </div>
    <script>
    async function toggleTag(cid,tid,add){
      await fetch('/painel/api/conversa/'+cid+'/tag/'+tid,{method:add?'POST':'DELETE'});
    }
    </script>
  `, req.session.usuario, naoLidas));
});

// ─── PDF ──────────────────────────────────────────────────────────────────────
router.get('/conversa/:id/pdf', autenticado, async (req, res) => {
  const id = parseInt(req.params.id);
  const [msgs, tags, conversas] = await Promise.all([
    db.getMensagensConversa(id), db.getTagsConversa(id),
    db.listarConversas({ limite: 999 })
  ]);
  const conv = conversas.find(c => c.id == id) || { id, numero: '—' };
  try {
    const pdfBytes = await gerarPDFConversa(conv, msgs, tags);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="conversa-${id}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(500).send('Erro ao gerar PDF.');
  }
});

// ─── API TAGS ──────────────────────────────────────────────────────────────────
router.post('/api/conversa/:id/tag/:tagId', autenticado, async (req, res) => {
  await db.adicionarTagConversa(parseInt(req.params.id), parseInt(req.params.tagId));
  res.json({ ok: true });
});
router.delete('/api/conversa/:id/tag/:tagId', autenticado, async (req, res) => {
  await db.removerTagConversa(parseInt(req.params.id), parseInt(req.params.tagId));
  res.json({ ok: true });
});

// ─── BUSCA ────────────────────────────────────────────────────────────────────
router.get('/busca', autenticado, async (req, res) => {
  const { q } = req.query;
  const [resultados, naoLidas] = await Promise.all([
    q ? db.buscarMensagens(q) : [],
    db.contarFichasNaoLidas()
  ]);
  const hl = (t, q) => !q ? esc(t) :
    esc(t).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
      '<span class="highlight">$1</span>');
  const linhas = resultados.map(r => `<tr>
    <td><a href="/painel/conversa/${r.conversa_id}">#${r.conversa_id}</a></td>
    <td>${esc(r.numero)}</td>
    <td><span class="badge ${r.role==='user'?'badge-blue':'badge-green'}">${r.role==='user'?'Cliente':'IA'}</span></td>
    <td style="max-width:400px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${hl(r.conteudo.substring(0,200),q)}</td>
    <td>${new Date(r.criado_em).toLocaleString('pt-BR')}</td>
  </tr>`).join('');
  res.send(layout('Busca', `
    <p class="page-title">Busca</p>
    <div class="section">
      <form class="search-bar" method="GET" action="/painel/busca">
        <input name="q" value="${esc(q||'')}" placeholder="Buscar em todas as mensagens..." autofocus style="flex:1">
        <button type="submit" class="btn-sm">Buscar</button>
      </form>
      ${q?`<div style="padding:.625rem 1.25rem;font-size:.75rem;color:#64748b">${resultados.length} resultado(s) para "${esc(q)}"</div>
        <table><thead><tr><th>Conversa</th><th>Número</th><th>Origem</th><th>Trecho</th><th>Data</th></tr></thead>
        <tbody>${linhas}</tbody></table>`:'<div class="empty">Digite um termo para buscar.</div>'}
    </div>
  `, req.session.usuario, naoLidas));
});

// ─── NÚMEROS AUTORIZADOS ──────────────────────────────────────────────────────
router.get('/autorizados', autenticado, apenasAdmin, async (req, res) => {
  const [numeros, naoLidas] = await Promise.all([
    db.listarNumerosAutorizados(), db.contarFichasNaoLidas()
  ]);
  const msg = req.query.ok ? '<div class="sucesso">Operação realizada.</div>' :
              req.query.erro ? '<div class="erro">Erro. Tente novamente.</div>' : '';
  const linhas = numeros.map(n => `<tr>
    <td>${esc(n.numero)}</td><td>${esc(n.nome||'—')}</td>
    <td>${new Date(n.criado_em).toLocaleString('pt-BR')}</td>
    <td><form method="POST" action="/painel/autorizados/${n.id}/deletar" onsubmit="return confirm('Remover?')">
      <button class="btn-sm btn-danger" type="submit">Remover</button>
    </form></td>
  </tr>`).join('');
  res.send(layout('Números Autorizados', `
    <p class="page-title">Números Autorizados (Advogados)</p>
    ${msg}
    <div class="section" style="margin-bottom:1.25rem">
      <div class="section-header"><h2>Adicionar número</h2></div>
      <form method="POST" action="/painel/autorizados/adicionar"
        style="padding:1.25rem;display:grid;grid-template-columns:1fr 1fr auto;gap:.75rem;align-items:end">
        <div class="form-group" style="margin:0"><label>Número (com DDI, ex: 5511999999999)</label>
          <input name="numero" required placeholder="5511999999999"></div>
        <div class="form-group" style="margin:0"><label>Nome (opcional)</label>
          <input name="nome" placeholder="Dr. João Silva"></div>
        <button class="btn-sm btn-success" type="submit" style="height:35px">Adicionar</button>
      </form>
    </div>
    <div class="section">
      <div class="section-header"><h2>Números cadastrados</h2>
        <span style="font-size:.75rem;color:#64748b">Apenas estes números têm acesso ao modo advogado</span>
      </div>
      ${linhas?`<table><thead><tr><th>Número</th><th>Nome</th><th>Adicionado em</th><th>Ação</th></tr></thead>
      <tbody>${linhas}</tbody></table>`:'<div class="empty">Nenhum número autorizado. Adicione o número do advogado acima.</div>'}
    </div>
  `, req.session.usuario, naoLidas));
});

router.post('/autorizados/adicionar', autenticado, apenasAdmin, async (req, res) => {
  try {
    const { numero, nome } = req.body;
    if (!numero) return res.redirect('/painel/autorizados?erro=1');
    await db.adicionarNumeroAutorizado(numero.replace(/\D/g,''), nome);
    res.redirect('/painel/autorizados?ok=1');
  } catch { res.redirect('/painel/autorizados?erro=1'); }
});

router.post('/autorizados/:id/deletar', autenticado, apenasAdmin, async (req, res) => {
  await db.removerNumeroAutorizado(req.params.id);
  res.redirect('/painel/autorizados?ok=1');
});

// ─── USUÁRIOS ─────────────────────────────────────────────────────────────────
router.get('/usuarios', autenticado, apenasAdmin, async (req, res) => {
  const [usuarios, naoLidas] = await Promise.all([db.listarUsuarios(), db.contarFichasNaoLidas()]);
  const msg = req.query.ok ? '<div class="sucesso">Operação realizada.</div>' :
              req.query.erro ? '<div class="erro">Erro. Tente novamente.</div>' : '';
  const linhas = usuarios.map(u => `<tr>
    <td>${esc(u.nome)}</td><td>${esc(u.email)}</td>
    <td><span class="badge ${u.role==='admin'?'badge-yellow':'badge-blue'}">${u.role}</span></td>
    <td>${esc(u.numero_whats||'—')}</td>
    <td>${u.ativo?'<span class="badge badge-green">Ativo</span>':'<span class="badge badge-red">Inativo</span>'}</td>
    <td>${u.ultimo_login?new Date(u.ultimo_login).toLocaleString('pt-BR'):'—'}</td>
    <td><div class="flex">
      <form method="POST" action="/painel/usuarios/${u.id}/toggle">
        <button class="btn-sm ${u.ativo?'btn-danger':'btn-success'}" type="submit">${u.ativo?'Desativar':'Ativar'}</button>
      </form>
      <form method="POST" action="/painel/usuarios/${u.id}/deletar" onsubmit="return confirm('Excluir?')">
        <button class="btn-sm btn-danger" type="submit">Excluir</button>
      </form>
    </div></td>
  </tr>`).join('');
  res.send(layout('Usuários', `
    <p class="page-title">Usuários do Painel</p>${msg}
    <div class="section" style="margin-bottom:1.25rem">
      <div class="section-header"><h2>Novo usuário</h2></div>
      <form method="POST" action="/painel/usuarios/criar"
        style="padding:1.25rem;display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto auto;gap:.75rem;align-items:end">
        <div class="form-group" style="margin:0"><label>Nome</label><input name="nome" required></div>
        <div class="form-group" style="margin:0"><label>Email</label><input name="email" type="email" required></div>
        <div class="form-group" style="margin:0"><label>Senha</label><input name="senha" type="password" required></div>
        <div class="form-group" style="margin:0"><label>WhatsApp (notificações)</label><input name="numero_whats" placeholder="5511999999999"></div>
        <div class="form-group" style="margin:0"><label>Perfil</label>
          <select name="role"><option value="advogado">Advogado</option><option value="admin">Admin</option></select></div>
        <button class="btn-sm btn-success" type="submit" style="height:35px">Criar</button>
      </form>
    </div>
    <div class="section">
      <div class="section-header"><h2>Usuários cadastrados</h2></div>
      <table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>WhatsApp</th><th>Status</th><th>Último login</th><th>Ações</th></tr></thead>
      <tbody>${linhas}</tbody></table>
    </div>
  `, req.session.usuario, naoLidas));
});

router.post('/usuarios/criar', autenticado, apenasAdmin, async (req, res) => {
  try {
    const { nome, email, senha, role, numero_whats } = req.body;
    if (!nome||!email||!senha) return res.redirect('/painel/usuarios?erro=1');
    const hash = await hashSenha(senha);
    await db.criarUsuario(nome, email.toLowerCase(), hash, role||'advogado', numero_whats||null);
    res.redirect('/painel/usuarios?ok=1');
  } catch { res.redirect('/painel/usuarios?erro=1'); }
});

router.post('/usuarios/:id/toggle', autenticado, apenasAdmin, async (req, res) => {
  await db.toggleUsuario(req.params.id); res.redirect('/painel/usuarios?ok=1');
});
router.post('/usuarios/:id/deletar', autenticado, apenasAdmin, async (req, res) => {
  await db.deletarUsuario(req.params.id); res.redirect('/painel/usuarios?ok=1');
});

// ─── PERFIL ───────────────────────────────────────────────────────────────────
router.get('/perfil', autenticado, async (req, res) => {
  const naoLidas = await db.contarFichasNaoLidas();
  const msg = req.query.ok ? '<div class="sucesso">Senha alterada com sucesso.</div>' :
              req.query.erro ? '<div class="erro">Senha atual incorreta ou nova senha inválida.</div>' : '';
  res.send(layout('Perfil', `
    <p class="page-title">Meu Perfil</p>${msg}
    <div class="section" style="max-width:420px">
      <div class="section-header"><h2>Alterar senha</h2></div>
      <form method="POST" action="/painel/perfil/senha" style="padding:1.25rem;display:flex;flex-direction:column;gap:.875rem">
        <div class="form-group" style="margin:0"><label>Senha atual</label><input name="atual" type="password" required></div>
        <div class="form-group" style="margin:0"><label>Nova senha</label><input name="nova" type="password" required></div>
        <div class="form-group" style="margin:0"><label>Confirmar nova senha</label><input name="confirma" type="password" required></div>
        <button class="btn-full" type="submit">Alterar senha</button>
      </form>
    </div>
  `, req.session.usuario, naoLidas));
});

router.post('/perfil/senha', autenticado, async (req, res) => {
  const { atual, nova, confirma } = req.body;
  if (nova !== confirma || nova.length < 8) return res.redirect('/painel/perfil?erro=1');
  const bcrypt  = require('bcryptjs');
  const usuario = await db.buscarUsuarioPorEmail(req.session.usuario.email);
  const ok = await bcrypt.compare(atual, usuario.senha_hash);
  if (!ok) return res.redirect('/painel/perfil?erro=1');
  await db.atualizarSenha(req.session.usuario.id, await hashSenha(nova));
  res.redirect('/painel/perfil?ok=1');
});

module.exports = router;
