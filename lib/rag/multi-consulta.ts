import "server-only";

/**
 * Decomposição leve de consulta para o modo "pesquisa fundamentada" (ver
 * MODO_TAREFA_PROMPTS em lib/ia/rag-prompt.ts) — versão simplificada do
 * "Deep Research" multi-agente do CoCounsel: em vez de orquestrar agentes
 * completos, quebra uma pergunta com MÚLTIPLAS questões distintas em
 * sub-consultas, cada uma buscada separadamente no RAG.
 *
 * Deliberadamente NÃO usa uma chamada de LLM para decompor (isso custaria
 * uma chamada extra em toda mensagem do modo pesquisa, ironicamente
 * piorando o problema de custo/latência que o resto desta sessão resolveu)
 * — é uma heurística determinística sobre conectivos/pontuação. Quando a
 * pergunta não tem uma estrutura clara de múltiplas questões, devolve só a
 * pergunta original (zero custo extra) — nunca finge decompor o que é uma
 * pergunta única.
 */

const CONECTIVOS_MULTIPLA_QUESTAO = /(?:\s+(?:e também|e ainda|,\s*e)\s+)|(?:;\s*)/gi;
const MAX_SUBCONSULTAS = 3;
const TAMANHO_MINIMO_SUBCONSULTA = 12; // caracteres — abaixo disso não é uma questão própria, é fragmento

/**
 * Divide `pergunta` em até `MAX_SUBCONSULTAS` sub-consultas quando ela
 * contém sinais de múltiplas questões distintas (múltiplos "?", ou
 * conectivos de coordenação separando cláusulas longas). Caso contrário,
 * devolve `[pergunta]` — o caller trata isso como "sem decomposição", sem
 * custo adicional de busca.
 */
export function decomporConsulta(pergunta: string): string[] {
  const limpa = pergunta.trim();
  if (!limpa) return [limpa];

  // Múltiplas interrogações são o sinal mais confiável de perguntas
  // distintas na mesma mensagem — divide preservando o "?" em cada pedaço.
  const porInterrogacao = limpa
    .split(/(?<=\?)\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= TAMANHO_MINIMO_SUBCONSULTA);

  if (porInterrogacao.length >= 2) {
    return dedupLimitado(porInterrogacao);
  }

  // Sem múltiplos "?": tenta separar por conectivo de coordenação, só
  // quando cada lado resultante já parece uma cláusula própria (comprimento
  // mínimo) — evita fatiar "acordo e distrato" (um substantivo composto) em
  // duas "perguntas" sem sentido.
  const porConectivo = limpa
    .split(CONECTIVOS_MULTIPLA_QUESTAO)
    .map((p) => p.trim())
    .filter((p) => p.length >= TAMANHO_MINIMO_SUBCONSULTA * 2);

  if (porConectivo.length >= 2) {
    return dedupLimitado(porConectivo);
  }

  return [limpa];
}

function dedupLimitado(partes: string[]): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const parte of partes) {
    const chave = parte.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(parte);
    if (resultado.length >= MAX_SUBCONSULTAS) break;
  }
  return resultado.length >= 2 ? resultado : partes.slice(0, 1);
}
