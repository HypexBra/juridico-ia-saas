-- Liga `documentos_para_assinatura` à origem do documento (modelo salvo ou
-- proposta de ação do chat) para a UI conseguir listar/atualizar o status de
-- envio no lugar onde o documento foi gerado, sem depender de matching por
-- nome (frágil quando o mesmo modelo/proposta é reenviado mais de uma vez).
-- Ambas nullable e independentes: um documento de assinatura vem de UM dos
-- dois fluxos, nunca dos dois ao mesmo tempo.
alter table documentos_para_assinatura
  add column if not exists modelo_id uuid references modelos(id) on delete set null;
alter table documentos_para_assinatura
  add column if not exists proposta_acao_id uuid references propostas_acao(id) on delete set null;

create index if not exists idx_docs_assinatura_modelo on documentos_para_assinatura(modelo_id);
create index if not exists idx_docs_assinatura_proposta on documentos_para_assinatura(proposta_acao_id);
