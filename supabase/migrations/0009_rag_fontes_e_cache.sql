-- RAG do copiloto: (1) persistir as fontes de contexto realmente usadas em
-- cada resposta do assistente, para a UI poder linkar/citar de forma
-- verificável (hoje `montarBlocoContexto` só rotula em texto solto dentro do
-- prompt, o usuário não consegue clicar/conferir); (2) coluna auxiliar para
-- o guard de mensagem duplicada (ver lib/rag/actions em app/app/chat).
-- Expand-only, nullable, sem default forçado — mensagens já existentes ficam
-- com `fontes = null` (equivalente a "sem citação", já tratado pela UI).

alter table mensagens add column if not exists fontes jsonb;

comment on column mensagens.fontes is
  'Snapshot das fontes (chunks) efetivamente injetadas como contexto RAG nesta resposta: array de {tipo, fonte_id, label, href}. Preenchido só em mensagens role=assistant que tiveram contexto recuperado. NULL = resposta sem RAG (ou já existente antes desta coluna).';
