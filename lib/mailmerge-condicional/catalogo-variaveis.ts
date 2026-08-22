/**
 * Catálogo estático (PURO, zero I/O) de TODAS as variáveis que o mail-merge
 * condicional resolve para uma ficha — as pré-existentes de
 * `montar-dados.ts` (ficha + prazos + contratos + parcelas) e as novas do
 * Caso Inteligente (`contexto-caso.ts`: pessoas, eventos, teses, tarefas,
 * estratégia). Duas funções:
 *
 * 1. Documentação viva para a UI: a página da ficha importa este array no
 *    servidor e repassa ao card client (`AutomacaoCondicionalCard`), que
 *    renderiza a seção colapsável "Variáveis disponíveis" — o catálogo nunca
 *    fica desatualizado porque os testes garantem que ele cobre EXATAMENTE
 *    as chaves produzidas pelos módulos de montagem.
 * 2. Referência programática (`variaveisRaizDoCatalogo`) para validações.
 *
 * Grupos com `colecao` preenchido documentam os campos disponíveis DENTRO de
 * um bloco `{{#cada <colecao>}}...{{/cada}}`; grupos com `colecao: null`
 * documentam variáveis de nível raiz (fora de loops).
 */

export type VariavelCatalogo = {
  /** Nome da variável entre chaves duplas (ou nome de campo dentro do loop). */
  chave: string;
  /** Descrição curta em PT-BR exibida ao lado do código na UI. */
  descricao: string;
};

export type GrupoVariaveisCatalogo = {
  /** Título do grupo na UI (ex: "Pessoas do caso"). */
  grupo: string;
  /**
   * Nome da coleção usada em `{{#cada <colecao>}}` quando o grupo documenta
   * campos de itens; `null` para variáveis de nível raiz.
   */
  colecao: string | null;
  variaveis: VariavelCatalogo[];
};

const DESCRICAO_INDICE =
  "Posição do item na repetição, começando em 1 — injetada automaticamente pelo motor.";

/**
 * Ordem pensada para leitura humana: raiz primeiro (ficha → contadores →
 * estratégia), depois coleções na ordem de uso mais comum.
 */
export const CATALOGO_VARIAVEIS_CASO: readonly GrupoVariaveisCatalogo[] = [
  {
    grupo: "Ficha do caso",
    colecao: null,
    variaveis: [
      { chave: "nome_cliente", descricao: "Nome do cliente informado na triagem (ou vinculado à ficha)." },
      { chave: "numero_processo", descricao: "Número CNJ do primeiro prazo que tenha processo preenchido." },
      { chave: "area_direito", descricao: "Área do direito cadastrada na ficha." },
      { chave: "valor_causa", descricao: "Soma dos contratos de honorário, formatada em R$." },
      { chave: "data_hoje", descricao: 'Data de geração do documento (ex: "22/08/2026").' },
    ],
  },
  {
    grupo: "Contadores do caso inteligente",
    colecao: null,
    variaveis: [
      { chave: "total_pessoas", descricao: "Quantidade de pessoas envolvidas cadastradas no caso." },
      { chave: "total_eventos", descricao: "Quantidade de eventos na linha do tempo do caso." },
      { chave: "total_tarefas", descricao: "Quantidade de tarefas internas do caso." },
      { chave: "total_teses", descricao: "Quantidade de teses jurídicas avaliadas no caso." },
    ],
  },
  {
    grupo: "Estratégia (Estrategista Jurídico)",
    colecao: null,
    variaveis: [
      {
        chave: "estrategia_objetivo",
        descricao: "Objetivo definido pela estratégia mais recente concluída ('não informado' se nunca gerada).",
      },
      {
        chave: "estrategia_tese_principal",
        descricao: "Tese principal da estratégia (resolvida contra as teses do caso quando por referência).",
      },
    ],
  },
  {
    grupo: "Parcelas de honorário",
    colecao: "parcelas",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "numero_parcela", descricao: "Número sequencial da parcela no contrato." },
      { chave: "valor", descricao: "Valor da parcela formatado em R$." },
      { chave: "valor_numero", descricao: "Valor cru (número) para comparações {{#se valor_numero > 100}}." },
      { chave: "vencimento", descricao: "Vencimento formatado em data pt-BR." },
      { chave: "status", descricao: '"pendente", "pago" ou "atrasado".' },
      { chave: "atrasada", descricao: "true quando paga fora do prazo ou vencida e ainda pendente." },
      { chave: "dias_atraso", descricao: "Dias corridos desde o vencimento (0 se não houver atraso)." },
    ],
  },
  {
    grupo: "Prazos processuais",
    colecao: "prazos",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "titulo", descricao: "Título do prazo." },
      { chave: "descricao", descricao: "Detalhamento opcional do prazo." },
      { chave: "data_prazo", descricao: "Data do prazo formatada em pt-BR (ordenados pela mais próxima)." },
      { chave: "processo", descricao: "Número CNJ vinculado ao prazo, se houver." },
      { chave: "concluido", descricao: "true quando o prazo já foi cumprido." },
    ],
  },
  {
    grupo: "Contratos de honorário",
    colecao: "contratos",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "tipo", descricao: 'Tipo do contrato ("fixo", "exito" etc.).' },
      { chave: "valor_total", descricao: "Valor total formatado em R$." },
      { chave: "valor_total_numero", descricao: "Valor cru (número) para comparações numéricas." },
      { chave: "percentual_exito", descricao: "Percentual de êxito acordado, quando existir." },
    ],
  },
  {
    grupo: "Pessoas do caso",
    colecao: "pessoas",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "nome", descricao: "Nome da pessoa envolvida (cliente, parte adversa, testemunha…)." },
      { chave: "tipo", descricao: '"parte", "adverso", "testemunha" ou "terceiro".' },
      { chave: "papel_processual", descricao: "Papel processual livre (ex: autor, réu, fiador)." },
      { chave: "documento", descricao: "CPF/CNPJ/documento informado, se houver." },
      { chave: "contato", descricao: "Telefone/e-mail informado, se houver." },
      { chave: "adversa", descricao: "true quando a pessoa é da parte adversa ({{#se adversa}})." },
      { chave: "tem_documento", descricao: "true quando há documento preenchido." },
      { chave: "tem_contato", descricao: "true quando há contato preenchido." },
    ],
  },
  {
    grupo: "Linha do tempo",
    colecao: "eventos",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "data", descricao: "Data do evento formatada em pt-BR (ordenados da mais antiga para a mais recente)." },
      { chave: "descricao", descricao: "Descrição do evento (movimentação, audiência, publicação…)." },
      { chave: "tipo_evento", descricao: "Tipo livre do evento (ex: despacho, sentença, petição)." },
      { chave: "origem", descricao: '"manual", "ia", "djen" ou "documento".' },
      { chave: "ultimo", descricao: "true apenas no evento mais recente da linha do tempo." },
    ],
  },
  {
    grupo: "Teses do caso",
    colecao: "teses",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "tese", descricao: "Texto da tese jurídica avaliada." },
      { chave: "fundamentacao", descricao: "Fundamentação da tese, se preenchida." },
      { chave: "status", descricao: '"em_avaliacao", "adotada" ou "descartada".' },
      { chave: "adotada", descricao: "true quando a tese foi adotada ({{#se adotada}})." },
    ],
  },
  {
    grupo: "Tarefas do caso",
    colecao: "tarefas",
    variaveis: [
      { chave: "indice", descricao: DESCRICAO_INDICE },
      { chave: "titulo", descricao: "Título da tarefa interna (pendentes aparecem antes das concluídas)." },
      { chave: "status", descricao: '"pendente", "em_andamento" ou "concluida".' },
      { chave: "prioridade", descricao: '"baixa", "media" ou "alta".' },
      { chave: "prazo", descricao: "Prazo interno opcional formatado em pt-BR." },
      { chave: "concluida", descricao: "true quando a tarefa já foi concluída." },
      { chave: "atrasada", descricao: "true quando passou do prazo e ainda não foi concluída." },
    ],
  },
];

/** Chaves de nível raiz (fora de qualquer `{{#cada}}`) na ordem do catálogo. */
export function variaveisRaizDoCatalogo(): string[] {
  return CATALOGO_VARIAVEIS_CASO.filter((grupo) => grupo.colecao === null).flatMap((grupo) =>
    grupo.variaveis.map((variavel) => variavel.chave),
  );
}

/** Chaves documentadas para uma coleção (campos dentro do `{{#cada}}`); [] se não catalogada. */
export function variaveisDaColecao(colecao: string): string[] {
  return CATALOGO_VARIAVEIS_CASO.filter((grupo) => grupo.colecao === colecao).flatMap((grupo) =>
    grupo.variaveis.map((variavel) => variavel.chave),
  );
}
