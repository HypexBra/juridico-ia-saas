-- Persiste, por mensagem do assistente, quais "[Doc #N]" citados no texto
-- NÃO correspondem a um chunk de fato injetado no prompt (ver
-- lib/rag/citacoes.ts#validarCitacoes, já calculado em app/app/chat/actions.ts
-- e app/api/chat/mensagem/route.ts — antes só ia pro log, nunca chegava na
-- UI). Guardar isso na própria mensagem permite ao frontend colorir a
-- citação (verde = confirmada, vermelho = inventada), inspirado no "Jus IA"
-- do Jusbrasil — hoje o usuário só descobre uma citação inventada se for
-- checar o log do servidor.
alter table mensagens
  add column if not exists citacoes_invalidas integer[];
