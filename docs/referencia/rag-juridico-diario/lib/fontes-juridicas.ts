// lib/fontes-juridicas.ts
//
// Cada função abaixo representa UMA fonte jurídica monitorada pelo job diário.
// Estão com dados de EXEMPLO — troque pela chamada real de cada API/scraper.
// Todas devolvem o mesmo formato, para o job de atualização tratar de forma genérica.

export interface DocumentoJuridico {
  fonte: string;
  tipo: "jurisprudencia" | "sumula" | "lei" | "movimentacao";
  titulo: string;
  conteudo: string;
  urlOriginal: string;
  tribunalVara?: string;
  relator?: string;
  dataPublicacao: string; // formato YYYY-MM-DD
}

// --- DJEN --------------------------------------------------------------
// O projeto já tem integração com sistemas de tribunal (PJe/e-SAJ/Projudi/SAJ)
// via monitor-processual.jsx. Se essa integração já busca movimentações do DJEN,
// REAPROVEITE essa função aqui em vez de duplicar a lógica de busca.
export async function buscarAtualizacoesDJEN(
  desde: Date
): Promise<DocumentoJuridico[]> {
  // TODO: substituir pela chamada real à integração DJEN já existente no projeto.
  // Exemplo de formato de retorno esperado:
  return [
    {
      fonte: "djen",
      tipo: "movimentacao",
      titulo: "Exemplo de movimentação — substituir por dado real",
      conteudo: "Conteúdo de exemplo da movimentação publicada no diário oficial.",
      urlOriginal: "https://www.djen.jus.br/exemplo",
      dataPublicacao: new Date().toISOString().slice(0, 10),
    },
  ];
}

// --- Tribunais superiores (STJ/STF) — jurisprudência -------------------
export async function buscarJurisprudenciaTribunaisSuperiores(
  desde: Date
): Promise<DocumentoJuridico[]> {
  // TODO: plugar API real de jurisprudência (ex: API pública do STJ/STF,
  // ou um fornecedor de jurimetria, conforme decisão do item P2.1 do backlog).
  return [
    {
      fonte: "stj",
      tipo: "jurisprudencia",
      titulo: "Exemplo de acórdão — substituir por dado real",
      conteudo: "Ementa de exemplo do acórdão.",
      urlOriginal: "https://www.stj.jus.br/exemplo",
      relator: "Min. Exemplo da Silva",
      dataPublicacao: new Date().toISOString().slice(0, 10),
    },
  ];
}

// --- Legislação federal -------------------------------------------------
export async function buscarAtualizacoesLegislacao(
  desde: Date
): Promise<DocumentoJuridico[]> {
  // TODO: plugar fonte real de legislação (ex: LexML, Planalto).
  return [
    {
      fonte: "planalto",
      tipo: "lei",
      titulo: "Exemplo de alteração legislativa — substituir por dado real",
      conteudo: "Texto de exemplo da alteração legislativa.",
      urlOriginal: "https://www.planalto.gov.br/exemplo",
      dataPublicacao: new Date().toISOString().slice(0, 10),
    },
  ];
}

// Lista central de todas as fontes que o job diário deve percorrer.
// Adicionar uma fonte nova = adicionar uma linha aqui.
export const FONTES_JURIDICAS = [
  { nome: "djen", buscar: buscarAtualizacoesDJEN },
  { nome: "tribunais_superiores", buscar: buscarJurisprudenciaTribunaisSuperiores },
  { nome: "legislacao", buscar: buscarAtualizacoesLegislacao },
];
