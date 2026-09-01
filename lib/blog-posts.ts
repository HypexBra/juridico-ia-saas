/**
 * Fonte de verdade dos artigos do blog institucional (`/blog`). Conteúdo
 * estruturado em blocos tipados (sem HTML solto, sem MDX) — renderizado por
 * `app/blog/[slug]/page.tsx`, que também gera o JSON-LD `BlogPosting` a
 * partir dos mesmos campos (título, descrição, datas), nunca uma segunda
 * cópia divergente.
 *
 * Todo o conteúdo é escrito para ensinar primeiro; a menção ao produto
 * Jurídico IA aparece só onde é logicamente o desfecho do problema
 * explicado, nunca como propaganda solta.
 */

export interface BlogBlock {
  readonly type: "h2" | "h3" | "p" | "ul";
  readonly text?: string;
  readonly items?: readonly string[];
}

export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly kicker: string;
  readonly publishedAt: string;
  readonly publishedAtIso: string;
  readonly readingMinutes: number;
  readonly blocks: readonly BlogBlock[];
}

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "como-nao-perder-prazo-djen",
    title: "Como não perder prazo publicado no DJEN",
    description:
      "O Diário de Justiça Eletrônico Nacional unificou as publicações judiciais do Brasil — e também o risco de perder um prazo por não monitorá-lo todos os dias. Veja como estruturar esse acompanhamento.",
    kicker: "Prazos e rotina",
    publishedAt: "12 de agosto de 2026",
    publishedAtIso: "2026-08-12",
    readingMinutes: 6,
    blocks: [
      {
        type: "p",
        text: "Desde a unificação das publicações judiciais no Diário de Justiça Eletrônico Nacional (DJEN), advogados de todo o Brasil passaram a ter uma única fonte oficial para acompanhar intimações — o que resolveu o problema de fragmentação entre dezenas de diários estaduais, mas não resolveu o problema mais antigo do direito processual: perder um prazo por não ter lido a publicação a tempo.",
      },
      {
        type: "h2",
        text: "Por que perder um prazo continua acontecendo mesmo com o DJEN centralizado",
      },
      {
        type: "p",
        text: "Centralizar a fonte não elimina o esforço manual de ler. Um escritório com uma carteira de 80, 150 ou 400 processos ainda precisa abrir o diário todos os dias úteis, localizar as publicações que dizem respeito aos seus processos, interpretar o prazo processual correto (que varia conforme o tipo de ato, o rito e se é contado em dias úteis ou corridos) e transformar isso em uma tarefa com data-limite antes que o prazo comece a correr.",
      },
      {
        type: "p",
        text: "Cada um desses passos é um ponto de falha: uma publicação lida na correria, um prazo contado errado, uma tarefa que nunca chegou a ser criada. O risco não é hipotético — é a principal causa de sinistros em seguros de responsabilidade civil profissional para advogados.",
      },
      {
        type: "h2",
        text: "Um checklist mínimo de monitoramento de prazos",
      },
      {
        type: "ul",
        items: [
          "Verificação diária do DJEN vinculada a cada processo em andamento, não uma leitura genérica do diário.",
          "Registro da data de publicação (não da data de leitura) como referência para contar o prazo.",
          "Cálculo do prazo considerando o tipo de prazo (dias úteis para atos processuais, conforme o CPC) e o calendário de feriados forenses da comarca.",
          "Criação automática de uma tarefa com responsável e data-limite assim que o prazo é identificado — nunca dependendo da memória de quem leu a publicação.",
          "Uma segunda camada de revisão (humana ou automática) antes da data-limite, com folga de pelo menos 2 dias úteis para imprevistos.",
        ],
      },
      {
        type: "h3",
        text: "Planilha versus monitoramento automatizado",
      },
      {
        type: "p",
        text: "Uma planilha resolve o problema até o volume de processos crescer. O gargalo não é a planilha em si, mas o passo anterior a ela: alguém ainda precisa ler o DJEN inteiro, todos os dias, para saber o que colocar na planilha. É esse passo — a leitura e a triagem — que compensa automatizar primeiro.",
      },
      {
        type: "h2",
        text: "Como o Jurídico IA resolve esse ponto especificamente",
      },
      {
        type: "p",
        text: "O Jurídico IA monitora o DJEN vinculado a cada processo cadastrado no sistema, identifica as publicações relevantes e cria automaticamente a tarefa correspondente na linha do tempo do caso — com prazo calculado e responsável definido. O advogado não precisa abrir o diário: ele recebe a tarefa já pronta para ser validada e vira o item para tratamento humano, não para descoberta manual.",
      },
      {
        type: "p",
        text: "Isso não substitui a conferência do advogado — nenhuma automação deveria substituir esse julgamento final —, mas elimina o ponto mais frágil da cadeia: a leitura diária e manual de um diário extenso, feita sob pressão de tempo, entre outras dezenas de tarefas do escritório.",
      },
    ],
  },
  {
    slug: "como-auditar-peticao-antes-de-protocolar",
    title: "Como auditar uma petição antes de protocolar",
    description:
      "Protocolar uma peça com um erro de fundamentação, um prazo mal contado ou uma citação incorreta custa caro. Veja um roteiro prático de auditoria antes de assinar qualquer petição.",
    kicker: "Qualidade processual",
    publishedAt: "19 de agosto de 2026",
    publishedAtIso: "2026-08-19",
    readingMinutes: 7,
    blocks: [
      {
        type: "p",
        text: "A revisão de uma petição antes do protocolo costuma ser feita de forma assistemática: uma releitura rápida, atenção ao português e uma conferência visual do cabeçalho. Isso pega erros óbvios, mas deixa passar os erros que mais custam caro — os estruturais, que só aparecem quando alguém audita a peça com um roteiro, não com uma leitura corrida.",
      },
      {
        type: "h2",
        text: "O que uma auditoria de petição deveria verificar",
      },
      {
        type: "h3",
        text: "1. Fundamentação jurídica",
      },
      {
        type: "p",
        text: "Todo artigo de lei, súmula ou precedente citado existe de fato e diz o que a peça afirma que diz? É comum uma citação estar correta no número, mas desatualizada no conteúdo (lei revogada, súmula cancelada, precedente superado). Auditar significa checar cada fonte, não confiar que ela está certa porque parece certa.",
      },
      {
        type: "h3",
        text: "2. Coerência com os fatos do processo",
      },
      {
        type: "p",
        text: "A narrativa da peça precisa bater com os documentos do caso: datas, valores, nomes de partes e a sequência de fatos alegados. Peças construídas a partir de modelos reaproveitados de outro processo são a fonte mais comum de inconsistência — um trecho do processo anterior que não foi ajustado ao caso atual.",
      },
      {
        type: "h3",
        text: "3. Prazos e tempestividade",
      },
      {
        type: "p",
        text: "A peça está sendo protocolada dentro do prazo processual correto? Vale reconferir a contagem antes de protocolar, principalmente quando o prazo foi calculado há alguns dias e a peça só ficou pronta perto do limite.",
      },
      {
        type: "h3",
        text: "4. Pedidos e dispositivo",
      },
      {
        type: "p",
        text: "Os pedidos ao final da peça correspondem exatamente ao que foi fundamentado no corpo do texto? É comum a fundamentação evoluir durante a redação e o rol de pedidos não ser atualizado — pedindo menos (ou algo diferente) do que a tese desenvolvida sustenta.",
      },
      {
        type: "ul",
        items: [
          "Toda citação de lei, súmula ou precedente foi conferida na fonte original?",
          "A narrativa dos fatos é consistente com os documentos anexados ao caso?",
          "O prazo de protocolo está confirmado, não apenas lembrado de memória?",
          "Os pedidos finais refletem toda a fundamentação apresentada?",
          "Não há trechos de outro processo esquecidos por reaproveitamento de modelo?",
        ],
      },
      {
        type: "h2",
        text: "Por que isso importa mais do que revisão gramatical",
      },
      {
        type: "p",
        text: "Um erro de português raramente compromete um processo. Uma citação incorreta, uma inconsistência factual ou um pedido mal formulado podem comprometer a tese inteira, gerar embargos de declaração desnecessários ou, no pior caso, o indeferimento do pedido. A auditoria estrutural é o que protege o resultado do caso — a revisão gramatical protege a imagem do escritório.",
      },
      {
        type: "h2",
        text: "Como o Jurídico IA automatiza esse roteiro",
      },
      {
        type: "p",
        text: "Antes de qualquer peça ser assinada, o Jurídico IA roda uma auditoria automática que confere fundamentação, coerência com os documentos do caso e consistência entre a tese e os pedidos — sinalizando pontos de atenção para revisão do advogado antes do protocolo. É esse mesmo motor que também simula a tese \"pelo lado contrário\" (a funcionalidade de advogado do contra), testando a petição contra os argumentos que a outra parte provavelmente vai usar, antes que ela chegue ao protocolo.",
      },
      {
        type: "p",
        text: "A auditoria não substitui a revisão do advogado — a decisão final e a responsabilidade pela peça continuam sendo dele —, mas transforma uma checagem que dependia de lembrar todos os pontos do roteiro acima em algo que roda automaticamente antes de cada assinatura.",
      },
    ],
  },
  {
    slug: "riscos-ia-alucina-jurisprudencia",
    title: "Riscos de IA que alucina jurisprudência e como evitar",
    description:
      "Casos de peças protocoladas com jurisprudência inventada por IA já geraram sanções em tribunais no Brasil e no exterior. Entenda por que isso acontece e como reduzir esse risco na prática.",
    kicker: "IA e responsabilidade profissional",
    publishedAt: "26 de agosto de 2026",
    publishedAtIso: "2026-08-26",
    readingMinutes: 7,
    blocks: [
      {
        type: "p",
        text: "\"Alucinação\" é o termo técnico usado quando um modelo de linguagem gera uma informação com aparência de fato, mas que não corresponde à realidade — no direito, isso costuma aparecer como uma citação de lei que não existe, um número de precedente que não corresponde ao conteúdo citado, ou uma súmula que foi cancelada há anos e é citada como vigente. O texto sai fluente e convincente; o problema é que ele está errado.",
      },
      {
        type: "h2",
        text: "Por que isso acontece com modelos de linguagem",
      },
      {
        type: "p",
        text: "Um modelo de linguagem generativa não consulta um banco de dados de jurisprudência real por padrão — ele prevê a sequência de palavras mais provável com base no que aprendeu durante o treinamento. Quando o modelo não \"sabe\" um precedente específico, ele pode gerar algo que parece plausível (um número de processo bem formatado, um tribunal real, uma tese jurídica coerente) sem que aquilo exista de fato. Isso não é uma falha rara e isolada: é uma característica estrutural de como esses modelos funcionam quando usados sem um mecanismo de verificação externo.",
      },
      {
        type: "h2",
        text: "O que já aconteceu na prática",
      },
      {
        type: "p",
        text: "Desde 2023, casos de advogados sancionados por protocolar peças com jurisprudência inventada por IA generativa se tornaram recorrentes em tribunais de diversos países, incluindo decisões do Judiciário brasileiro sobre o tema. O padrão é sempre o mesmo: uma peça citando precedentes que, ao serem checados pela parte contrária ou pelo próprio julgador, não existem ou dizem algo completamente diferente do que foi citado.",
      },
      {
        type: "h2",
        text: "Como reduzir esse risco na prática",
      },
      {
        type: "ul",
        items: [
          "Nunca cite um precedente ou súmula gerado por IA sem localizá-lo na fonte oficial (tribunal, base de jurisprudência ou diário) antes de usar.",
          "Prefira ferramentas que retornem a fonte junto da citação, não apenas o texto pronto — sem link ou identificação verificável, a citação não pode ser confirmada.",
          "Desconfie de citações \"perfeitas demais\": números de processo redondos, ementas muito alinhadas ao argumento e ausência de qualquer nuance costumam ser sinal de geração sem base real.",
          "Trate toda saída de IA como rascunho de um associado júnior: útil como ponto de partida, mas que precisa de conferência antes de virar peça protocolada.",
        ],
      },
      {
        type: "h2",
        text: "Como o Jurídico IA foi construído para lidar com isso",
      },
      {
        type: "p",
        text: "O sistema é instruído a nunca inventar leis, súmulas ou precedentes — e uma resposta sem fonte verificável não é entregue como se fosse fato consolidado. A pesquisa jurisprudencial do produto hoje está limitada ao STJ, usando dados abertos oficiais do tribunal, exatamente para que toda citação apresentada possa ser conferida na fonte, em vez de ampliar a cobertura às custas de citações não verificáveis.",
      },
      {
        type: "p",
        text: "Essa é uma limitação deliberada, não um recurso pendente de \"em breve\": cobrir mais tribunais só faz sentido quando a verificação de fonte acompanha a expansão. Enquanto isso, a responsabilidade final de conferir toda citação antes de protocolar continua sendo do advogado — a ferramenta reduz o volume de trabalho de checagem, não a elimina.",
      },
    ],
  },
] as const;

export function obterBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
