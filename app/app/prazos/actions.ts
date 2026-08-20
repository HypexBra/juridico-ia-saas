"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { calcularPrazoComFeriados } from "@/lib/prazos/calculadora";
import { buscarFeriadosRelevantes } from "@/lib/prazos/feriados";
import { registrarEventoCaso } from "@/lib/casos/timeline";
import type { ParteContrariaTipo } from "@/lib/types";

const PARTE_CONTRARIA_TIPOS = [
  "particular",
  "fazenda_publica",
  "ministerio_publico",
  "defensoria_publica",
] as const;

const criarPrazoSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título do prazo."),
  descricao: z.string().trim().optional(),
  dataPrazo: z.string().trim().min(1, "Informe a data."),
  processo: z.string().trim().optional(),
  clienteNome: z.string().trim().optional(),
  dataIntimacao: z.string().trim().optional(),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "UF deve ter 2 letras (ex: SP).")
    .optional(),
  parteContrariaTipo: z.enum(PARTE_CONTRARIA_TIPOS).optional().default("particular"),
});

export type CriarPrazoState = { error: string | null };

export async function criarPrazoAction(
  _prev: CriarPrazoState,
  formData: FormData,
): Promise<CriarPrazoState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };

  const parsed = criarPrazoSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao") || undefined,
    dataPrazo: formData.get("dataPrazo"),
    processo: formData.get("processo") || undefined,
    clienteNome: formData.get("clienteNome") || undefined,
    dataIntimacao: formData.get("dataIntimacao") || undefined,
    uf: formData.get("uf") || undefined,
    parteContrariaTipo: formData.get("parteContrariaTipo") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("prazos").insert({
    escritorio_id: usuario.perfil.escritorio_id,
    criado_por: usuario.perfil.id,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao ?? null,
    data_prazo: parsed.data.dataPrazo,
    processo: parsed.data.processo ?? null,
    cliente_nome: parsed.data.clienteNome ?? null,
    data_intimacao: parsed.data.dataIntimacao ?? null,
    uf: parsed.data.uf ?? null,
    parte_contraria_tipo: parsed.data.parteContrariaTipo,
    // Resultado derivado da causa acima (art. 180/183/186, CPC) — mantém
    // `prazo_em_dobro` (0003, já consumido pelo DJEN/import) coerente também
    // para prazos criados manualmente.
    // Este formulário cria um prazo avulso (sem seletor de ficha na tela) —
    // não há `ficha_caso_id` nesta operação, então nenhum evento é
    // registrado na linha do tempo do caso aqui (contrato de
    // `registrarEventoCaso`: só chamar quando a ficha estiver disponível).
    prazo_em_dobro: parsed.data.parteContrariaTipo !== "particular",
  });

  if (error) return { error: "Não foi possível salvar o prazo. Tente novamente." };

  revalidatePath("/app/prazos");
  revalidatePath("/app/dashboard");
  return { error: null };
}

export type AcaoPrazoResultado = { ok: true } | { ok: false; error: string };

export async function concluirPrazoAction(
  prazoId: string,
  concluido: boolean,
): Promise<AcaoPrazoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prazos")
    .update({ concluido })
    .eq("id", prazoId)
    .select("id, titulo, ficha_caso_id")
    .maybeSingle<{ id: string; titulo: string; ficha_caso_id: string | null }>();

  if (error) {
    return { ok: false, error: "Não foi possível atualizar o prazo. Tente novamente." };
  }

  // Hook de auditoria da linha do tempo do caso (Fase 1 "Caso Inteligente") —
  // só registra quando o prazo está vinculado a uma ficha; uma falha aqui
  // nunca derruba a atualização do prazo, que já teve sucesso acima.
  if (data?.ficha_caso_id) {
    try {
      await registrarEventoCaso(supabase, {
        escritorioId: usuario.perfil.escritorio_id,
        fichaCasoId: data.ficha_caso_id,
        tipoEvento: concluido ? "prazo_concluido" : "prazo_reaberto",
        descricao: concluido
          ? `Prazo "${data.titulo}" marcado como concluído.`
          : `Prazo "${data.titulo}" reaberto (marcado como não concluído).`,
        origem: "manual",
        referenciaId: data.id,
        criadoPor: usuario.perfil.id,
      });
    } catch (erroTimeline) {
      console.error("[prazos/actions/concluirPrazoAction] Falha ao registrar evento na linha do tempo do caso:", erroTimeline, {
        prazoId,
        fichaCasoId: data.ficha_caso_id,
      });
    }
  }

  revalidatePath("/app/prazos");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

export async function excluirPrazoAction(prazoId: string): Promise<AcaoPrazoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase.from("prazos").delete().eq("id", prazoId);

  if (error) {
    return { ok: false, error: "Não foi possível excluir o prazo. Tente novamente." };
  }

  revalidatePath("/app/prazos");
  revalidatePath("/app/dashboard");
  return { ok: true };
}

const sugerirDataFinalSchema = z.object({
  dataIntimacao: z.string().trim().min(1, "Informe a data de intimação."),
  diasUteis: z.coerce.number().int().positive("Informe a quantidade de dias úteis do prazo."),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "UF deve ter 2 letras (ex: SP).")
    .optional(),
  parteContrariaTipo: z.enum(PARTE_CONTRARIA_TIPOS),
});

export type SugestaoPrazoResultado =
  | {
      ok: true;
      dataFinalISO: string;
      dobrou: boolean;
      diasUteisAplicados: number;
      explicacao: string;
    }
  | { ok: false; error: string };

/**
 * Sugere a data final de um prazo (dias úteis + dobra do CPC + feriados
 * forenses relevantes para a UF informada). Chamada pela UI ao preencher
 * data de intimação/dias úteis/UF/parte contrária — NUNCA trava o campo
 * `dataPrazo`, só preenche um valor inicial que o usuário pode ajustar.
 */
export async function sugerirDataFinalPrazoAction(input: {
  dataIntimacao: string;
  diasUteis: number;
  uf: string | null;
  parteContrariaTipo: ParteContrariaTipo;
}): Promise<SugestaoPrazoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = sugerirDataFinalSchema.safeParse({
    dataIntimacao: input.dataIntimacao,
    diasUteis: input.diasUteis,
    uf: input.uf ?? undefined,
    parteContrariaTipo: input.parteContrariaTipo,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const uf = parsed.data.uf ?? null;

  try {
    const feriados = await buscarFeriadosRelevantes(supabase, parsed.data.dataIntimacao, uf);
    const resultado = calcularPrazoComFeriados({
      dataIntimacao: parsed.data.dataIntimacao,
      diasUteis: parsed.data.diasUteis,
      uf,
      parteContrariaTipo: parsed.data.parteContrariaTipo,
      feriados,
    });

    return {
      ok: true,
      dataFinalISO: resultado.dataFinalISO,
      dobrou: resultado.dobrou,
      diasUteisAplicados: resultado.diasUteisAplicados,
      explicacao: resultado.explicacao,
    };
  } catch (err) {
    console.error("[sugerirDataFinalPrazoAction] falha ao calcular prazo:", err, {
      dataIntimacao: parsed.data.dataIntimacao,
      diasUteis: parsed.data.diasUteis,
      uf,
    });
    return { ok: false, error: "Não foi possível calcular a data sugerida. Preencha manualmente." };
  }
}
