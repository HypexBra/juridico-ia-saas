const express  = require('express');
const router   = express.Router();
const modelos  = require('./modelos');
const { autenticado } = require('./auth');

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const AREAS = ['Trabalhista','Cível','Penal','Tributário','Consumidor','Família','Empresarial','Previdenciário','Administrativo','LGPD'];
const TIPOS = ['Petição inicial','Contestação','Recurso','Habeas Corpus','Mandado de Segurança','Tutela de urgência','Contrato','Notificação','Parecer','Outro'];

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0f172a;color:#e2e8f0}
a{color:#60a5fa;text-decoration:none}.container{max-width:1200px;margin:0 auto;padding:1.5rem}
.section{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:1.25rem}
.section-header{padding:.875rem 1.25rem;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between}
.section-header h2{font-size:.875rem;font-weight:600;color:#f8fafc}
.form-group{margin-bottom:.875rem}.form-group label{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:.3rem}
.form-group input,.form-group select,.form-group textarea{width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.6rem .75rem;color:#e2e8f0;font-size:.85rem}
.form-group textarea{min-height:200px;font-family:monospace;resize:vertical}
.btn{padding:.45rem .875rem;border:none;border-radius:8px;cursor:pointer;font-size:.8rem;font-weight:500;text-decoration:none;display:inline-block}
.btn-blue{background:#2563eb;color:#fff}.btn-red{background:#dc2626;color:#fff}.btn-gray{background:#334155;color:#94a3b8}
.btn:hover{opacity:.85}.badge{display:inline-block;padding:.15rem .55rem;border-radius:99px;font-size:.65rem;font-weight:600}
table{width:100%;border-collapse:collapse}th{padding:.625rem 1rem;text-align:left;font-size:.7rem;color:#64748b;text-transform:uppercase;border-bottom:1px solid #334155}
td{padding:.625rem 1rem;font-size:.8rem;border-bottom:1px solid #1a2436;color:#cbd5e1;vertical-align:middle}
tr:last-child td{border-bottom:none}.sucesso{background:#064e3b;border:1px solid #065f46;border-radius:8px;padding:.75rem;color:#6ee7b7;font-size:.78rem;margin-bottom:1rem}
.erro{background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:.75rem;color:#fca5a5;font-size:.78rem;margin-bottom:1rem}
.empty{padding:2.5rem;text-align:center;color:#475569}`;

router.get('/', autenticado, async (req, res) => {
  const { area } = req.query;
  const lista = await modelos.listarModelos(area || null);
  const msg   = req.query.ok ? '<div class="sucesso">Operação realizada com sucesso.</div>' :
                req.query.erro ? '<div class="erro">Erro. Verifique os campos.</div>' : '';

  const filtros = AREAS.map(a =>
    `<a href="/painel/modelos?area=${a}" style="text-decoration:none">
      <span class="badge" style="background:${area===a?'#1e3a5f':'#1e293b'};color:${area===a?'#60a5fa':'#64748b'};border:1px solid #334155;cursor:pointer;padding:.2rem .6rem">${a}</span>
    </a>`).join('');

  const linhas = lista.map(m => `<tr>
    <td><strong style="color:#f8fafc">${esc(m.nome)}</strong></td>
    <td><span class="badge" style="background:#1e3a5f;color:#60a5fa">${esc(m.area||'—')}</span></td>
    <td>${esc(m.tipo||'—')}</td>
    <td>${m.uso_count}x</td>
    <td style="max-width:250px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#64748b">${esc(m.descricao||'')}</td>
    <td><div style="display:flex;gap:.4rem">
      <a href="/painel/modelos/${m.id}" class="btn btn-gray">Ver</a>
      <a href="/painel/modelos/${m.id}/editar" class="btn btn-blue">Editar</a>
      <form method="POST" action="/painel/modelos/${m.id}/deletar" onsubmit="return confirm('Excluir?')" style="margin:0">
        <button class="btn btn-red" type="submit">Excluir</button>
      </form>
    </div></td>
  </tr>`).join('');

  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Modelos</title><style>${CSS}</style></head><body>
  <div class="container">
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <a href="/painel">← Painel</a>
      <h1 style="font-size:1.1rem;font-weight:600;color:#f8fafc;margin:0">📚 Biblioteca de Modelos</h1>
      <a href="/painel/modelos/novo" class="btn btn-blue" style="margin-left:auto">+ Novo modelo</a>
    </div>
    ${msg}
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem">
      <a href="/painel/modelos" style="text-decoration:none">
        <span class="badge" style="background:${!area?'#1e3a5f':'#1e293b'};color:${!area?'#60a5fa':'#64748b'};border:1px solid #334155;cursor:pointer;padding:.2rem .6rem">Todos</span>
      </a>${filtros}
    </div>
    <div class="section">
      <div class="section-header"><h2>Modelos (${lista.length})</h2></div>
      ${linhas?`<table><thead><tr><th>Nome</th><th>Área</th><th>Tipo</th><th>Usos</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>`:'<div class="empty">Nenhum modelo cadastrado. <a href="/painel/modelos/novo">Criar o primeiro →</a></div>'}
    </div>
  </div></body></html>`);
});

router.get('/novo', autenticado, (req, res) => {
  res.send(formModelo(null));
});

router.get('/:id', autenticado, async (req, res) => {
  const m = await modelos.getModelo(req.params.id);
  if (!m) return res.redirect('/painel/modelos');
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(m.nome)}</title><style>${CSS}</style></head><body>
  <div class="container">
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <a href="/painel/modelos">← Modelos</a>
      <a href="/painel/modelos/${m.id}/editar" class="btn btn-blue" style="margin-left:auto">Editar</a>
    </div>
    <div class="section">
      <div class="section-header"><h2>${esc(m.nome)}</h2></div>
      <div style="padding:1.25rem">
        <div style="display:flex;gap:.5rem;margin-bottom:1rem">
          <span class="badge" style="background:#1e3a5f;color:#60a5fa">${esc(m.area||'—')}</span>
          <span class="badge" style="background:#1e293b;color:#94a3b8">${esc(m.tipo||'—')}</span>
          <span style="font-size:.75rem;color:#64748b">Usado ${m.uso_count}x</span>
        </div>
        ${m.descricao?`<p style="font-size:.82rem;color:#94a3b8;margin-bottom:1rem">${esc(m.descricao)}</p>`:''}
        <pre style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:1rem;font-size:.8rem;white-space:pre-wrap;line-height:1.6;overflow-y:auto;max-height:500px">${esc(m.conteudo)}</pre>
      </div>
    </div>
  </div></body></html>`);
});

router.get('/:id/editar', autenticado, async (req, res) => {
  const m = await modelos.getModelo(req.params.id);
  if (!m) return res.redirect('/painel/modelos');
  res.send(formModelo(m));
});

router.post('/criar', autenticado, async (req, res) => {
  try {
    const { nome, area, tipo, descricao, conteudo } = req.body;
    if (!nome || !conteudo) return res.redirect('/painel/modelos/novo?erro=1');
    await modelos.criarModelo({ nome, area, tipo, descricao, conteudo, criadoPor: req.session.usuario.id });
    res.redirect('/painel/modelos?ok=1');
  } catch { res.redirect('/painel/modelos/novo?erro=1'); }
});

router.post('/:id/atualizar', autenticado, async (req, res) => {
  try {
    const { nome, area, tipo, descricao, conteudo } = req.body;
    await modelos.atualizarModelo(req.params.id, { nome, area, tipo, descricao, conteudo });
    res.redirect('/painel/modelos?ok=1');
  } catch { res.redirect(`/painel/modelos/${req.params.id}/editar?erro=1`); }
});

router.post('/:id/deletar', autenticado, async (req, res) => {
  await modelos.deletarModelo(req.params.id);
  res.redirect('/painel/modelos?ok=1');
});

function formModelo(m) {
  const isEdit = !!m;
  const action = isEdit ? `/painel/modelos/${m.id}/atualizar` : '/painel/modelos/criar';
  const areasOpts = AREAS.map(a => `<option value="${a}" ${m?.area===a?'selected':''}>${a}</option>`).join('');
  const tiposOpts = TIPOS.map(t => `<option value="${t}" ${m?.tipo===t?'selected':''}>${t}</option>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${isEdit?'Editar':'Novo'} Modelo</title><style>${CSS}</style></head><body>
  <div class="container">
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <a href="/painel/modelos">← Modelos</a>
      <h1 style="font-size:1.1rem;font-weight:600;color:#f8fafc;margin:0">${isEdit?'Editar':'Novo'} Modelo</h1>
    </div>
    <div class="section">
      <div class="section-header"><h2>${isEdit?esc(m.nome):'Criar modelo'}</h2></div>
      <form method="POST" action="${action}" style="padding:1.25rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="form-group" style="grid-column:span 2"><label>Nome do modelo *</label>
          <input name="nome" value="${esc(m?.nome||'')}" required placeholder="Ex: Petição Inicial Trabalhista Padrão"></div>
        <div class="form-group"><label>Área jurídica</label>
          <select name="area"><option value="">Selecione...</option>${areasOpts}</select></div>
        <div class="form-group"><label>Tipo de peça</label>
          <select name="tipo"><option value="">Selecione...</option>${tiposOpts}</select></div>
        <div class="form-group" style="grid-column:span 2"><label>Descrição (opcional)</label>
          <input name="descricao" value="${esc(m?.descricao||'')}" placeholder="Quando usar este modelo..."></div>
        <div class="form-group" style="grid-column:span 2"><label>Conteúdo do modelo *</label>
          <textarea name="conteudo" required placeholder="Cole aqui o texto do modelo...">${esc(m?.conteudo||'')}</textarea></div>
        <div style="grid-column:span 2;display:flex;gap:.5rem">
          <button type="submit" class="btn btn-blue">${isEdit?'Salvar alterações':'Criar modelo'}</button>
          <a href="/painel/modelos" class="btn btn-gray">Cancelar</a>
        </div>
      </form>
    </div>
  </div></body></html>`;
}

module.exports = router;
