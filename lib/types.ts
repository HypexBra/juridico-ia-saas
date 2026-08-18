export type Role = "owner" | "admin" | "advogado";

export type Escritorio = {
  id: string;
  nome: string;
  slug: string;
  plano: "free" | "pro";
  criado_em: string;
};

export type Perfil = {
  id: string;
  auth_user_id: string;
  escritorio_id: string;
  nome: string;
  role: Role;
  ativo: boolean;
  criado_em: string;
};

export type Cliente = {
  id: string;
  escritorio_id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  tipo: "advogado" | "externo";
  criado_em: string;
  ultima_msg: string;
};

export type Conversa = {
  id: string;
  escritorio_id: string;
  cliente_id: string | null;
  criado_por: string | null;
  tipo: "interno" | "triagem";
  status: "ativa" | "triagem_completa" | "encerrada";
  titulo: string | null;
  iniciada_em: string;
  encerrada_em: string | null;
  total_msgs: number;
};

export type Mensagem = {
  id: string;
  escritorio_id: string;
  conversa_id: string;
  role: "user" | "assistant";
  conteudo: string;
  tokens_in: number;
  tokens_out: number;
  proposta_id: string | null;
  criado_em: string;
};

export type TipoPropostaAcao =
  | "update_ficha"
  | "update_prazo"
  | "create_ficha"
  | "create_prazo"
  | "generate_documento";

export type StatusPropostaAcao = "pending" | "approved" | "rejected" | "applied" | "failed" | "expired";

export type PropostaAcao = {
  id: string;
  escritorio_id: string;
  conversa_id: string | null;
  criado_por: string | null;
  tipo: TipoPropostaAcao;
  tabela_alvo: string | null;
  registro_id: string | null;
  resumo: string;
  payload: Record<string, unknown>;
  status: StatusPropostaAcao;
  erro: string | null;
  expira_em: string;
  criado_em: string;
  resolvido_em: string | null;
  resolvido_por: string | null;
};

export type DocumentoConhecimento = {
  id: string;
  escritorio_id: string;
  criado_por: string | null;
  nome_arquivo: string;
  tipo_conteudo: "legislacao" | "jurisprudencia" | "doutrina" | "outro";
  status: "pendente" | "processando" | "pronto" | "erro";
  total_chunks: number;
  erro: string | null;
  criado_em: string;
  processado_em: string | null;
};

export type FichaCaso = {
  id: string;
  escritorio_id: string;
  conversa_id: string | null;
  cliente_id: string | null;
  nome_cliente: string | null;
  telefone: string | null;
  area_direito: string | null;
  resumo_fatos: string | null;
  urgencia: "baixa" | "normal" | "alta";
  resumo_ia: string | null;
  questoes_ia: string | null;
  estrategia_ia: string | null;
  lida: boolean;
  criado_em: string;
};

export type Prazo = {
  id: string;
  escritorio_id: string;
  criado_por: string | null;
  titulo: string;
  descricao: string | null;
  data_prazo: string;
  processo: string | null;
  cliente_nome: string | null;
  concluido: boolean;
  criado_em: string;
};

export type Modelo = {
  id: string;
  escritorio_id: string;
  criado_por: string | null;
  nome: string;
  area: string | null;
  tipo: string | null;
  descricao: string | null;
  conteudo: string;
  uso_count: number;
  criado_em: string;
  atualizado_em: string;
};

export const AREAS_DIREITO = [
  "Trabalhista",
  "Cível",
  "Penal",
  "Tributário",
  "Consumidor",
  "Família",
  "Empresarial",
  "Previdenciário",
  "Administrativo",
  "LGPD",
] as const;

export const LIMITE_MENSAGENS_FREE = 60; // uso mensal de IA no plano free (heurística p/ caber na free tier do Gemini)
