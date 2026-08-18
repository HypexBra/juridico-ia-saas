"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { classificarLeadTriagem } from "@/lib/ia/triagem";

const RATE_LIMIT_MAX_SUBMISSOES = 3;
const RATE_LIMIT_JANELA_MINUTOS = 30;

const triagemSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome.").max(255),
  telefone: z.string().trim().max(20).optional(),
  email: z.string().trim().email("E-mail inválido.").max(255).optional().or(z.literal("")),
  relato: z
    .string()
    .trim()
    .min(20, "Conte com um pouco mais de detalhe o que aconteceu (mínimo 20 caracteres).")
    .max(4000, "Relato muito longo — resuma para até 4000 caracteres."),
});

export type EnviarTriagemState = { ok: false; error: string } | { ok: true };

/** Único identificador seguro de origem que o formulário público expõe —
 * IPv4/IPv6 do submitter via cabeçalho de proxy, com fallback para não
 * quebrar a submissão caso o header não venha preenchido (ex: dev local). */
async function resolverIpOrigem(): Promise<string | null> {
  const listaHeaders = await headers();
  const encaminhadoPor = listaHeaders.get("x-forwarded-for");
  if (encaminhadoPor) return encaminhadoPor.split(",")[0]?.trim() ?? null;
  return listaHeaders.get("x-real-ip");
}

export async function enviarTriagemAction(
  slug: string,
  _prev: EnviarTriagemState,
  formData: FormData,
): Promise<EnviarTriagemState> {
  const parsed = triagemSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    relato: formData.get("relato"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  // Resolve o escritório a partir do slug via RPC pública — nunca confia em
  // um `escritorio_id` vindo do client (o form só conhece o slug da URL).
  const { data: escritorio, error: erroEscritorio } = await supabase
    .rpc("escritorio_publico_por_slug", { p_slug: slug })
    .maybeSingle<{ id: string; nome: string }>();

  if (erroEscritorio || !escritorio) {
    return { ok: false, error: "Não foi possível identificar o escritório. Verifique o link e tente novamente." };
  }

  const ipOrigem = await resolverIpOrigem();

  if (ipOrigem) {
    const desdeQuando = new Date(Date.now() - RATE_LIMIT_JANELA_MINUTOS * 60_000).toISOString();
    const { count } = await supabase
      .from("leads_triagem_publica")
      .select("id", { count: "exact", head: true })
      .eq("ip_origem", ipOrigem)
      .gte("criado_em", desdeQuando);

    if ((count ?? 0) >= RATE_LIMIT_MAX_SUBMISSOES) {
      return {
        ok: false,
        error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de enviar novamente.",
      };
    }
  }

  // A classificação por IA roda ANTES do insert (mais simples que um update
  // assíncrono depois) mas nunca bloqueia o envio: falha aqui vira campos
  // `*_ia` nulos, e o lead é salvo do mesmo jeito para revisão manual da
  // equipe do escritório.
  const classificacao = await classificarLeadTriagem(parsed.data.relato);

  const { error: erroInsert } = await supabase.from("leads_triagem_publica").insert({
    escritorio_id: escritorio.id,
    nome: parsed.data.nome,
    telefone: parsed.data.telefone || null,
    email: parsed.data.email || null,
    relato: parsed.data.relato,
    tipo_caso_ia: classificacao?.tipoCaso ?? null,
    urgencia_ia: classificacao?.urgencia ?? null,
    viabilidade_ia: classificacao?.viabilidade ?? null,
    resumo_ia: classificacao?.resumo ?? null,
    ip_origem: ipOrigem,
  });

  if (erroInsert) {
    return { ok: false, error: "Não foi possível enviar sua mensagem. Tente novamente em instantes." };
  }

  return { ok: true };
}
