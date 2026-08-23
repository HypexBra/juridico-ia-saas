"use server";

import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  calcularAtualizacaoMonetaria,
  type ResultadoAtualizacao,
} from "@/lib/calculadoras/atualizacao-monetaria";
import { buscarSerieIndice, type IndiceDisponivel } from "@/lib/calculadoras/indices-bcb";
import { calcularSucumbenciaisArt85 } from "@/lib/calculadoras/honorarios-sucumbenciais";
import { calcularPrazoProcessual } from "@/lib/calculadoras/dias-uteis";
import { calcularPrescricao, type TipoPrescricao } from "@/lib/calculadoras/prescricao";
import { extrairDadosDeSentenca, type DadosExtraidosSentenca } from "@/lib/calculadoras/extrair-sentenca";
import { planoTemAcesso } from "@/lib/planos/gating";

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const atualizacaoSchema = z.object({
  valorOriginal: z.number().positive("Valor deve ser maior que zero."),
  dataInicial: dataSchema,
  dataFinal: dataSchema,
  indice: z.enum(["ipca", "selic"]),
  taxaJurosMensalPercentual: z.number().min(0).max(20),
  tipoJuros: z.enum(["simples", "compostos"]),
  multaPercentual: z.number().min(0).max(100),
  honorariosPercentual: z.number().min(0).max(100),
});

export type ResultadoCalculadora<T> = { ok: true; resultado: T } | { ok: false; error: string };

/**
 * Atualização monetária + juros — busca a SÉRIE OFICIAL no Banco Central
 * (SGS) e delega ao motor puro. A busca falha? Erro explícito — nunca
 * inventar índice.
 */
export async function calcularAtualizacaoAction(
  input: z.infer<typeof atualizacaoSchema>,
): Promise<ResultadoCalculadora<ResultadoAtualizacao>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = atualizacaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  try {
    const serieIndice =
      dados.indice === "ipca"
        ? await buscarSerieIndice("ipca" satisfies IndiceDisponivel, dados.dataInicial, dados.dataFinal)
        : await buscarSerieIndice("selic" satisfies IndiceDisponivel, dados.dataInicial, dados.dataFinal);

    if (serieIndice.length === 0 && dados.dataInicial < hojeIso()) {
      return {
        ok: false,
        error: `O Banco Central não devolveu variações de ${dados.indice.toUpperCase()} para este período. Confira as datas.`,
      };
    }

    const fonteIndice =
      dados.indice === "ipca"
        ? "IPCA/IBGE via API SGS do Banco Central (série 433)"
        : "SELIC acumulada mensal via API SGS do Banco Central (série 16122)";

    const resultado = await calcularAtualizacaoMonetaria({
      ...dados,
      serieIndice,
    });

    return {
      ok: true,
      resultado: { ...resultado, fontes: [fonteIndice, ...resultado.fontes] },
    };
  } catch (erro) {
    console.error("[calculadoras/atualizacao] Falha:", erro);
    return {
      ok: false,
      error:
        erro instanceof Error && erro.message.includes("Banco Central")
          ? erro.message
          : "Não foi possível obter os índices oficiais agora. Tente novamente em instantes.",
    };
  }
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const sucumbenciaisSchema = z.object({
  valorCondenacao: z.number().positive("Informe o valor da condenação/proveito."),
  salarioMinimo: z.number().positive("Informe o salário mínimo de referência."),
  aplicarRecursal: z.boolean(),
});

export async function calcularSucumbenciaisAction(
  input: z.infer<typeof sucumbenciaisSchema>,
): Promise<ResultadoCalculadora<ReturnType<typeof calcularSucumbenciaisArt85>>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = sucumbenciaisSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    return {
      ok: true,
      resultado: calcularSucumbenciaisArt85(parsed.data.valorCondenacao, parsed.data.salarioMinimo, parsed.data.aplicarRecursal),
    };
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Erro no cálculo." };
  }
}

const prazoSchema = z.object({
  dataPublicacao: dataSchema,
  dias: z.number().int().positive().nullable(),
  meses: z.number().int().positive().nullable(),
  anos: z.number().int().positive().nullable(),
  emDobro: z.boolean(),
  considerarRecesso: z.boolean(),
});

export async function calcularPrazoProcessualAction(
  input: z.infer<typeof prazoSchema>,
): Promise<ResultadoCalculadora<ReturnType<typeof calcularPrazoProcessual>>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = prazoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    return { ok: true, resultado: calcularPrazoProcessual(parsed.data) };
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Erro no cálculo." };
  }
}

const prescricaoSchema = z.object({
  tipo: z.string().min(1),
  termoInicial: dataSchema,
});

export async function calcularPrescricaoAction(
  input: z.infer<typeof prescricaoSchema>,
): Promise<ResultadoCalculadora<ReturnType<typeof calcularPrescricao>>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = prescricaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    return {
      ok: true,
      resultado: calcularPrescricao(
        parsed.data.tipo as TipoPrescricao,
        parsed.data.termoInicial,
        new Date().toISOString().slice(0, 10),
      ),
    };
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Erro no cálculo." };
  }
}

const extracaoSchema = z.object({
  texto: z.string().trim().min(50, "Cole o trecho da sentença/acordo (mín. 50 caracteres).").max(60_000),
});

/**
 * Fase 16 avançada — extração assistida por IA de sentença → parâmetros do
 * cálculo (feature Pro: `calculo_assistido_sentenca`). Cada campo extraído
 * vem com o TRECHO LITERAL que o sustenta; a revisão humana é obrigatória
 * por design (a UI preenche o formulário, nunca calcula sozinha).
 */
export async function extrairDadosSentencaAction(
  input: z.infer<typeof extracaoSchema>,
): Promise<ResultadoCalculadora<DadosExtraidosSentenca>> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };
  if (!planoTemAcesso(usuario.perfil.escritorio, "calculo_assistido_sentenca")) {
    return { ok: false, error: "A extração assistida por IA está disponível no plano Pro." };
  }

  const parsed = extracaoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Texto inválido." };

  try {
    // Observabilidade (Fase 27): duração real da chamada de IA medida aqui e
    // gravada no insert de `uso_ia` logo abaixo.
    const inicioChamadaIaMs = Date.now();
    const resultado = await extrairDadosDeSentenca(parsed.data.texto);
    const duracaoChamadaIaMs = Date.now() - inicioChamadaIaMs;
    // Contagem de uso mensal — mesma política das demais features de IA.
    await supabaseUsoInsert(usuario.perfil.escritorio.id, duracaoChamadaIaMs);
    return { ok: true, resultado };
  } catch (erro) {
    console.error("[calculadoras/extrair-sentenca] Falha:", erro);
    return { ok: false, error: "Não foi possível extrair os dados agora. Tente novamente em instantes." };
  }
}

async function supabaseUsoInsert(escritorioId: string, duracaoChamadaIaMs: number): Promise<void> {
  const supabase = await createClient();
  // Observabilidade (Fase 27): duração real da chamada de extração por IA +
  // origem para a página /app/uso.
  await supabase.from("uso_ia").insert({
    escritorio_id: escritorioId,
    duracao_ms: duracaoChamadaIaMs,
    origem: "calculadora",
    mes_ref: new Date().toISOString().slice(0, 7),
  });
}
