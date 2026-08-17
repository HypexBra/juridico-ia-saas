# Assistente Jurídico IA — WhatsApp v5.0 ⚖️
> Versão completa com todos os módulos

---

## Funcionalidades completas

| Módulo | O que faz |
|--------|-----------|
| ⚖️ IA Jurídica | Petições, contratos, análises, cálculos, jurisprudência |
| 👥 Cliente externo | Triagem guiada com 5 perguntas + análise automática da IA |
| 🔐 Whitelist | Só números autorizados acessam o modo advogado |
| 📄 DOCX automático | Detecta pedido de Word e envia arquivo pelo WhatsApp |
| 🔍 Jurisprudência real | Busca STF/STJ atualizada durante a resposta |
| ⏰ Controle de prazos | Lembretes 7, 3 e 1 dia antes via WhatsApp |
| 💬 Menu guiado | Botões numéricos para navegar pelas opções |
| 💰 Dashboard financeiro | Custo por área, cliente e projeção mensal |
| 📚 Biblioteca de modelos | Templates reutilizáveis de peças |
| 🔔 Notificações proativas | Resumo diário + alerta de custo às 07:30 |
| 📎 Análise de documentos | PDF e imagem enviados pelo WhatsApp |
| 🏷️ Tags nas conversas | Classificação por área jurídica |
| 👥 Múltiplos usuários | Admin + advogados com roles separadas |
| 📋 Fichas de triagem | Painel com análise IA de cada cliente |
| ⬇️ Exportar PDF | Histórico de conversa em PDF formatado |

---

## Instalação

```bash
npm install
cp .env.example .env
# preencha o .env
npm run db:setup
npm start
```

---

## Primeiro acesso ao painel

```
URL:   http://localhost:3000/painel
Email: admin@juridico.com
Senha: Admin@2025
```
⚠️ Troque a senha em **Painel → Perfil** imediatamente.

---

## Configuração inicial (ordem recomendada)

1. **Painel → Autorizados** — adicione o número do advogado (5511999999999)
2. **Painel → Usuários** — preencha o campo WhatsApp do advogado para receber notificações
3. **Z-API** — configure o webhook para `https://seu-app.railway.app/webhook`
4. **Painel → Modelos** — crie templates das peças mais usadas pelo escritório
5. Teste enviando `/menu` pelo WhatsApp

---

## Comandos disponíveis no WhatsApp (advogado)

| Comando | Função |
|---------|--------|
| `/menu` ou `/ajuda` | Abre o menu guiado |
| `/limpar` | Encerra a conversa atual |
| `1` a `7` | Navega no menu |
| `PRAZO: título \| data \| cliente \| processo` | Cadastra prazo direto pelo WhatsApp |

---

## Páginas do painel

| URL | O que mostra |
|-----|-------------|
| `/painel` | Dashboard principal |
| `/painel/fichas` | Triagens de clientes |
| `/painel/conversas` | Todas as conversas |
| `/painel/busca` | Busca global |
| `/painel/prazos` | Controle de prazos |
| `/painel/modelos` | Biblioteca de templates |
| `/painel/financeiro` | Custos e projeção |
| `/painel/usuarios` | Gerenciar usuários (admin) |
| `/painel/autorizados` | Whitelist de números (admin) |

---

## Deploy no Railway

```bash
# 1. Criar projeto no Railway com plugin PostgreSQL
# 2. Configurar variáveis de ambiente
# 3. Deploy
# 4. Rodar setup do banco
railway run npm run db:setup
```

---

## Estrutura de arquivos

```
src/
├── index.js              ← Servidor principal
├── ia.js                 ← Integração Anthropic
├── whatsapp.js           ← Z-API + envio de arquivos
├── documentos.js         ← Leitura de PDF/imagem
├── docx.js               ← Geração de Word
├── jurisprudencia.js     ← Busca em tempo real
├── prazos.js             ← Lembretes automáticos
├── notificacoes.js       ← Resumo diário + alertas
├── financeiro.js         ← Cálculo de custos
├── modelos.js            ← Biblioteca de templates
├── menu.js               ← Menu guiado interativo
├── triagem.js            ← Fluxo cliente externo
├── auth.js               ← Autenticação
├── painel.js             ← Painel principal
├── painel-financeiro.js  ← Dashboard financeiro
├── painel-modelos.js     ← Gestão de templates
├── painel-prazos.js      ← Controle de prazos
├── pdf.js                ← Exportar conversa PDF
└── db/
    ├── pool.js
    ├── repositorio.js
    └── setup.js
config/
└── system-prompt.js      ← Prompt jurídico (edite aqui)
```
