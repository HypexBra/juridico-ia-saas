import { randomBytes, createHash } from "node:crypto";

/** Prefixo fixo de toda chave gerada — "live" porque não existe modo sandbox nesta v1. */
const PREFIXO_CHAVE = "jia_live_";

/** Quantos caracteres do corpo aleatório (após o prefixo) ficam visíveis na UI para o usuário reconhecer a chave sem expor o segredo. */
const TAMANHO_PREFIXO_VISIVEL = 4;

export type ChaveGerada = {
  /** Chave completa em texto puro — só existe aqui, no momento da criação. Nunca persistir isto. */
  chaveCompleta: string;
  /** SHA-256 hex da chave completa — é o único valor persistido em `api_keys.chave_hash`. */
  chaveHash: string;
  /** Ex: "jia_live_ab12" — persistido em `api_keys.prefixo_visivel`, seguro para exibir numa listagem. */
  prefixoVisivel: string;
};

/**
 * Gera uma nova API key de alta entropia no formato `jia_live_<64 chars hex>`
 * (32 bytes de `crypto.randomBytes`, codificados em hex = 64 caracteres —
 * entropia de 256 bits, muito acima do necessário para inviabilizar
 * brute-force). Retorna a chave completa (mostrar ao usuário 1x) e o par
 * hash+prefixo que de fato vai para o banco — quem chama esta função nunca
 * deve gravar `chaveCompleta` em lugar nenhum além da resposta imediata da
 * criação (nem log, nem `console.error`, nem tabela de auditoria).
 */
export function gerarApiKey(): ChaveGerada {
  const corpoAleatorio = randomBytes(32).toString("hex");
  const chaveCompleta = `${PREFIXO_CHAVE}${corpoAleatorio}`;
  const chaveHash = calcularHashApiKey(chaveCompleta);
  const prefixoVisivel = `${PREFIXO_CHAVE}${corpoAleatorio.slice(0, TAMANHO_PREFIXO_VISIVEL)}`;

  return { chaveCompleta, chaveHash, prefixoVisivel };
}

/** SHA-256 hex de uma chave — usado tanto na geração quanto na autenticação (lib/apikeys/autenticar.ts) para nunca comparar/guardar a chave em texto puro. */
export function calcularHashApiKey(chaveCompleta: string): string {
  return createHash("sha256").update(chaveCompleta, "utf8").digest("hex");
}
