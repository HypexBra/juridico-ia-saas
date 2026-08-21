/**
 * Constantes compartilhadas entre `actions.ts` ("use server") e os
 * componentes client desta feature. Precisam viver fora do módulo de Server
 * Actions: um arquivo com a diretiva `"use server"` só pode exportar funções
 * async (toda exportação de valor não-função é rejeitada pelo bundler do
 * Next.js) — ver ADR 0011.
 */

/**
 * Cap técnico fixo (não por plano) — ver ADR 0011, seção 7: processamento
 * sequencial síncrono dentro do teto de `maxDuration` da Vercel. Acima disso,
 * pedir para dividir em mais de um lote.
 */
export const MAX_ARQUIVOS_LOTE_DOCUMENTO = 15;
