const bcrypt = require('bcryptjs');
const db     = require('./db/repositorio');

// Middleware — protege rotas do painel
function autenticado(req, res, next) {
  if (req.session?.usuario) return next();
  res.redirect('/painel/login');
}

// Middleware — apenas admins
function apenasAdmin(req, res, next) {
  if (req.session?.usuario?.role === 'admin') return next();
  res.status(403).send(paginaErro('Acesso restrito a administradores.'));
}

// Login
async function login(req, res) {
  const { email, senha } = req.body;
  if (!email || !senha) return res.redirect('/painel/login?erro=campos');

  const usuario = await db.buscarUsuarioPorEmail(email.trim().toLowerCase());
  if (!usuario) return res.redirect('/painel/login?erro=credenciais');

  const ok = await bcrypt.compare(senha, usuario.senha_hash);
  if (!ok)  return res.redirect('/painel/login?erro=credenciais');

  await db.atualizarLogin(usuario.id);
  req.session.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role };
  res.redirect('/painel');
}

// Hash de senha
async function hashSenha(senha) {
  return bcrypt.hash(senha, 12);
}

// Cria admin inicial se não existir nenhum usuário
async function garantirAdminInicial() {
  const usuarios = await db.listarUsuarios();
  if (usuarios.length === 0) {
    const hash = await hashSenha('Admin@2025');
    await db.criarUsuario('Administrador', 'admin@juridico.com', hash, 'admin');
    console.log('👤 Usuário admin criado: admin@juridico.com / Admin@2025');
    console.log('⚠️  TROQUE A SENHA ao primeiro login!');
  }
}

function paginaErro(msg) {
  return `<html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#e2e8f0">
    <h2>⛔ ${msg}</h2><a href="/painel" style="color:#60a5fa">← Voltar</a></body></html>`;
}

module.exports = { autenticado, apenasAdmin, login, hashSenha, garantirAdminInicial };
