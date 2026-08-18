import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { descriptografarToken } from "./criptografia";

/**
 * Integração com a Meta Cloud API (WhatsApp Business) para envio de
 * mensagens de template. Uma credencial (`phone_number_id` + `token_acesso`)
 * por escritório, cadastrada em `canais_whatsapp_escritorio` (migration
 * 0008) via `app/app/perfil` — nunca lida de env var, porque cada tenant
 * tem seu próprio número/token.
 *
 * Contrato: esta função NUNCA lança exceção por falha de negócio esperada
 * (canal não configurado/desativado, erro de rede/API da Meta) — sempre
 * retorna um `ResultadoEnvioWhatsapp` descritivo, porque quem chama isso é
 * um cron (`app/api/cron/lembretes-whatsapp`) que processa dezenas de
 * lembretes numa mesma execução e não pode ser derrubado por UM envio ruim.
 * Só erros de programação (bug real) devem escapar como exceção.
 */

const META_GRAPH_API_VERSION = "v21.0";
const META_GRAPH_BASE_URL = "https://graph.facebook.com";

export type MotivoFalhaEnvioWhatsapp =
  | "canal_nao_configurado"
  | "canal_inativo"
  | "erro_api_meta"
  | "erro_rede";

export type ResultadoEnvioWhatsapp =
  | { enviado: true; mensagemIdExterno: string | null }
  | { enviado: false; motivo: MotivoFalhaEnvioWhatsapp; detalhe?: string };

export type ParametroTemplateWhatsapp = { tipo: "text"; texto: string };

/**
 * Busca a credencial ativa do escritório. Isolado numa função própria para
 * o cron poder checar "canal existe?" antes de montar a mensagem, e para
 * `enviarWhatsapp` poder reaproveitar em teste unitário com um client mock.
 */
async function buscarCanalAtivo(supabase: SupabaseClient, escritorioId: string) {
  const { data, error } = await supabase
    .from("canais_whatsapp_escritorio")
    .select("phone_number_id, token_acesso, ativo")
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (error) throw error; // erro de infra do próprio Supabase — isso sim deve derrubar/logar alto, não é "canal ausente"
  return data;
}

/**
 * Envia uma mensagem de template do WhatsApp Business (Meta Cloud API) para
 * um destinatário, usando a credencial do escritório informado.
 *
 * `nomeTemplate` precisa já existir aprovado no WhatsApp Manager da Meta
 * para o número em questão — a API rejeita templates não aprovados. Os
 * `parametros` preenchem as variáveis `{{1}}`, `{{2}}`... do template, na
 * ordem.
 */
export async function enviarWhatsapp(params: {
  supabase: SupabaseClient;
  escritorioId: string;
  telefoneDestino: string;
  nomeTemplate: string;
  idiomaTemplate?: string;
  parametros?: ParametroTemplateWhatsapp[];
}): Promise<ResultadoEnvioWhatsapp> {
  const { supabase, escritorioId, telefoneDestino, nomeTemplate, idiomaTemplate = "pt_BR", parametros = [] } = params;

  let canal: Awaited<ReturnType<typeof buscarCanalAtivo>>;
  try {
    canal = await buscarCanalAtivo(supabase, escritorioId);
  } catch (erro) {
    return {
      enviado: false,
      motivo: "erro_rede",
      detalhe: erro instanceof Error ? erro.message : "Falha ao consultar canal WhatsApp do escritório.",
    };
  }

  if (!canal) {
    return { enviado: false, motivo: "canal_nao_configurado" };
  }
  if (!canal.ativo) {
    return { enviado: false, motivo: "canal_inativo" };
  }

  const telefoneNormalizado = normalizarTelefoneE164(telefoneDestino);
  if (!telefoneNormalizado) {
    return { enviado: false, motivo: "erro_api_meta", detalhe: "Telefone de destino inválido." };
  }

  let tokenPlano: string;
  try {
    tokenPlano = descriptografarToken(canal.token_acesso);
  } catch (erro) {
    return {
      enviado: false,
      motivo: "erro_api_meta",
      detalhe: erro instanceof Error ? erro.message : "Não foi possível decriptografar o token do canal.",
    };
  }

  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_API_VERSION}/${canal.phone_number_id}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: telefoneNormalizado,
    type: "template",
    template: {
      name: nomeTemplate,
      language: { code: idiomaTemplate },
      ...(parametros.length > 0
        ? {
            components: [
              {
                type: "body",
                parameters: parametros.map((p) => ({ type: "text", text: p.texto })),
              },
            ],
          }
        : {}),
    },
  };

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenPlano}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = (await resposta.json().catch(() => null)) as
      | { messages?: { id: string }[]; error?: { message?: string } }
      | null;

    if (!resposta.ok) {
      return {
        enviado: false,
        motivo: "erro_api_meta",
        detalhe: payload?.error?.message ?? `Meta Cloud API retornou HTTP ${resposta.status}.`,
      };
    }

    return { enviado: true, mensagemIdExterno: payload?.messages?.[0]?.id ?? null };
  } catch (erro) {
    return {
      enviado: false,
      motivo: "erro_rede",
      detalhe: erro instanceof Error ? erro.message : "Falha de rede ao chamar a Meta Cloud API.",
    };
  }
}

/**
 * Normaliza para o formato E.164 sem símbolos que a Meta Cloud API exige
 * (ex: "5511999998888"). Aceita entradas com máscara comum brasileira
 * ("(11) 99999-8888", "+55 11 99999-8888") — se já não vier com DDI, assume
 * Brasil (55), já que hoje só atendemos escritórios brasileiros.
 */
export function normalizarTelefoneE164(telefone: string): string | null {
  const apenasDigitos = telefone.replace(/\D/g, "");
  if (apenasDigitos.length < 10) return null;
  if (apenasDigitos.startsWith("55") && apenasDigitos.length >= 12) return apenasDigitos;
  if (apenasDigitos.length <= 11) return `55${apenasDigitos}`;
  return apenasDigitos;
}
