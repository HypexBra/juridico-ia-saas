import type { ResultadoAnaliseProcesso } from "@/lib/analise-processo/tipos";

export type Role = "owner" | "admin" | "advogado";

export type Escritorio = {
  id: string;
  nome: string;
  slug: string;
  plano: "free" | "pro";
  /**
   * Overrides pontuais de feature premium por escritório (migration 0012),
   * ex: `{ "analise_risco_contratual": true }` libera 1 feature pro num
   * escritório free sem mudar `plano`. Tipo solto aqui (evita import de
   * `FeaturePremium` em `lib/types.ts`, que é importado por praticamente
   * todo o app); `lib/planos/gating.ts` é quem interpreta as chaves.
   */
  features_overrides: Record<string, boolean> | null;
  criado_em: string;
};

export type Perfil = {
  id: string;
  auth_user_id: string;
  escritorio_id: string;
  nome: string;
  role: Role;
  ativo: boolean;
  oab: string | null;
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

export type FonteCitadaMensagem = {
  tipo: "documento_upload" | "ficha_caso" | "prazo" | "modelo" | "jurisprudencia";
  fonteId: string;
  label: string;
  href: string | null;
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
  fontes: FonteCitadaMensagem[] | null;
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

/**
 * Andamento/resultado do processo judicial em si (distinto de
 * `conversas.status`, que é o status do CHAT de triagem, e de `lida`, que é
 * só inbox). Ver `supabase/migrations/0011_status_processual_caso.sql` para
 * o porquê desta coluna existir. `em_andamento` é o estado inicial de toda
 * ficha nova; `ganho`/`acordo` confirmam o direito ao êxito (ainda que o
 * valor não esteja parcelado); `perdido`/`arquivado` encerram sem êxito.
 */
export type StatusProcessualFicha = "em_andamento" | "ganho" | "acordo" | "perdido" | "arquivado";

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
  nivel_risco: "baixo" | "medio" | "alto" | null;
  risco_calculado_em: string | null;
  status_processual: StatusProcessualFicha;
  status_processual_atualizado_em: string | null;
  /**
   * Soft delete (migration 0022) — `excluirFichaAction` passa a marcar esta
   * coluna em vez de fazer DELETE físico. `null` = ficha ativa. A policy
   * RLS de select já filtra `deletado_em is null` por padrão, então uma
   * ficha carregada do client normalmente vem com este campo `null`; só
   * aparece preenchido em rotas administrativas que leiam via service_role.
   */
  deletado_em: string | null;
  criado_em: string;
};

/** "Caso Inteligente" (Fase 1, migration 0023) — pessoa envolvida no caso além do cliente principal. */
export type TipoPessoaCaso = "parte" | "adverso" | "testemunha" | "terceiro";

export type PessoaCaso = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  tipo: TipoPessoaCaso;
  nome: string;
  documento: string | null;
  contato: string | null;
  papel_processual: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** "Caso Inteligente" (Fase 1, migration 0024) — linha do tempo do caso (append-only). */
export type OrigemEventoCaso = "manual" | "ia" | "djen" | "documento";

export type EventoCaso = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  tipo_evento: string;
  descricao: string;
  data_evento: string;
  origem: OrigemEventoCaso;
  referencia_id: string | null;
  criado_por: string | null;
  criado_em: string;
};

/** "Caso Inteligente" (Fase 1, migration 0025) — tese jurídica avaliada para o caso. */
export type StatusTeseCaso = "em_avaliacao" | "adotada" | "descartada";

export type EntradaHistoricoTeseCaso = {
  em: string;
  status_anterior: StatusTeseCaso | null;
  status_novo: StatusTeseCaso;
  nota: string | null;
};

export type TeseCaso = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  tese: string;
  fundamentacao: string | null;
  status: StatusTeseCaso;
  historico: EntradaHistoricoTeseCaso[];
  criado_em: string;
  atualizado_em: string;
};

/** "Caso Inteligente" (Fase 1, migration 0026) — jurisprudência (tabela pública `jurisprudencias`) citada num caso. */
export type CasoJurisprudenciaCitada = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  jurisprudencia_id: string;
  nota_advogado: string | null;
  criado_em: string;
};

/** "Caso Inteligente" (Fase 1, migration 0027) — tarefa operacional do caso (distinta de `Prazo`, que é processual/legal). */
export type StatusTarefaCaso = "pendente" | "em_andamento" | "concluida";

export type TarefaCaso = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  titulo: string;
  responsavel_perfil_id: string | null;
  status: StatusTarefaCaso;
  prazo_opcional: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** "Caso Inteligente" (Fase 1, migration 0028) — memória incremental de IA por caso (append-only). */
export type TipoMemoriaIaCaso = "resumo_acumulado" | "decisao" | "fato_novo";

export type MemoriaIaCaso = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  tipo_memoria: TipoMemoriaIaCaso;
  conteudo: string;
  criado_em: string;
};

/**
 * "Caso Inteligente" (Fase 2, migration 0030) — análise inteligente de um
 * documento do processo (PDF/DOCX/imagem) vinculado a uma `FichaCaso`. As 12
 * seções da análise (`resultado_analise`) são tipadas em
 * `ResultadoAnaliseProcesso` (`lib/analise-processo/tipos.ts`), não aqui —
 * mesmo padrão de `ResultadoAnaliseRisco` (`lib/redline/tipos.ts`) para
 * `analises_risco_contratual` (migration 0017). Ver
 * `docs/adrs/0004-analise-inteligente-processos.md`.
 */
export type TipoArquivoAnaliseProcesso = "pdf" | "docx" | "imagem";
export type StatusAnaliseProcesso = "processando" | "pronto" | "erro";

export type AnaliseProcesso = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  nome_arquivo: string;
  tipo_arquivo: TipoArquivoAnaliseProcesso;
  tamanho_bytes: number;
  status: StatusAnaliseProcesso;
  /** Estrutura `ResultadoAnaliseProcesso` — `null` enquanto `status = "processando"`. */
  resultado_analise: ResultadoAnaliseProcesso | null;
  modelo_ia_usado: string | null;
  erro: string | null;
  criado_por: string | null;
  criado_em: string;
  processado_em: string | null;
};

export type StatusLeadTriagem = "novo" | "em_analise" | "convertido" | "descartado";

export type LeadTriagemPublica = {
  id: string;
  escritorio_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  relato: string;
  tipo_caso_ia: string | null;
  urgencia_ia: "baixa" | "normal" | "alta" | null;
  viabilidade_ia: "baixa" | "media" | "alta" | null;
  resumo_ia: string | null;
  status: StatusLeadTriagem;
  ficha_caso_id: string | null;
  ip_origem: string | null;
  criado_em: string;
};

export type OrigemPrazo = "manual" | "djen" | "importado";

/**
 * Causa da dobra de prazo do CPC (migration 0010): art. 180 (Ministério
 * Público), 183 (Fazenda Pública) e 186 (Defensoria Pública) — dobro de
 * prazo. `prazo_em_dobro` (0003) guarda o RESULTADO já calculado; este campo
 * guarda a CAUSA, usada por `lib/prazos/calculadora.ts` para decidir sozinha
 * se dobra e explicar o motivo na tela.
 */
export type ParteContrariaTipo =
  | "particular"
  | "fazenda_publica"
  | "ministerio_publico"
  | "defensoria_publica";

export type Prazo = {
  id: string;
  escritorio_id: string;
  criado_por: string | null;
  ficha_caso_id: string | null;
  titulo: string;
  descricao: string | null;
  data_prazo: string;
  processo: string | null;
  cliente_nome: string | null;
  concluido: boolean;
  numero_processo_cnj: string | null;
  origem: OrigemPrazo;
  tribunal: string | null;
  data_intimacao: string | null;
  prazo_em_dobro: boolean;
  /** UF da comarca/tribunal (migration 0010) — casa com `feriados_forenses.uf`. */
  uf: string | null;
  parte_contraria_tipo: ParteContrariaTipo;
  criado_em: string;
};

export type SincronizacaoDjen = {
  id: string;
  escritorio_id: string;
  oab_consultada: string;
  ultima_consulta_em: string | null;
  ultimo_id_comunicacao_processado: string | null;
  criado_em: string;
};

export type ClientePortal = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  token_convite: string | null;
  convite_expira_em: string | null;
  criado_em: string;
};

export type TipoContratoHonorario = "fixo" | "exito" | "aaj";

export type ContratoHonorario = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  tipo: TipoContratoHonorario;
  valor_total: number | null;
  percentual_exito: number | null;
  criado_em: string;
};

export type StatusParcelaHonorario = "pendente" | "pago" | "atrasado";

export type ParcelaHonorario = {
  id: string;
  escritorio_id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  vencimento: string;
  status: StatusParcelaHonorario;
  pago_em: string | null;
  criado_em: string;
};

export type RateioSocio = {
  id: string;
  escritorio_id: string;
  contrato_id: string;
  perfil_id: string;
  percentual: number;
  criado_em: string;
};

export type StatusDocumentoAssinatura = "rascunho" | "aguardando_assinatura" | "assinado" | "recusado";
export type ProvedorAssinatura = "clicksign" | "autentique";

export type StatusSignatario = "pendente" | "assinado" | "recusado";

export type SignatarioDocumento = {
  nome: string;
  email: string;
  status: StatusSignatario;
};

export type DocumentoParaAssinatura = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string | null;
  modelo_id: string | null;
  proposta_acao_id: string | null;
  criado_por: string | null;
  nome_documento: string;
  arquivo_gerado_em: string | null;
  status: StatusDocumentoAssinatura;
  provedor: ProvedorAssinatura | null;
  id_externo_provedor: string | null;
  signatarios: SignatarioDocumento[];
  criado_em: string;
};

export type NotificacaoCliente = {
  id: string;
  escritorio_id: string;
  cliente_portal_id: string;
  ficha_caso_id: string | null;
  tipo: string;
  mensagem: string;
  lida: boolean;
  enviada_em: string | null;
  criado_em: string;
};

export type RemetenteMensagemPortal = "cliente" | "escritorio";

/**
 * Chat bidirecional cliente <-> escritório (feature Pro
 * "portal_cliente_rico", migration 0019). Independente de `Conversa`/
 * `Mensagem` (chat interno do escritório).
 */
export type MensagemPortalCliente = {
  id: string;
  escritorio_id: string;
  ficha_caso_id: string;
  cliente_portal_id: string;
  remetente: RemetenteMensagemPortal;
  conteudo: string;
  lida: boolean;
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

export type PeticaoGerada = {
  id: string;
  escritorio_id: string;
  modelo_id: string;
  ficha_caso_id: string | null;
  gerado_por: string | null;
  variaveis_usadas: Record<string, string>;
  criado_em: string;
};

/**
 * Status Stripe da assinatura (migration 0012). `inexistente` é o valor
 * inicial (nunca fez checkout) — não confundir com `canceled` (já foi
 * assinante e cancelou). Espelha o campo `status` de uma Subscription do
 * Stripe 1:1, exceto `inexistente` que é local.
 */
export type StatusAssinaturaStripe =
  | "inexistente"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

/**
 * Espelho local da subscription no Stripe (migration 0012) — usada para
 * auditoria/tela "minha assinatura". NÃO é a fonte de verdade do gating de
 * feature: isso é `escritorios.plano`, atualizado pelo webhook Stripe
 * (`app/api/webhooks/stripe/route.ts`) sempre que este registro muda de
 * status. Ver `lib/planos/gating.ts`.
 */
export type Assinatura = {
  id: string;
  escritorio_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: StatusAssinaturaStripe;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type CanalWhatsappEscritorio = {
  id: string;
  escritorio_id: string;
  phone_number_id: string;
  token_acesso: string;
  numero_exibicao: string | null;
  /**
   * Número interno (equipe/advogado do escritório) que recebe o alerta
   * proativo de ficha com urgência alta sem contato (migration 0012).
   * `null` = feature desativada para este escritório (opt-in).
   */
  telefone_alerta_urgencia: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type TipoReferenciaLembrete = "prazo" | "parcela_honorario" | "ficha_urgente";
export type MarcoLembrete = "d3" | "d1" | "d0" | "atraso" | "sem_resposta";
export type StatusLembreteWhatsapp = "enviado" | "falhou";

export type LembreteWhatsappEnviado = {
  id: string;
  escritorio_id: string;
  tipo_referencia: TipoReferenciaLembrete;
  referencia_id: string;
  marco: MarcoLembrete;
  telefone_destino: string;
  status: StatusLembreteWhatsapp;
  mensagem_id_externo: string | null;
  erro: string | null;
  criado_em: string;
};

/** Admin do SaaS (cross-tenant) — ver docs/adrs/0003-admin-plataforma.md. NÃO confundir com `Perfil.role`. */
export type PlataformaAdmin = {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AdminLog = {
  id: string;
  admin_id: string | null;
  admin_nome: string;
  acao: string;
  alvo_tipo: string | null;
  alvo_id: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
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

export const LIMITE_MENSAGENS_FREE = 25; // uso mensal de IA no plano free — baixado de 60 pra empurrar upgrade pro Pro
