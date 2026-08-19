/**
 * Motor de "mail-merge condicional" (feature Pro "automacao_documento_condicional",
 * ver `lib/planos/gating.ts`) — evolução do mail-merge literal 1-clique de
 * `lib/peticoes/mail-merge.ts` (que só substitui `{{variavel}}`, sem lógica).
 * Aqui o texto de um modelo pode ter BLOCOS CONDICIONAIS e DE REPETIÇÃO,
 * avaliados de forma 100% determinística — a IA nunca decide o resultado de
 * um "if"/"cada", só os DADOS entram na conta. Função pura: não faz I/O, não
 * conhece Supabase, só string+dados in / string out, testável isoladamente.
 *
 * ── Sintaxe suportada ────────────────────────────────────────────────────
 *
 * 1) Variável simples — igual ao mail-merge simples:
 *      {{nome_cliente}}
 *
 * 2) Bloco condicional (`{{#se ...}}...{{/se}}`), com `{{#senao}}` opcional
 *    para o ramo "senão":
 *      {{#se area_direito == "Trabalhista"}}
 *        Bloco incluído só se a área for Trabalhista.
 *      {{#senao}}
 *        Bloco incluído nos demais casos.
 *      {{/se}}
 *
 *    A condição aceita:
 *      - `campo`                 → truthy (existe, não é vazio/false/zero)
 *      - `campo == "texto"`      → igualdade de texto (comparação exata)
 *      - `campo != "texto"`      → diferença de texto
 *      - `campo > 100` / `< 100` / `>= 100` / `<= 100` → comparação
 *        numérica (aceita formato brasileiro "1.234,56" nos dados)
 *
 * 3) Bloco de repetição (`{{#cada colecao}}...{{/cada}}`) — itera um array
 *    de registros (ex: todas as parcelas de honorário da ficha, não só a
 *    mais recente). Dentro do bloco, `{{campo}}` resolve primeiro contra o
 *    ITEM atual e, se o item não tiver esse campo, cai para o escopo
 *    externo (permite reaproveitar `{{nome_cliente}}` dentro do loop).
 *    `{{indice}}` (1-based) fica disponível automaticamente:
 *      {{#cada parcelas}}
 *        Parcela {{indice}}: {{valor}}, vencimento {{vencimento}}.
 *      {{/cada}}
 *
 *    Coleção vazia ou inexistente → bloco não renderiza nada (nunca quebra).
 *
 * Blocos podem ser aninhados livremente (`{{#se}}` dentro de `{{#cada}}` e
 * vice-versa).
 *
 * Variável/coleção/condição que referencia um campo inexistente nunca
 * quebra a geração: vira "não informado" (variável simples) ou é tratada
 * como falsa/vazia (condição/coleção) — sempre reportada em
 * `variaveisNaoResolvidas` para a UI avisar o usuário antes de considerar o
 * documento pronto.
 */

/** Valor escalar aceito nos dados de contexto (ficha, item de coleção etc). */
export type ValorPrimitivoTemplate = string | number | boolean | null | undefined;

/** Um item de coleção (linha de parcela, prazo, contrato...). */
export type RegistroTemplate = Record<string, ValorPrimitivoTemplate>;

/** Valor de um campo no contexto: escalar ou coleção de registros (para `{{#cada}}`). */
export type ValorContextoTemplate = ValorPrimitivoTemplate | RegistroTemplate[];

/** Contexto de dados completo passado ao motor — nível raiz (fora de qualquer loop). */
export type ContextoMailMergeCondicional = Record<string, ValorContextoTemplate>;

export type ResultadoMailMergeCondicional = {
  /** Texto do modelo com variáveis/condicionais/loops resolvidos. */
  textoFinal: string;
  /** Snapshot das variáveis simples de fato substituídas (nome -> valor usado). */
  variaveisUsadas: Record<string, string>;
  /**
   * Nomes de variável/condição/coleção que não puderam ser resolvidos
   * (typo, campo não cadastrado, coleção vazia/ausente) — a UI deve avisar
   * o usuário antes de considerar o documento pronto para uso.
   */
  variaveisNaoResolvidas: string[];
};

/** Erro de sintaxe do template (tags desbalanceadas, condição mal-formada) — nunca é "dado ausente". */
export class MotorTemplateCondicionalError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "MotorTemplateCondicionalError";
  }
}

/** Detecta se um modelo usa a sintaxe condicional (para a UI decidir qual card mostrar). */
export function modeloUsaLogicaCondicional(conteudoModelo: string): boolean {
  return /\{\{\s*#(se|cada)\s+/i.test(conteudoModelo);
}

// ── Tokenização ────────────────────────────────────────────────────────

type Token =
  | { tipo: "texto"; valor: string }
  | { tipo: "var"; nome: string }
  | { tipo: "se-abre"; condicao: string }
  | { tipo: "senao" }
  | { tipo: "se-fecha" }
  | { tipo: "cada-abre"; colecao: string }
  | { tipo: "cada-fecha" };

// Só reconhece tags no formato documentado acima; qualquer outra coisa
// entre `{{` e `}}` (ex: variável com espaço/typo grosseiro) permanece como
// TEXTO LITERAL — mesmo comportamento de "não quebra nunca" do mail-merge
// simples, que também usa uma regex restrita (`\{\{(\w+)\}\}`).
const PADRAO_TAG = /\{\{\s*(#se\s+[^{}]+?|#senao|\/se|#cada\s+\w+|\/cada|\w+)\s*\}\}/g;

function tokenizar(conteudoModelo: string): Token[] {
  const tokens: Token[] = [];
  let ultimoIndice = 0;
  let correspondencia: RegExpExecArray | null;

  PADRAO_TAG.lastIndex = 0;
  while ((correspondencia = PADRAO_TAG.exec(conteudoModelo)) !== null) {
    if (correspondencia.index > ultimoIndice) {
      tokens.push({ tipo: "texto", valor: conteudoModelo.slice(ultimoIndice, correspondencia.index) });
    }

    const conteudoTag = correspondencia[1] ?? "";
    if (/^#se\s+/i.test(conteudoTag)) {
      tokens.push({ tipo: "se-abre", condicao: conteudoTag.replace(/^#se\s+/i, "").trim() });
    } else if (/^#senao$/i.test(conteudoTag)) {
      tokens.push({ tipo: "senao" });
    } else if (/^\/se$/i.test(conteudoTag)) {
      tokens.push({ tipo: "se-fecha" });
    } else if (/^#cada\s+/i.test(conteudoTag)) {
      tokens.push({ tipo: "cada-abre", colecao: conteudoTag.replace(/^#cada\s+/i, "").trim() });
    } else if (/^\/cada$/i.test(conteudoTag)) {
      tokens.push({ tipo: "cada-fecha" });
    } else {
      tokens.push({ tipo: "var", nome: conteudoTag });
    }

    ultimoIndice = correspondencia.index + correspondencia[0].length;
  }

  if (ultimoIndice < conteudoModelo.length) {
    tokens.push({ tipo: "texto", valor: conteudoModelo.slice(ultimoIndice) });
  }

  return tokens;
}

// ── AST ────────────────────────────────────────────────────────────────

type No =
  | { tipo: "texto"; valor: string }
  | { tipo: "var"; nome: string }
  | { tipo: "se"; condicao: string; verdadeiro: No[]; falso: No[] }
  | { tipo: "cada"; colecao: string; filhos: No[] };

type EstadoParser = { indice: number };

/**
 * Parser recursivo-descendente: consome tokens até encontrar um fechamento
 * que pertence ao chamador (`se-fecha`/`senao`/`cada-fecha`) ou o fim da
 * lista. Lança `MotorTemplateCondicionalError` para tags desbalanceadas —
 * isso É um erro de autoria do template (não "dado ausente"), então não
 * pode falhar silenciosamente.
 */
function parseBloco(tokens: Token[], estado: EstadoParser): No[] {
  const nos: No[] = [];

  while (estado.indice < tokens.length) {
    const token = tokens[estado.indice];
    if (!token) break;
    if (token.tipo === "se-fecha" || token.tipo === "senao" || token.tipo === "cada-fecha") {
      break;
    }
    estado.indice += 1;

    if (token.tipo === "texto") {
      nos.push({ tipo: "texto", valor: token.valor });
      continue;
    }
    if (token.tipo === "var") {
      nos.push({ tipo: "var", nome: token.nome });
      continue;
    }
    if (token.tipo === "se-abre") {
      const verdadeiro = parseBloco(tokens, estado);
      let falso: No[] = [];
      const proximo = tokens[estado.indice];
      if (proximo?.tipo === "senao") {
        estado.indice += 1;
        falso = parseBloco(tokens, estado);
      }
      const fechamento = tokens[estado.indice];
      if (fechamento?.tipo !== "se-fecha") {
        throw new MotorTemplateCondicionalError(
          `Bloco "{{#se ${token.condicao}}}" sem "{{/se}}" correspondente no modelo.`,
        );
      }
      estado.indice += 1;
      nos.push({ tipo: "se", condicao: token.condicao, verdadeiro, falso });
      continue;
    }
    if (token.tipo === "cada-abre") {
      const filhos = parseBloco(tokens, estado);
      const fechamento = tokens[estado.indice];
      if (fechamento?.tipo !== "cada-fecha") {
        throw new MotorTemplateCondicionalError(
          `Bloco "{{#cada ${token.colecao}}}" sem "{{/cada}}" correspondente no modelo.`,
        );
      }
      estado.indice += 1;
      nos.push({ tipo: "cada", colecao: token.colecao, filhos });
      continue;
    }
  }

  return nos;
}

function parseTemplate(conteudoModelo: string): No[] {
  const tokens = tokenizar(conteudoModelo);
  const estado: EstadoParser = { indice: 0 };
  const nos = parseBloco(tokens, estado);

  if (estado.indice < tokens.length) {
    const sobrando = tokens[estado.indice];
    const rotulo =
      sobrando?.tipo === "se-fecha" ? "{{/se}}" : sobrando?.tipo === "cada-fecha" ? "{{/cada}}" : "{{#senao}}";
    throw new MotorTemplateCondicionalError(`Tag "${rotulo}" encontrada no modelo sem abertura correspondente.`);
  }

  return nos;
}

// ── Avaliação ──────────────────────────────────────────────────────────

type PilhaEscopos = ReadonlyArray<RegistroTemplate | ContextoMailMergeCondicional>;

function buscarCampo(
  nome: string,
  escopos: PilhaEscopos,
): { encontrado: boolean; valor: ValorContextoTemplate | undefined } {
  for (const escopo of escopos) {
    if (Object.prototype.hasOwnProperty.call(escopo, nome)) {
      return { encontrado: true, valor: escopo[nome] };
    }
  }
  return { encontrado: false, valor: undefined };
}

/** Formata um valor escalar para texto de saída; `null` = "não deu pra resolver". */
function formatarValorEscalar(valor: ValorContextoTemplate | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  if (Array.isArray(valor)) return null; // coleção não é interpolável diretamente
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : null;
  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}

function ehVerdadeiro(valor: ValorContextoTemplate | undefined): boolean {
  if (valor === null || valor === undefined) return false;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return Number.isFinite(valor) && valor !== 0;
  return valor.trim().length > 0;
}

/** Converte string em formato pt-BR ("1.234,56" ou "1234.56") para número; `null` se não for numérico. */
function converterParaNumero(valor: ValorContextoTemplate | undefined): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "boolean") return valor ? 1 : 0;
  if (typeof valor !== "string") return null;

  const limpo = valor.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return null;

  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado);
  return Number.isNaN(numero) ? null : numero;
}

/** Extrai o conteúdo de um literal de string `"..."`/`'...'`; `null` se não estiver entre aspas. */
function extrairLiteralString(bruto: string): string | null {
  const texto = bruto.trim();
  if (texto.length >= 2) {
    const primeiro = texto[0];
    const ultimo = texto[texto.length - 1];
    if ((primeiro === '"' && ultimo === '"') || (primeiro === "'" && ultimo === "'")) {
      return texto.slice(1, -1);
    }
  }
  return null;
}

const PADRAO_CONDICAO_COM_OPERADOR = /^(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;

function avaliarCondicao(condicaoBruta: string, escopos: PilhaEscopos, naoResolvidas: Set<string>): boolean {
  const comOperador = PADRAO_CONDICAO_COM_OPERADOR.exec(condicaoBruta.trim());

  if (!comOperador) {
    const nomeCampo = condicaoBruta.trim();
    if (!/^\w+$/.test(nomeCampo)) {
      throw new MotorTemplateCondicionalError(`Condição inválida em "{{#se ${condicaoBruta}}}".`);
    }
    const { encontrado, valor } = buscarCampo(nomeCampo, escopos);
    if (!encontrado) naoResolvidas.add(nomeCampo);
    return ehVerdadeiro(valor);
  }

  const [, nomeCampo = "", operador = "", ladoDireitoBruto = ""] = comOperador;
  const { encontrado, valor } = buscarCampo(nomeCampo, escopos);
  if (!encontrado) naoResolvidas.add(nomeCampo);

  const literalString = extrairLiteralString(ladoDireitoBruto);
  if (literalString !== null) {
    if (operador !== "==" && operador !== "!=") {
      throw new MotorTemplateCondicionalError(
        `Operador "${operador}" só é válido para comparação numérica, não com texto entre aspas (condição: "${condicaoBruta}").`,
      );
    }
    const valorTexto = formatarValorEscalar(valor) ?? "";
    return operador === "==" ? valorTexto === literalString : valorTexto !== literalString;
  }

  const literalNumero = converterParaNumero(ladoDireitoBruto.trim());
  const valorNumero = converterParaNumero(valor);
  if (literalNumero === null || valorNumero === null) return false;

  switch (operador) {
    case "==":
      return valorNumero === literalNumero;
    case "!=":
      return valorNumero !== literalNumero;
    case ">":
      return valorNumero > literalNumero;
    case "<":
      return valorNumero < literalNumero;
    case ">=":
      return valorNumero >= literalNumero;
    case "<=":
      return valorNumero <= literalNumero;
    default:
      return false;
  }
}

function avaliarNos(
  nos: No[],
  escopos: PilhaEscopos,
  variaveisUsadas: Record<string, string>,
  naoResolvidas: Set<string>,
): string {
  let saida = "";

  for (const no of nos) {
    if (no.tipo === "texto") {
      saida += no.valor;
      continue;
    }

    if (no.tipo === "var") {
      const { encontrado, valor } = buscarCampo(no.nome, escopos);
      const formatado = encontrado ? formatarValorEscalar(valor) : null;
      if (formatado === null) {
        naoResolvidas.add(no.nome);
        saida += "não informado";
      } else {
        variaveisUsadas[no.nome] = formatado;
        saida += formatado;
      }
      continue;
    }

    if (no.tipo === "se") {
      const verdadeiro = avaliarCondicao(no.condicao, escopos, naoResolvidas);
      const ramo = verdadeiro ? no.verdadeiro : no.falso;
      saida += avaliarNos(ramo, escopos, variaveisUsadas, naoResolvidas);
      continue;
    }

    // no.tipo === "cada"
    const { encontrado, valor } = buscarCampo(no.colecao, escopos);
    if (!encontrado) naoResolvidas.add(no.colecao);
    if (!Array.isArray(valor)) continue; // coleção ausente/vazia/typo: 0 itens, nunca quebra

    valor.forEach((item, indice) => {
      const escopoItem: RegistroTemplate = { ...item, indice: indice + 1 };
      saida += avaliarNos(no.filhos, [escopoItem, ...escopos], variaveisUsadas, naoResolvidas);
    });
  }

  return saida;
}

/**
 * Executa o mail-merge condicional completo: recebe o texto bruto do modelo
 * (com `{{variavel}}`, `{{#se}}`/`{{#senao}}`/`{{/se}}` e
 * `{{#cada}}`/`{{/cada}}`) e o contexto de dados já resolvido, e retorna o
 * texto final mais o diagnóstico de quais variáveis foram/não foram
 * resolvidas. Lança `MotorTemplateCondicionalError` só para erro de SINTAXE
 * do template (tags desbalanceadas/condição mal-formada) — nunca para dado
 * ausente, que é sempre tratado como "não informado"/coleção vazia.
 */
export function resolverMailMergeCondicional(
  conteudoModelo: string,
  dados: ContextoMailMergeCondicional,
): ResultadoMailMergeCondicional {
  const nos = parseTemplate(conteudoModelo);
  const variaveisUsadas: Record<string, string> = {};
  const naoResolvidasSet = new Set<string>();

  const textoFinal = avaliarNos(nos, [dados], variaveisUsadas, naoResolvidasSet);

  return {
    textoFinal,
    variaveisUsadas,
    variaveisNaoResolvidas: Array.from(naoResolvidasSet),
  };
}
