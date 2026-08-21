/**
 * Tipos compartilhados do pool de chaves de API dos provedores de LLM
 * (Gemini/Groq) — ver `supabase/migrations/0032_ia_provider_chaves.sql` para
 * o schema e `lib/ia/chaves/pool.ts` para a seleção/registro de uso.
 */

export type ProviderIa = "gemini" | "groq";

export type StatusChave = "ativa" | "desativada_temporariamente_por_quota" | "desativada_manual";

/** Chave já decifrada, pronta para montar o client HTTP do provedor — nunca persistida, nunca logada, vive só no escopo da função que a criou/usou. */
export type ChaveProviderSelecionada = {
  id: string;
  provider: ProviderIa;
  chavePlana: string;
  nome: string;
};

/** Shape de uma linha de `ia_provider_chaves_admin` (view sem `chave_cifrada`) — o que a tela /admin/ia-chaves lê e exibe. */
export type ChaveIaAdmin = {
  id: string;
  provider: ProviderIa;
  nome: string;
  ordem: number;
  rpm_limite: number;
  tpm_limite: number | null;
  rpd_limite: number | null;
  contador_janela_inicio: string;
  contador_requisicoes: number;
  status: StatusChave;
  ultima_falha_em: string | null;
  ultima_falha_motivo: string | null;
  ultima_utilizada_em: string | null;
  chave_preview: string | null;
  disponivel_em: string;
  criado_em: string;
  atualizado_em: string;
};
