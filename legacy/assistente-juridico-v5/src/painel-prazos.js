const express = require('express');
const router  = express.Router();
const { criarPrazo, listarPrazos, concluirPrazo, deletarPrazo } = require('./prazos');
const { autenticado } = require('./auth');

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:1.5rem}
a{color:#60a5fa;text-decoration:none}.section{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:1.25rem}
.section-header{padding:.875rem 1.25rem;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between}
.section-header h2{font-size:.875rem;font-weight:600;color:#f8fafc}
.form-group{margin-bottom:.875rem}.form-group label{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:.3rem}
.form-group input{width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.6rem .75rem;color:#e2e8f0;font-size:.85rem}
.btn{padding:.4rem .8rem;border:none;border-radius:8px;cursor:pointer;font-size:.78rem;font-weight:500}
.btn-blue{background:#2563eb;color:#fff}.btn-green{background:#059669;color:#fff}.btn-red{background:#dc2626;color:#fff}
.btn:hover{opacity:.85}table{width:100%;border-collapse:collapse}
th{padding:.625rem 1rem;text-align:left;font-size:.7rem;color:#64748b;text-transform:uppercase;border-bottom:1px solid #334155}
td{padding:.625rem 1rem;font-size:.8rem;border-bottom:1px solid #1a2436;color:#cbd5e1;vertical-align:middle}
tr:last-child td{border-bottom:none}.badge{display:inline-block;padding:.15rem .55rem;border-radius:99px;font-size:.65rem;font-weight:600}
.urgente{color:#f87171;font-weight:600}.sucesso{background:#064e3b;border:1px solid #065f46;border-radius:8px;padding:.75rem;color:#6ee7b7;font-size:.78rem;margin-bottom:1rem}
.empty{padding:2.5rem;text-align:center;color:#475569}`;

router.get('/', autenticado, async (req, res) => {
  const { todos } = req.query;
  const lista = await listarPrazos(null, todos === '1');
  const msg   = req.query.ok ? '<div class="sucesso">Operação realizada!</div>' : '';

  const hoje = new Date(); hoje.setHours(0,0,0,0);

  const linhas = lista.map(p => {
    const vence = new Date(p.data_prazo); vence.setHours(0,0,0,0);
    const dias  = Math.ceil((vence - hoje) / (1000*60*60*24));
    let cor = '#34d399'; let label = `${dias}d`;
    if (dias < 0)  { cor = '#9ca3af'; label = 'Vencido'; }
    if (dias === 0){ cor = '#f87171'; label = 'HOJE'; }
    if (dias === 1){ cor = '#fb923c'; label = 'AMANHÃ'; }
    if (dias <= 3 && dias > 1) { cor = '#fbbf24'; label = `${dias}d`; }
    return `<tr style="${p.concluido?'opacity:.4':''}">
      <td><strong style="color:#f8fafc">${esc(p.titulo)}</strong></td>
      <td>${esc(p.cliente_nome||'—')}</td>
      <td>${esc(p.processo||'—')}</td>
      <td>${new Date(p.data_prazo).toLocaleDateString('pt-BR')}</td>
      <td><span class="badge" style="background:${cor}22;color:${cor};border:1px solid ${cor}44">${label}</span></td>
      <td>${esc(p.nome_usuario||'—')}</td>
      <td><div style="display:flex;gap:.4rem">
        ${!p.concluido?`<form method="POST" action="/painel/prazos/${p.id}/concluir" style="margin:0">
          <button class="btn btn-green" type="submit">✓ Concluir</button>
        </form>`:'<span style="color:#34d399;font-size:.75rem">✓ Concluído</span>'}
        <form method="POST" action="/painel/prazos/${p.id}/deletar" onsubmit="return confirm('Excluir?')" style="margin:0">
          <button class="btn btn-red" type="submit">Excluir</button>
        </form>
      </div></td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Prazos</title><style>${CSS}</style></head><body>
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
    <a href="/painel">← Painel</a>
    <h1 style="font-size:1.1rem;font-weight:600;color:#f8fafc;margin:0">⏰ Controle de Prazos</h1>
    <div style="margin-left:auto;display:flex;gap:.5rem">
      <a href="/painel/prazos" style="padding:.35rem .75rem;border-radius:8px;font-size:.78rem;background:${!todos?'#2563eb':'#334155'};color:#fff;text-decoration:none">Pendentes</a>
      <a href="/painel/prazos?todos=1" style="padding:.35rem .75rem;border-radius:8px;font-size:.78rem;background:${todos?'#2563eb':'#334155'};color:#fff;text-decoration:none">Todos</a>
    </div>
  </div>
  ${msg}
  <div class="section" style="margin-bottom:1.25rem">
    <div class="section-header"><h2>Novo prazo</h2></div>
    <form method="POST" action="/painel/prazos/criar"
      style="padding:1.25rem;display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:.75rem;align-items:end">
      <div class="form-group" style="margin:0"><label>Título *</label><input name="titulo" required placeholder="Ex: Apelação — Processo João"></div>
      <div class="form-group" style="margin:0"><label>Data do prazo *</label><input name="data_prazo" type="date" required></div>
      <div class="form-group" style="margin:0"><label>Cliente</label><input name="cliente_nome" placeholder="Nome do cliente"></div>
      <div class="form-group" style="margin:0"><label>Nº do processo</label><input name="processo" placeholder="0000000-00.0000"></div>
      <button class="btn btn-blue" type="submit" style="height:36px">Cadastrar</button>
    </form>
  </div>
  <div class="section">
    <div class="section-header"><h2>Prazos (${lista.length})</h2></div>
    ${linhas?`<table><thead><tr><th>Título</th><th>Cliente</th><th>Processo</th><th>Vencimento</th><th>Restam</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>`:'<div class="empty">Nenhum prazo cadastrado.</div>'}
  </div>
  </body></html>`);
});

router.post('/criar', autenticado, async (req, res) => {
  try {
    const { titulo, data_prazo, cliente_nome, processo } = req.body;
    if (!titulo || !data_prazo) return res.redirect('/painel/prazos?erro=1');
    await criarPrazo({ usuarioId: req.session.usuario.id, titulo, dataPrazo: data_prazo, clienteNome: cliente_nome, processo });
    res.redirect('/painel/prazos?ok=1');
  } catch { res.redirect('/painel/prazos?erro=1'); }
});

router.post('/:id/concluir', autenticado, async (req, res) => {
  await concluirPrazo(req.params.id); res.redirect('/painel/prazos?ok=1');
});

router.post('/:id/deletar', autenticado, async (req, res) => {
  await deletarPrazo(req.params.id); res.redirect('/painel/prazos?ok=1');
});

module.exports = router;
