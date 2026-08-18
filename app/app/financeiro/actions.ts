"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";

const TOLERANCIA_RATEIO = 0.01;
const MAX_PARCELAS = 120;

/** Extrai um número finito de um campo de FormData, ou `null` se vazio/ inválido. */
function paraNumero(valor: FormDataEntryValue | null): number | null {
  if (valor === null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

/** Soma `meses` a uma data ISO (YYYY-MM-DD), preservando o dia quando possível. */
function adicionarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, (mes - 1) + meses, dia));
  return data.toISOString().slice(0, 10);
}

const camposBaseContratoSchema = z.object({
  fichaCasoId: z.string().trim().min(1, "Selecione a ficha do caso."),
  tipo: z.enum(["fixo", "exito", "aaj"], { message: "Selecione o tipo de contrato." }),
});

export type CriarContratoHonorarioState = { error: string | null };

/**
 * Cria um contrato de honorário vinculado a uma ficha de caso, gera as
 * parcelas automaticamente (quando há valor total + data do 1º vencimento) e
 * grava o rateio entre sócios do escritório.
 *
 * Como o Postgres não tem transação disponível aqui via supabase-js para
 * múltiplas tabelas, o rollback de parcelas/rateio em caso de falha parcial é
 * feito manualmente (delete em cascata do contrato apaga parcelas/rateio
 * já inseridos, via FK on delete cascade da migration 0003).
 */
export async function criarContratoHonorarioAction(
  _prev: CriarContratoHonorarioState,
  formData: FormData,
): Promise<CriarContratoHonorarioState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente." };

  const parsedBase = camposBaseContratoSchema.safeParse({
    fichaCasoId: formData.get("fichaCasoId"),
    tipo: formData.get("tipo"),
  });
  if (!parsedBase.success) {
    return { error: parsedBase.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { fichaCasoId, tipo } = parsedBase.data;

  const valorTotal = paraNumero(formData.get("valorTotal"));
  const percentualExito = paraNumero(formData.get("percentualExito"));
  const numeroParcelasBruto = paraNumero(formData.get("numeroParcelas"));
  const primeiraVencimentoBruto = formData.get("primeiraVencimento");
  const primeiraVencimento =
    typeof primeiraVencimentoBruto === "string" && primeiraVencimentoBruto.trim()
      ? primeiraVencimentoBruto.trim()
      : null;

  if (valorTotal !== null && valorTotal <= 0) {
    return { error: "O valor total deve ser maior que zero." };
  }
  if (percentualExito !== null && (percentualExito <= 0 || percentualExito > 100)) {
    return { error: "O percentual de êxito deve estar entre 0 e 100." };
  }

  if (tipo === "fixo" && (valorTotal === null || valorTotal <= 0)) {
    return { error: "Contratos fixos exigem um valor total maior que zero." };
  }
  if (tipo === "exito" && percentualExito === null) {
    return { error: "Contratos de êxito exigem o percentual acordado." };
  }
  if (tipo === "aaj" && valorTotal === null && percentualExito === null) {
    return { error: "Contratos AAJ exigem valor fixo e/ou percentual de êxito." };
  }

  let numeroParcelas = 1;
  if (valorTotal !== null) {
    if (!primeiraVencimento || Number.isNaN(Date.parse(primeiraVencimento))) {
      return { error: "Informe a data do 1º vencimento para gerar as parcelas." };
    }
    numeroParcelas = numeroParcelasBruto !== null ? Math.trunc(numeroParcelasBruto) : 1;
    if (!Number.isInteger(numeroParcelas) || numeroParcelas < 1 || numeroParcelas > MAX_PARCELAS) {
      return { error: `O número de parcelas deve ser um inteiro entre 1 e ${MAX_PARCELAS}.` };
    }
  }

  const supabase = await createClient();

  const { data: fichaExiste, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("id")
    .eq("id", fichaCasoId)
    .maybeSingle();
  if (erroFicha || !fichaExiste) {
    return { error: "Ficha de caso não encontrada." };
  }

  const { data: perfisAtivos, error: erroPerfis } = await supabase
    .from("perfis")
    .select("id")
    .eq("escritorio_id", usuario.perfil.escritorio_id)
    .eq("ativo", true)
    .returns<{ id: string }[]>();

  if (erroPerfis) return { error: "Não foi possível validar o rateio de sócios." };

  const rateio = (perfisAtivos ?? [])
    .map((perfil) => ({
      perfilId: perfil.id,
      percentual: paraNumero(formData.get(`percentual_${perfil.id}`)) ?? 0,
    }))
    .filter((item) => item.percentual > 0);

  if (rateio.length === 0) {
    return { error: "Defina o rateio entre os sócios (a soma dos percentuais deve fechar 100%)." };
  }

  const somaRateio = rateio.reduce((acumulado, item) => acumulado + item.percentual, 0);
  if (Math.abs(somaRateio - 100) > TOLERANCIA_RATEIO) {
    return {
      error: `A soma do rateio entre sócios deve ser exatamente 100% (soma atual: ${somaRateio.toFixed(2)}%).`,
    };
  }

  const { data: contrato, error: erroContrato } = await supabase
    .from("contratos_honorario")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      ficha_caso_id: fichaCasoId,
      tipo,
      valor_total: valorTotal,
      percentual_exito: percentualExito,
    })
    .select("id")
    .single();

  if (erroContrato || !contrato) {
    return { error: "Não foi possível criar o contrato. Tente novamente." };
  }

  if (valorTotal !== null && primeiraVencimento) {
    const totalCentavos = Math.round(valorTotal * 100);
    const baseCentavos = Math.floor(totalCentavos / numeroParcelas);
    const restoCentavos = totalCentavos - baseCentavos * numeroParcelas;

    const parcelas = Array.from({ length: numeroParcelas }, (_, indice) => ({
      escritorio_id: usuario.perfil.escritorio_id,
      contrato_id: contrato.id as string,
      numero_parcela: indice + 1,
      // O resto da divisão (centavos que não fecham igualmente entre as N
      // parcelas) é absorvido pela última parcela, para o somatório sempre
      // bater exatamente com o valor total do contrato.
      valor: (baseCentavos + (indice === numeroParcelas - 1 ? restoCentavos : 0)) / 100,
      vencimento: adicionarMeses(primeiraVencimento, indice),
      status: "pendente" as const,
    }));

    const { error: erroParcelas } = await supabase.from("parcelas_honorario").insert(parcelas);
    if (erroParcelas) {
      await supabase.from("contratos_honorario").delete().eq("id", contrato.id);
      return { error: "Não foi possível gerar as parcelas. Nenhum dado foi salvo." };
    }
  }

  const { error: erroRateio } = await supabase.from("rateio_socios").insert(
    rateio.map((item) => ({
      escritorio_id: usuario.perfil.escritorio_id,
      contrato_id: contrato.id as string,
      perfil_id: item.perfilId,
      percentual: item.percentual,
    })),
  );

  if (erroRateio) {
    await supabase.from("contratos_honorario").delete().eq("id", contrato.id);
    return { error: "Não foi possível salvar o rateio entre sócios. Nenhum dado foi salvo." };
  }

  revalidatePath("/app/financeiro");
  return { error: null };
}

export type AcaoFinanceiroResultado = { ok: true } | { ok: false; error: string };

/** Marca uma parcela como paga hoje (idempotente: reafirmar não gera erro). */
export async function marcarParcelaPagaAction(parcelaId: string): Promise<AcaoFinanceiroResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("parcelas_honorario")
    .update({ status: "pago", pago_em: hoje })
    .eq("id", parcelaId)
    .eq("escritorio_id", usuario.perfil.escritorio_id);

  if (error) return { ok: false, error: "Não foi possível marcar a parcela como paga." };

  revalidatePath("/app/financeiro");
  return { ok: true };
}

/** Desfaz o pagamento de uma parcela (volta para pendente/atrasado por reavaliação na próxima listagem). */
export async function reverterPagamentoParcelaAction(parcelaId: string): Promise<AcaoFinanceiroResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("parcelas_honorario")
    .update({ status: "pendente", pago_em: null })
    .eq("id", parcelaId)
    .eq("escritorio_id", usuario.perfil.escritorio_id);

  if (error) return { ok: false, error: "Não foi possível reverter o pagamento." };

  revalidatePath("/app/financeiro");
  return { ok: true };
}

/**
 * Recalcula o status de inadimplência antes de qualquer listagem: toda
 * parcela `pendente` cujo vencimento já passou vira `atrasado`. Rodar isso a
 * cada carregamento da página (em vez de um cron dedicado) evita reprocessar
 * um job em background e evita race condition entre o cron e um pagamento
 * feito no mesmo instante — o UPDATE é uma operação atômica de linha por
 * linha no Postgres, idempotente e barata para o volume esperado.
 */
export async function sincronizarParcelasAtrasadas(escritorioId: string): Promise<void> {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  await supabase
    .from("parcelas_honorario")
    .update({ status: "atrasado" })
    .eq("escritorio_id", escritorioId)
    .eq("status", "pendente")
    .lt("vencimento", hoje);
}
