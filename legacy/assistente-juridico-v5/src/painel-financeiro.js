const express = require('express');
const router  = express.Router();
const { getDashboardFinanceiro, getCustoPorArea, getCustoPorCliente, getProjecaoMes } = require('./financeiro');
const { autenticado } = require('./auth');

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

router.get('/', autenticado, async (req, res) => {
  const [mensal, porArea, porCliente, projecao] = await Promise.all([
    getDashboardFinanceiro(), getCustoPorArea(),
    getCustoPorCliente(10), getProjecaoMes()
  ]);

  const linhasMensal = mensal.map(m => `<tr>
    <td>${esc(m.mes_ref)}</td>
    <td>${m.total_conversas}</td>
    <td>${Number(m.tokens_total).toLocaleString('pt-BR')}</td>
    <td>US$ ${parseFloat(m.custo_usd).toFixed(4)}</td>
    <td>R$ ${(parseFloat(m.custo_usd) * 5.8).toFixed(2)}</td>
  </tr>`).join('');

  const linhasArea = porArea.map(a => `<tr>
    <td>${esc(a.area)}</td>
    <td>${a.conversas}</td>
    <td>${Number(a.tokens).toLocaleString('pt-BR')}</td>
    <td>US$ ${parseFloat(a.custo_usd).toFixed(4)}</td>
  </tr>`).join('');

  const linhasCliente = porCliente.map(c => `<tr>
    <td>${esc(c.numero)}</td>
    <td>${esc(c.nome||'—')}</td>
    <td><span style="padding:.15rem .5rem;border-radius:99px;font-size:.65rem;background:${c.tipo==='advogado'?'#1e3a5f':'#2e1065'};color:${c.tipo==='advogado'?'#60a5fa':'#c4b5fd'}">${c.tipo}</span></td>
    <td>${c.conversas}</td>
    <td>US$ ${parseFloat(c.custo_usd).toFixed(4)}</td>
  </tr>`).join('');

  const pctMes = projecao.percentualMes;
  const barColor = pctMes > 80 ? '#dc2626' : pctMes > 50 ? '#f59e0b' : '#10b981';

  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Financeiro — Jurídico IA</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem}
      h1{font-size:1.1rem;font-weight:600;margin-bottom:1.5rem;color:#f8fafc}
      h2{font-size:.875rem;font-weight:600;color:#f8fafc;margin-bottom:.75rem}
      .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem}
      .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.25rem}
      .card .label{font-size:.7rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
      .card .value{font-size:1.5rem;font-weight:700;color:#f8fafc;margin-top:.25rem}
      .card .sub{font-size:.72rem;color:#64748b;margin-top:.3rem}
      .section{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:1.25rem}
      .section-header{padding:.875rem 1.25rem;border-bottom:1px solid #334155}
      table{width:100%;border-collapse:collapse}
      th{padding:.625rem 1rem;text-align:left;font-size:.7rem;color:#64748b;text-transform:uppercase;border-bottom:1px solid #334155}
      td{padding:.625rem 1rem;font-size:.8rem;border-bottom:1px solid #1a2436;color:#cbd5e1}
      tr:last-child td{border-bottom:none}
      .bar-wrap{background:#334155;border-radius:99px;height:8px;margin-top:.5rem}
      .bar{height:8px;border-radius:99px;background:${barColor};width:${pctMes}%}
      a{color:#60a5fa;font-size:.8rem}
    </style>
  </head><body>
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <a href="/painel">← Painel</a>
      <h1 style="margin:0">💰 Dashboard Financeiro</h1>
    </div>

    <div class="cards">
      <div class="card">
        <div class="label">Gasto este mês</div>
        <div class="value">US$ ${projecao.gastoAteAgora}</div>
        <div class="sub">R$ ${(parseFloat(projecao.gastoAteAgora)*5.8).toFixed(2)} aprox.</div>
        <div class="bar-wrap"><div class="bar"></div></div>
        <div class="sub" style="margin-top:.4rem">${pctMes}% do mês concluído</div>
      </div>
      <div class="card">
        <div class="label">Projeção do mês</div>
        <div class="value">US$ ${projecao.projecaoMes}</div>
        <div class="sub">R$ ${(parseFloat(projecao.projecaoMes)*5.8).toFixed(2)} aprox.</div>
      </div>
      <div class="card">
        <div class="label">Custo por resposta</div>
        <div class="value">~US$ 0.01</div>
        <div class="sub">claude-sonnet-4-6</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><h2>Histórico mensal</h2></div>
      <table><thead><tr><th>Mês</th><th>Conversas</th><th>Tokens</th><th>Custo USD</th><th>Custo BRL</th></tr></thead>
      <tbody>${linhasMensal||'<tr><td colspan="5" style="text-align:center;color:#475569;padding:2rem">Sem dados ainda.</td></tr>'}</tbody></table>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
      <div class="section">
        <div class="section-header"><h2>Custo por área jurídica</h2></div>
        <table><thead><tr><th>Área</th><th>Conversas</th><th>Tokens</th><th>Custo USD</th></tr></thead>
        <tbody>${linhasArea||'<tr><td colspan="4" style="text-align:center;color:#475569;padding:2rem">Sem dados.</td></tr>'}</tbody></table>
      </div>
      <div class="section">
        <div class="section-header"><h2>Top clientes por custo</h2></div>
        <table><thead><tr><th>Número</th><th>Nome</th><th>Tipo</th><th>Conv.</th><th>Custo</th></tr></thead>
        <tbody>${linhasCliente||'<tr><td colspan="5" style="text-align:center;color:#475569;padding:2rem">Sem dados.</td></tr>'}</tbody></table>
      </div>
    </div>
  </body></html>`);
});

module.exports = router;
