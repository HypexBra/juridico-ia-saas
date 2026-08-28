"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cpfValido, formatarCpf } from "@/lib/cpf";
import { verificarRateLimit } from "@/lib/rate-limit";

const MAX_TENTATIVAS = 8;
const JANELA_MS = 10 * 60 * 1000; // 10 minutos

const consultaSchema = z.object({
  slug: z.string().trim().min(1, "Informe o identificador do escritório."),
  cpf: z.string().trim().min(1, "Informe o CPF."),
});

export type ResultadoConsultaPublica = {
  nomeCliente: string;
  areaDireito: string | null;
  statusResumido: string;
  criadoEm: string;
};

export type ConsultaPublicaState = {
  error: string | null;
  resultados: ResultadoConsultaPublica[] | null;
};

const STATUS_LABEL: Record<string, string> = {
  portal_ativo: "Portal do cliente ativo",
  em_analise: "Em análise pelo escritório",
  recebido: "Recebido, aguardando análise",
};

/** Mensagem única para "CPF não encontrado" e "escritório/CPF inválido" —
 * nunca diferenciar por texto de erro, para não permitir enumeração de CPF
 * cadastrado (ver comentário da function `consultar_status_publico_por_cpf`
 * na migration 0008). */
const MENSAGEM_GENERICA =
  "Nenhum caso encontrado para os dados informados. Verifique o identificador do escritório e o CPF, ou entre em contato diretamente com o escritório.";

async function resolverIpOrigem(): Promise<string> {
  const listaHeaders = await headers();
  // `x-forwarded-for` pode conter uma lista "cliente, proxy1, proxy2" — o
  // primeiro IP é o do requisitante original.
  const encaminhadoPor = listaHeaders.get("x-forwarded-for");
  if (encaminhadoPor) return encaminhadoPor.split(",")[0]?.trim() ?? "desconhecido";
  return listaHeaders.get("x-real-ip") ?? "desconhecido";
}

export async function consultarStatusPublicoAction(
  _prev: ConsultaPublicaState,
  formData: FormData,
): Promise<ConsultaPublicaState> {
  const parsed = consultaSchema.safeParse({
    slug: formData.get("slug"),
    cpf: formData.get("cpf"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", resultados: null };
  }

  const ip = await resolverIpOrigem();
  const permitido = await verificarRateLimit(`consulta-status-publico:${ip}`, {
    maxTentativas: MAX_TENTATIVAS,
    janelaMs: JANELA_MS,
  });
  if (!permitido) {
    return {
      error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.",
      resultados: null,
    };
  }

  if (!cpfValido(parsed.data.cpf)) {
    // Mesma mensagem genérica de "não encontrado" — CPF malformado e CPF
    // válido-mas-inexistente devem ser indistinguíveis para quem consulta.
    return { error: MENSAGEM_GENERICA, resultados: null };
  }
  const cpfFormatado = formatarCpf(parsed.data.cpf);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultar_status_publico_por_cpf", {
    p_escritorio_slug: parsed.data.slug,
    p_cpf: cpfFormatado,
  });

  if (error) {
    return { error: MENSAGEM_GENERICA, resultados: null };
  }

  const linhas = data as
    | { nome_cliente: string; area_direito: string | null; status_resumido: string; criado_em: string }[]
    | null;

  if (!linhas || linhas.length === 0) {
    return { error: MENSAGEM_GENERICA, resultados: null };
  }

  return {
    error: null,
    resultados: linhas.map((linha) => ({
      nomeCliente: linha.nome_cliente,
      areaDireito: linha.area_direito,
      statusResumido: STATUS_LABEL[linha.status_resumido] ?? linha.status_resumido,
      criadoEm: linha.criado_em,
    })),
  };
}
