-- Suporte de schema para: sincronização automática de intimações via DJEN
-- (Diário de Justiça Eletrônico Nacional). A API do DJEN é consultada por
-- número de OAB, então cada perfil de advogado precisa poder cadastrar a
-- própria OAB. Formato livre (varchar, sem CHECK) porque a numeração/UF varia
-- por seccional (ex: "123456/SP") e normalização fica a cargo da camada de
-- aplicação (lib/djen), não do banco.
alter table perfis add column if not exists oab varchar(20);
