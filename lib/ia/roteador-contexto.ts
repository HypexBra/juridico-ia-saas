/**
 * ROTEADOR DE CONTEXTO · decide, por mensagem, QUANTO contexto vale a pena
 * pagar antes de chamar o modelo.
 *
 * Antes existiam só dois estados, decididos por `mensagemTrivial()`:
 *
 *   trivial  -> sem RAG, sem pesquisa web, sem thinking
 *   qualquer -> RAG + pesquisa web (grounding `googleSearch`) SEMPRE
 *
 * O segundo estado é o problema. `googleSearch` é uma busca server-side de
 * segundos, cobrada em tokens de prompt, e estava ligada em 100% das
 * mensagens não-triviais · inclusive nas que não têm nada a ganhar com a web:
 * "resuma o documento que subi", "quais são meus prazos de amanhã",
 * "reescreve esse parágrafo". Nessas, a resposta certa está no RAG do
 * escritório ou no próprio histórico, e a pesquisa só acrescenta latência,
 * tokens e a chance de o modelo ancorar numa página aleatória da internet.
 *
 * Por outro lado, existe a classe de pergunta em que responder SEM pesquisa é
 * o erro: "o STJ mudou o entendimento sobre isso?", "essa súmula ainda está em
 * vigor?", "qual a Selic de agora?". Aí o conhecimento congelado do modelo é
 * ativamente perigoso, e a pesquisa é obrigatória.
 *
 * Então o roteamento passa a ter três modos:
 *
 *   "rapido"     · interação social. Sem RAG, sem web, thinking zero.
 *   "interno"    · pergunta jurídica respondível com a base do escritório.
 *                  RAG sim, web NÃO. É o caso mais comum e o que mais
 *                  economiza: some a busca server-side do caminho quente.
 *   "atualizado" · a resposta depende de algo que MUDA no mundo (entendimento
 *                  de tribunal, vigência de norma, índice econômico) ou o
 *                  usuário pediu explicitamente o estado atual. RAG + web,
 *                  com instrução de datar a informação.
 *
 * Assimetria deliberada dos defaults: na dúvida entre "rapido" e "interno",
 * escolhe "interno" (custa uma query no banco); na dúvida entre "interno" e
 * "atualizado", escolhe "atualizado" (custa a pesquisa, mas evita afirmar
 * jurisprudência revogada com cara de certeza). O erro barato é gastar
 * contexto à toa; o erro caro é responder desatualizado sobre direito.
 */

import { mensagemTrivial } from "./gate-trivialidade";

export type ModoContexto = "rapido" | "interno" | "atualizado";

export type DecisaoContexto = {
  modo: ModoContexto;
  /** Deve rodar busca vetorial no RAG antes de montar o prompt. */
  usarRag: boolean;
  /** Deve ligar o grounding `googleSearch` do Gemini. */
  usarPesquisaWeb: boolean;
  /** Termo que disparou a decisão · usado em log/observabilidade, nunca exibido ao usuário. */
  motivo: string;
};

/*
 * NOTA SOBRE AS FRONTEIRAS DE PALAVRA (`(?<![\p{L}\p{N}_])` / `(?![\p{L}\p{N}_])`):
 *
 * `\b` do JavaScript usa a definição ASCII de "caractere de palavra". Num app
 * 100% pt-BR isso quebra em silêncio: `\b[uú]ltim[oa]s?\b` casa "ultimas" mas
 * NÃO casa "últimas", porque "ú" não é word char ASCII e o `\b` inicial exige
 * um do lado. Metade das alternativas acentuadas de cada lista simplesmente
 * nunca dispararia, e a mensagem cairia no modo errado sem nenhum erro
 * visível. Lookaround sobre `\p{L}`/`\p{N}` com a flag `u` resolve para
 * qualquer letra Unicode, mantendo a exigência de palavra inteira ("contratual"
 * não pode casar "atual").
 */

/**
 * Sinais de RECÊNCIA: o usuário está perguntando pelo estado ATUAL de algo,
 * não por um conceito estável. "prazo de contestação" é estável; "o prazo de
 * contestação mudou?" não é.
 */
const SINAIS_RECENCIA =
  /(?<![\p{L}\p{N}_])(atual|atuais|atualmente|atualizad[oa]s?|hoje|agora|recente[s]?|recentemente|[uú]ltim[oa]s?|novidade[s]?|mudou|mudan[cç]as?|mudaram|alterad[oa]s?|altera[cç][aã]o legislativa|revogad[oa]s?|cancelad[oa]s?|superad[oa]s?|vigente|vig[eê]ncia|em vigor|ainda (vale|se aplica|est[aá] valendo)|continua (valendo|v[aá]lid[oa]|em vigor)|entrou em vigor|passou a valer|neste ano|este ano|ano passado)(?![\p{L}\p{N}_])/iu;

/**
 * Sinais de FONTE EXTERNA MUTÁVEL: mesmo sem palavra de recência, estes
 * assuntos mudam por fora do escritório e a base interna pode estar velha.
 * Entendimento de tribunal superior, tese de repetitivo/repercussão geral,
 * súmula, e índices econômicos que os cálculos usam.
 */
const SINAIS_FONTE_MUTAVEL =
  /(?<![\p{L}\p{N}_])(jurisprud[eê]ncia|entendimento|precedente[s]?|s[uú]mula[s]?|vinculante|tema \d+|tema repetitiv[oa]|repetitiv[oa]s?|repercuss[aã]o geral|irdr|iac|informativo|stf|stj|tst|tse|cnj|selic|ipca|inpc|igp-m|sal[aá]rio m[ií]nimo|teto do inss|tabela do inss|[ií]ndice de corre[cç][aã]o|corre[cç][aã]o monet[aá]ria|nova lei|lei n[º°o]?\s*\d|marco (legal|temporal)|reforma (trabalhista|tribut[aá]ria|previdenci[aá]ria))(?![\p{L}\p{N}_])/iu;

/**
 * Sinais de trabalho INTERNO: o pedido opera sobre material que já está no
 * sistema ou na própria conversa. Mesmo que a mensagem seja longa e cheia de
 * termo jurídico, não há nada a pesquisar na web · o insumo está aqui.
 *
 * Só decide quando NÃO há sinal de recência nem de fonte mutável: pedir "gere
 * a petição citando a jurisprudência mais recente" tem os dois, e a pesquisa
 * ganha (ver ordem de avaliação em `decidirContexto`).
 */
const SINAIS_TRABALHO_INTERNO =
  /(?<![\p{L}\p{N}_])(resum[ea]|resumir|resumo|reescrev[ae]|reescreva|reformul[ae]|corrij[ae]|corrig[ei]|revis[ae]|revisar|traduz[ae]?|encurt[ae]|expand[ae]|format[ae]|organiz[ae]|melhor[ae]|meus?|minhas?|nest[ae]|acima|anterior|anexo|subi|anexei|enviei|colei)(?![\p{L}\p{N}_])/iu;

/**
 * Classifica a mensagem. Função PURA: zero I/O, zero rede, determinística e
 * testável sem mockar nada · roda antes de qualquer chamada cara.
 */
export function decidirContexto(texto: string): DecisaoContexto {
  const limpo = texto.trim();

  if (mensagemTrivial(limpo)) {
    return { modo: "rapido", usarRag: false, usarPesquisaWeb: false, motivo: "interacao_social" };
  }

  // Ordem importa: recência e fonte mutável vencem trabalho interno. "gere a
  // peça com a jurisprudência mais recente do STJ" precisa da web, mesmo
  // casando com um sinal interno.
  const recencia = limpo.match(SINAIS_RECENCIA);
  if (recencia) {
    return {
      modo: "atualizado",
      usarRag: true,
      usarPesquisaWeb: true,
      motivo: `recencia:${recencia[0].toLowerCase()}`,
    };
  }

  const fonteMutavel = limpo.match(SINAIS_FONTE_MUTAVEL);
  if (fonteMutavel) {
    return {
      modo: "atualizado",
      usarRag: true,
      usarPesquisaWeb: true,
      motivo: `fonte_mutavel:${fonteMutavel[0].toLowerCase()}`,
    };
  }

  const interno = limpo.match(SINAIS_TRABALHO_INTERNO);
  if (interno) {
    return {
      modo: "interno",
      usarRag: true,
      usarPesquisaWeb: false,
      motivo: `trabalho_interno:${interno[0].toLowerCase()}`,
    };
  }

  // Nada casou. Antes deste módulo, TODA mensagem aqui pagava pesquisa web.
  // O default vira "interno": a maioria das perguntas de escritório é sobre
  // conceito jurídico estável ou material próprio, e quem precisa do estado
  // atual quase sempre diz isso com uma das palavras acima ("atual", "mudou",
  // "STJ", "súmula"). Se faltar embasamento, o RAG_TOOLING_PROMPT já obriga o
  // modelo a admitir que respondeu sem base verificada · falha visível, não
  // silenciosa.
  return { modo: "interno", usarRag: true, usarPesquisaWeb: false, motivo: "default_interno" };
}
