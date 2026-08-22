/**
 * Gate de trivialidade do chat — evita pagar o custo de LATÊNCIA de
 * pesquisa web (grounding `googleSearch` do Gemini), busca RAG no banco e
 * budget de "thinking" em mensagens que não têm nenhum conteúdo jurídico.
 *
 * O usuário relatava: "eu dou um oi ela demora muito para me responder". A
 * causa raiz era tripla e todas as três partes só existem quando a mensagem
 * pede substância: (1) `googleSearch` ligado SEMPRE invoca busca server-side
 * (segundos) mesmo pra saudação; (2) a busca RAG roda em toda mensagem;
 * (3) o thinkingConfig tem piso de 256 tokens. Para "oi", nenhuma das três
 * muda um caractere da resposta — mas somam vários segundos.
 *
 * HEURÍSTICA DELIBERADAMENTE CONSERVADORA (fail-open para modo completo):
 * uma mensagem só é trivial se for CURTA, não contiver NENHUMA palavra-
 * chave jurídica/processual, não contiver número de processo e cada SEGMENTO
 * (separado por vírgula/ponto) for reconhecível como interação social.
 * Na dúvida, NÃO é trivial — o pior caso é responder devagar como hoje; o
 * contrário (tratar pergunta real como trivial) degradaria qualidade de
 * resposta jurídica, que é inaceitável.
 */

/** Limite duro de caracteres: qualquer coisa acima disso nunca é trivial. */
const MAX_CHARS_TRIVIAL = 60;

/**
 * Palavras-chave que denunciam intenção jurídica/substantiva. Regex única,
 * case-insensitive, com acentuação explícita (o app é 100% pt-BR).
 */
export const PALAVRAS_JURIDICAS =
  /\b(process[oa]s?|peti[cç][aã]o|minuta|peça|pecas|peças|senten[cç]a|acórd[aã]o|acordao|despacho|decis[aã]o|alvar[aá]|mandado|intima[cç][aã]o|publica[cç][aã]o|di[aá]rio|audi[eê]ncia|prazo[s]?|prescri[cç][aã]o|decad[eê]ncia|contestar|contesta[cç][aã]o|recurso|apela[cç][aã]o|agravo|embargos|cumprimento|execu[cç][aã]o|habeas corpus|mandado de seguran[cç]a|jurisprud[eê]ncia|s[uú]mula|precedente|tribunal|ju[ií]z|vara|comarca|foro|autos|processual|c[oó]digo|artigo|art\.|cláusula|clausula|contrato|contratual|rescis[aã]o|indeniza[cç][aã]o|dano[s]? moral|dano[s]? material|honorários|honorarios|custas|d[íi]vida|cobran[cç]a|consumidor|previdenci[aá]|tribut[aá]ri|penal|fam[ií]lia|inventário|inventario|div[oó]rcio|guarda|pens[aã]o|usucapi[aã]o|verbas rescis[óo]rias|análise|analise|analisar|resum[oi]r?|gerar|redigir|elaborar|rascunho|parecer|riscos?|estrat[eé]gia|tese[s]?|defesa|parte contr[aá]ria|documento|prova[s]?|testemunha|laudo)\b/i;

/** Número de processo CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO) ou formatos antigos. */
export const NUMERO_PROCESSO =
  /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{1,2}\.?\d{4}|\b\d{4,7}-\d{2}\.\d{4}/;

/**
 * Tokens sociais reconhecíveis como mensagem COMPLETA (após normalização:
 * minúsculas, sem acentos opcionais, sem pontuação final). Cada segmento da
 * mensagem (separado por vírgula/ponto) precisa estar nesta lista.
 */
const TOKENS_SOCIAIS = [
  // saudações
  "oi", "oi oi", "oie", "oii", "ola", "opa", "eae", "e ai", "eai",
  "bom dia", "boa tarde", "boa noite",
  "tudo bem", "tudo bom", "tudo joia", "joia", "bem", "td bem", "tdb",
  "como voce esta", "como vc esta", "como vai", "como vai voce",
  "tudo certo", "tudo ok", "beleza", "blz",
  // agradecimentos / reconhecimento
  "obrigado", "obrigada", "brigado", "brigada", "valeu", "vlw", "vlw demais",
  "obrigado pela ajuda", "obrigada pela ajuda", "muito obrigado", "muito obrigada",
  "top", "show", "massa", "legal", "perfeito", "otimo", "excelente",
  // confirmações / prosseguimento
  "ok", "okay", "kk", "kkk", "haha", "hehe",
  "sim", "nao", "claro", "certo", "isso", "exato", "exata",
  "entendi", "entendido", "compreendi", "saquei",
  "combinado", "fechado", "pode ser", "pode seguir", "segue",
  "continua", "continue", "prosseguir", "prossegue", "adiante",
  "proxima", "proximo", "vamos", "manda", "manda ver", "pode mandar",
];

function normalizar(segmento: string): string {
  return segmento
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.…:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mensagemTrivial(texto: string): boolean {
  const limpo = texto.trim();
  if (limpo.length === 0) return true;
  if (limpo.length > MAX_CHARS_TRIVIAL) return false;
  if (NUMERO_PROCESSO.test(limpo)) return false;
  if (PALAVRAS_JURIDICAS.test(limpo)) return false;
  // Mensagem curta sem sinal jurídico: trivial somente se TODOS os
  // segmentos forem reconhecíveis como interação social. Uma frase curta
  // desconhecida ("revisa isso") fica em modo completo — conservador.
  const segmentos = limpo.split(/[,;]+/).map(normalizar);
  return segmentos.length > 0 && segmentos.every((segmento) => TOKENS_SOCIAIS.includes(segmento));
}
