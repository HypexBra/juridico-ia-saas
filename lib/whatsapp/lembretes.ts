import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarWhatsapp } from "./enviar";
import type { MarcoLembrete, TipoReferenciaLembrete } from "@/lib/types";

/**
 * Motor do cron de lembretes via WhatsApp (Meta Cloud API). Roda com
 * `service_role` (sem sessão de usuário, mesmo padrão de
 * `lib/djen/sincronizar.ts`) porque precisa iterar TODOS os escritórios,
 * não só o de um usuário logado.
 *
 * Marcos disparados: D-3, D-1, D-0 (dia do vencimento) e "atraso" (already
 * vencido e ainda pendente/não concluído — dispara só 1x no dia seguinte ao
 * vencimento, não repete todo dia depois disso, ver `calcularMarco`).
 *
 * Idempotência: nunca reenvia o MESMO marco para a MESMA referência —
 * garantido em duas camadas: (1) filtro em memória contra
 * `lembretes_whatsapp_enviados` já registrados antes de disparar qualquer
 * envio; (2) a constraint `unique (tipo_referencia, referencia_id, marco)`
 * no banco, que faz o insert de log falhar silenciosamente (conflito
 * ignorado) se duas execuções concorrentes do cron tentarem gravar o mesmo
 * marco ao mesmo tempo — mais forte que só o filtro em memória.
 */

const NOME_TEMPLATE_PRAZO = process.env.WHATSAPP_TEMPLATE_PRAZO ?? "lembrete_prazo";
const NOME_TEMPLATE_PARCELA = process.env.WHATSAPP_TEMPLATE_PARCELA ?? "lembrete_parcela_honorario";

export type ResultadoLembrete = {
  tipoReferencia: TipoReferenciaLembrete;
  referenciaId: string;
  escritorioId: string;
  marco: MarcoLembrete;
  enviado: boolean;
  motivo?: string;
};

export type ResumoProcessamentoLembretes = {
  candidatos: number;
  jaEnviadosAntes: number;
  enviadosAgora: number;
  falharam: number;
  resultados: ResultadoLembrete[];
};

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function somarDiasISO(baseISO: string, dias: number): string {
  const data = new Date(`${baseISO}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/**
 * Classifica uma data de vencimento/prazo em um marco de lembrete, ou
 * `null` se essa data não corresponde a nenhum marco hoje (ex: falta 5
 * dias — ainda não é hora de avisar).
 */
function calcularMarco(dataVencimentoISO: string, hoje: string): MarcoLembrete | null {
  if (dataVencimentoISO === somarDiasISO(hoje, 3)) return "d3";
  if (dataVencimentoISO === somarDiasISO(hoje, 1)) return "d1";
  if (dataVencimentoISO === hoje) return "d0";
  // "Atraso" dispara só no dia seguinte ao vencimento (1 dia de atraso) —
  // uma janela de 1 dia é suficiente para o marco de idempotência
  // (`unique (tipo_referencia, referencia_id, marco)`) impedir reenvio nos
  // dias seguintes, já que o marco "atraso" só é atribuído uma vez.
  if (dataVencimentoISO === somarDiasISO(hoje, -1)) return "atraso";
  return null;
}

type CandidatoLembrete = {
  tipoReferencia: TipoReferenciaLembrete;
  referenciaId: string;
  escritorioId: string;
  marco: MarcoLembrete;
  telefoneDestino: string;
  textoMensagem: string;
};

async function buscarEscritoriosComCanalAtivo(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("canais_whatsapp_escritorio")
    .select("escritorio_id")
    .eq("ativo", true);
  if (error) throw error;
  return (data ?? []).map((linha) => linha.escritorio_id as string);
}

async function coletarCandidatosPrazos(
  supabase: SupabaseClient,
  escritorioIds: string[],
  hoje: string,
): Promise<CandidatoLembrete[]> {
  if (escritorioIds.length === 0) return [];

  const janelaInicio = somarDiasISO(hoje, -1);
  const janelaFim = somarDiasISO(hoje, 3);

  const { data, error } = await supabase
    .from("prazos")
    .select("id, escritorio_id, titulo, data_prazo, cliente_nome, ficha_caso:ficha_caso_id(telefone)")
    .in("escritorio_id", escritorioIds)
    .eq("concluido", false)
    .gte("data_prazo", janelaInicio)
    .lte("data_prazo", janelaFim);

  if (error) throw error;

  const candidatos: CandidatoLembrete[] = [];
  for (const prazo of data ?? []) {
    const marco = calcularMarco(prazo.data_prazo as string, hoje);
    if (!marco) continue;

    const ficha = prazo.ficha_caso as { telefone: string | null } | { telefone: string | null }[] | null;
    const telefone = Array.isArray(ficha) ? ficha[0]?.telefone : ficha?.telefone;
    if (!telefone) continue; // sem telefone vinculado ao caso — nada a enviar, não é erro

    const rotuloMarco =
      marco === "atraso" ? "venceu ontem e ainda consta em aberto" : `vence em ${formatarRotuloMarco(marco)}`;

    candidatos.push({
      tipoReferencia: "prazo",
      referenciaId: prazo.id as string,
      escritorioId: prazo.escritorio_id as string,
      marco,
      telefoneDestino: telefone,
      textoMensagem: `O prazo "${prazo.titulo}"${prazo.cliente_nome ? ` (cliente: ${prazo.cliente_nome})` : ""} ${rotuloMarco}.`,
    });
  }
  return candidatos;
}

async function coletarCandidatosParcelas(
  supabase: SupabaseClient,
  escritorioIds: string[],
  hoje: string,
): Promise<CandidatoLembrete[]> {
  if (escritorioIds.length === 0) return [];

  const janelaInicio = somarDiasISO(hoje, -1);
  const janelaFim = somarDiasISO(hoje, 3);

  const { data, error } = await supabase
    .from("parcelas_honorario")
    .select(
      "id, escritorio_id, numero_parcela, valor, vencimento, status, contrato:contrato_id(ficha_caso:ficha_caso_id(telefone, nome_cliente))",
    )
    .in("escritorio_id", escritorioIds)
    .in("status", ["pendente", "atrasado"])
    .gte("vencimento", janelaInicio)
    .lte("vencimento", janelaFim);

  if (error) throw error;

  const candidatos: CandidatoLembrete[] = [];
  for (const parcela of data ?? []) {
    const marco = calcularMarco(parcela.vencimento as string, hoje);
    if (!marco) continue;

    type FichaMini = { telefone: string | null; nome_cliente: string | null };
    type ContratoMini = { ficha_caso: FichaMini | FichaMini[] | null };
    const contratoBruto = parcela.contrato as unknown as ContratoMini | ContratoMini[] | null;
    const contrato = Array.isArray(contratoBruto) ? contratoBruto[0] : contratoBruto;
    const fichaBruta = contrato?.ficha_caso;
    const ficha = Array.isArray(fichaBruta) ? fichaBruta[0] : fichaBruta;
    if (!ficha?.telefone) continue;

    const rotuloMarco =
      marco === "atraso" ? "venceu ontem e ainda consta em aberto" : `vence em ${formatarRotuloMarco(marco)}`;
    const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      Number(parcela.valor),
    );

    candidatos.push({
      tipoReferencia: "parcela_honorario",
      referenciaId: parcela.id as string,
      escritorioId: parcela.escritorio_id as string,
      marco,
      telefoneDestino: ficha.telefone,
      textoMensagem: `A parcela nº ${parcela.numero_parcela} de honorários (${valorFormatado})${
        ficha.nome_cliente ? ` de ${ficha.nome_cliente}` : ""
      } ${rotuloMarco}.`,
    });
  }
  return candidatos;
}

function formatarRotuloMarco(marco: MarcoLembrete): string {
  if (marco === "d3") return "em 3 dias";
  if (marco === "d1") return "amanhã";
  return "hoje";
}

/** Remove candidatos cujo marco já foi registrado em `lembretes_whatsapp_enviados`. */
async function filtrarJaEnviados(
  supabase: SupabaseClient,
  candidatos: CandidatoLembrete[],
): Promise<{ pendentes: CandidatoLembrete[]; jaEnviados: number }> {
  if (candidatos.length === 0) return { pendentes: [], jaEnviados: 0 };

  const idsPrazo = candidatos.filter((c) => c.tipoReferencia === "prazo").map((c) => c.referenciaId);
  const idsParcela = candidatos
    .filter((c) => c.tipoReferencia === "parcela_honorario")
    .map((c) => c.referenciaId);

  const { data, error } = await supabase
    .from("lembretes_whatsapp_enviados")
    .select("tipo_referencia, referencia_id, marco")
    .in("referencia_id", [...idsPrazo, ...idsParcela]);

  if (error) throw error;

  const jaEnviadosSet = new Set((data ?? []).map((l) => `${l.tipo_referencia}:${l.referencia_id}:${l.marco}`));

  const pendentes = candidatos.filter(
    (c) => !jaEnviadosSet.has(`${c.tipoReferencia}:${c.referenciaId}:${c.marco}`),
  );

  return { pendentes, jaEnviados: candidatos.length - pendentes.length };
}

/**
 * Ponto de entrada chamado pela route handler do cron. Coleta candidatos de
 * prazos + parcelas de honorário vencendo/vencidos para todos os
 * escritórios com canal WhatsApp ativo, filtra os já enviados, dispara os
 * pendentes e registra cada tentativa (sucesso ou falha) no log.
 */
export async function processarLembretesWhatsapp(
  supabase: SupabaseClient,
): Promise<ResumoProcessamentoLembretes> {
  const hoje = hojeISO();
  const escritorioIds = await buscarEscritoriosComCanalAtivo(supabase);

  const [candidatosPrazos, candidatosParcelas] = await Promise.all([
    coletarCandidatosPrazos(supabase, escritorioIds, hoje),
    coletarCandidatosParcelas(supabase, escritorioIds, hoje),
  ]);

  const todosCandidatos = [...candidatosPrazos, ...candidatosParcelas];
  const { pendentes, jaEnviados } = await filtrarJaEnviados(supabase, todosCandidatos);

  const resultados: ResultadoLembrete[] = [];
  let enviadosAgora = 0;
  let falharam = 0;

  for (const candidato of pendentes) {
    const nomeTemplate = candidato.tipoReferencia === "prazo" ? NOME_TEMPLATE_PRAZO : NOME_TEMPLATE_PARCELA;

    const resultadoEnvio = await enviarWhatsapp({
      supabase,
      escritorioId: candidato.escritorioId,
      telefoneDestino: candidato.telefoneDestino,
      nomeTemplate,
      parametros: [{ tipo: "text", texto: candidato.textoMensagem }],
    });

    // Registra a tentativa sempre, sucesso ou falha — `falhou` fica no
    // histórico para o escritório entender por que não recebeu (ex: canal
    // desconfigurado depois que o candidato já tinha sido coletado nesta
    // mesma execução). A unique constraint garante que uma segunda
    // execução concorrente não duplique este insert.
    const { error: erroInsert } = await supabase.from("lembretes_whatsapp_enviados").insert({
      escritorio_id: candidato.escritorioId,
      tipo_referencia: candidato.tipoReferencia,
      referencia_id: candidato.referenciaId,
      marco: candidato.marco,
      telefone_destino: candidato.telefoneDestino,
      status: resultadoEnvio.enviado ? "enviado" : "falhou",
      mensagem_id_externo: resultadoEnvio.enviado ? resultadoEnvio.mensagemIdExterno : null,
      erro: resultadoEnvio.enviado ? null : (resultadoEnvio.detalhe ?? resultadoEnvio.motivo),
    });

    // Conflito de unique constraint (23505) = outra execução já registrou
    // este marco entre o filtro e este insert; não é uma falha real deste
    // envio, só idempotência fazendo o trabalho dela.
    if (erroInsert && erroInsert.code !== "23505") throw erroInsert;

    if (resultadoEnvio.enviado) enviadosAgora += 1;
    else falharam += 1;

    resultados.push({
      tipoReferencia: candidato.tipoReferencia,
      referenciaId: candidato.referenciaId,
      escritorioId: candidato.escritorioId,
      marco: candidato.marco,
      enviado: resultadoEnvio.enviado,
      motivo: resultadoEnvio.enviado ? undefined : (resultadoEnvio.detalhe ?? resultadoEnvio.motivo),
    });
  }

  return {
    candidatos: todosCandidatos.length,
    jaEnviadosAntes: jaEnviados,
    enviadosAgora,
    falharam,
    resultados,
  };
}
