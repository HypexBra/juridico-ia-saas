"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { planoTemAcesso } from "@/lib/planos/gating";
import {
  existeProcessamentoIaEmAndamento,
  MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO,
} from "@/lib/ia/limite-concorrencia";
import { MAXIMO_EVENTOS_CONTEXTO_ESTRATEGIA, type DadosContextoEstrategiaCaso } from "@/lib/estrategia-caso/contexto";
import { gerarEstrategiaCaso } from "@/lib/estrategia-caso/gerar";
import type { EstrategiaCaso, FichaCaso } from "@/lib/types";

/**
 * Quantas análises de `analises_processo`/`analises_documento` (cada uma, não
 * a soma das duas) entram como candidatas ao contexto — teto de leitura no
 * banco antes mesmo de `montarContextoEstrategiaCaso` aplicar seu próprio
 * corte por tamanho agregado (ADR 0014, seção 4, item 6: "se houver muitas
 * análises, prioriza as mais recentes até o teto"). Evita um SELECT sem limite
 * num caso com dezenas de documentos já analisados.
 */
const MAXIMO_ANALISES_POR_TIPO_CONTEXTO_ESTRATEGIA = 20;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type LinhaJurisprudenciaCitada = {
  id: string;
  nota_advogado: string | null;
  jurisprudencias: { tribunal: string; numero_processo: string; ementa: string } | null;
};

type LinhaAnaliseComResumo = {
  id: string;
  criado_em: string;
  resultado_analise: { resumoExecutivo?: unknown } | null;
};

/**
 * Busca as 6 fontes de contexto do caso (ADR 0014, seção 4) e monta o shape
 * `DadosContextoEstrategiaCaso` esperado por `gerarEstrategiaCaso` (Onda 1).
 * Todas as queries usam o client normal (RLS ativo) — nenhum dado de outro
 * escritório pode vazar mesmo que `fichaCasoId` seja adulterado, porque cada
 * tabela já filtra por `escritorio_atual()` nas suas policies.
 */
async function buscarDadosContextoEstrategiaCaso(
  supabase: SupabaseServerClient,
  ficha: Pick<FichaCaso, "resumo_fatos" | "area_direito" | "urgencia" | "status_processual" | "resumo_ia" | "questoes_ia" | "estrategia_ia">,
  fichaCasoId: string,
): Promise<DadosContextoEstrategiaCaso> {
  const [tesesResultado, eventosResultado, pessoasResultado, jurisprudenciasResultado, analisesProcessoResultado, analisesDocumentoResultado] =
    await Promise.all([
      supabase
        .from("teses_caso")
        .select("id, tese, fundamentacao, status, atualizado_em")
        .eq("ficha_caso_id", fichaCasoId),
      supabase
        .from("eventos_caso")
        .select("id, tipo_evento, descricao, data_evento")
        .eq("ficha_caso_id", fichaCasoId)
        .order("data_evento", { ascending: false })
        .limit(MAXIMO_EVENTOS_CONTEXTO_ESTRATEGIA),
      supabase.from("pessoas_caso").select("id, tipo, nome, papel_processual").eq("ficha_caso_id", fichaCasoId),
      supabase
        .from("caso_jurisprudencia_citada")
        .select("id, nota_advogado, jurisprudencias(tribunal, numero_processo, ementa)")
        .eq("ficha_caso_id", fichaCasoId)
        .returns<LinhaJurisprudenciaCitada[]>(),
      supabase
        .from("analises_processo")
        .select("id, criado_em, resultado_analise")
        .eq("ficha_caso_id", fichaCasoId)
        .eq("status", "pronto")
        .order("criado_em", { ascending: false })
        .limit(MAXIMO_ANALISES_POR_TIPO_CONTEXTO_ESTRATEGIA)
        .returns<LinhaAnaliseComResumo[]>(),
      supabase
        .from("analises_documento")
        .select("id, criado_em, resultado_analise")
        .eq("ficha_caso_id", fichaCasoId)
        .eq("status", "pronto")
        .order("criado_em", { ascending: false })
        .limit(MAXIMO_ANALISES_POR_TIPO_CONTEXTO_ESTRATEGIA)
        .returns<LinhaAnaliseComResumo[]>(),
    ]);

  if (tesesResultado.error) {
    console.error("[fichas/estrategia-actions] Falha ao buscar teses do caso:", tesesResultado.error, { fichaCasoId });
  }
  if (eventosResultado.error) {
    console.error("[fichas/estrategia-actions] Falha ao buscar eventos do caso:", eventosResultado.error, { fichaCasoId });
  }
  if (pessoasResultado.error) {
    console.error("[fichas/estrategia-actions] Falha ao buscar pessoas do caso:", pessoasResultado.error, { fichaCasoId });
  }
  if (jurisprudenciasResultado.error) {
    console.error(
      "[fichas/estrategia-actions] Falha ao buscar jurisprudência citada do caso:",
      jurisprudenciasResultado.error,
      { fichaCasoId },
    );
  }
  if (analisesProcessoResultado.error) {
    console.error(
      "[fichas/estrategia-actions] Falha ao buscar análises de processo do caso:",
      analisesProcessoResultado.error,
      { fichaCasoId },
    );
  }
  if (analisesDocumentoResultado.error) {
    console.error(
      "[fichas/estrategia-actions] Falha ao buscar análises de documento do caso:",
      analisesDocumentoResultado.error,
      { fichaCasoId },
    );
  }

  const resumosAnalisesProcesso = (analisesProcessoResultado.data ?? [])
    .filter((item) => typeof item.resultado_analise?.resumoExecutivo === "string")
    .map((item) => ({
      id: item.id,
      tipo: "analise_processo" as const,
      resumoExecutivo: item.resultado_analise!.resumoExecutivo as string,
      criadoEm: item.criado_em,
    }));

  const resumosAnalisesDocumento = (analisesDocumentoResultado.data ?? [])
    .filter((item) => typeof item.resultado_analise?.resumoExecutivo === "string")
    .map((item) => ({
      id: item.id,
      tipo: "analise_documento" as const,
      resumoExecutivo: item.resultado_analise!.resumoExecutivo as string,
      criadoEm: item.criado_em,
    }));

  return {
    ficha: {
      resumoFatos: ficha.resumo_fatos,
      areaDireito: ficha.area_direito,
      urgencia: ficha.urgencia,
      statusProcessual: ficha.status_processual,
      resumoIa: ficha.resumo_ia,
      questoesIa: ficha.questoes_ia,
      estrategiaIa: ficha.estrategia_ia,
    },
    teses: (tesesResultado.data ?? []).map((tese) => ({
      id: tese.id,
      tese: tese.tese,
      fundamentacao: tese.fundamentacao,
      status: tese.status,
      atualizadoEm: tese.atualizado_em,
    })),
    eventos: (eventosResultado.data ?? []).map((evento) => ({
      id: evento.id,
      tipoEvento: evento.tipo_evento,
      descricao: evento.descricao,
      dataEvento: evento.data_evento,
    })),
    pessoas: (pessoasResultado.data ?? []).map((pessoa) => ({
      id: pessoa.id,
      tipo: pessoa.tipo,
      nome: pessoa.nome,
      papelProcessual: pessoa.papel_processual,
    })),
    jurisprudenciasCitadas: (jurisprudenciasResultado.data ?? [])
      .filter((item): item is LinhaJurisprudenciaCitada & { jurisprudencias: NonNullable<LinhaJurisprudenciaCitada["jurisprudencias"]> } =>
        item.jurisprudencias !== null,
      )
      .map((item) => ({
        id: item.id,
        tribunal: item.jurisprudencias.tribunal,
        numeroProcesso: item.jurisprudencias.numero_processo,
        ementa: item.jurisprudencias.ementa,
        notaAdvogado: item.nota_advogado,
      })),
    resumosAnalises: [...resumosAnalisesProcesso, ...resumosAnalisesDocumento],
  };
}

export type GerarEstrategiaCasoResultado =
  | { ok: true; estrategiaId: string }
  | { ok: false; error: string };

/**
 * Gera uma nova versão da estratégia do caso (ADR 0014). Sem redirect — a
 * própria página da ficha (`/app/fichas/[id]`) permanece na tela e a UI
 * (`estrategia-caso-secao.tsx`) re-renderiza inline a partir do retorno desta
 * action + `router.refresh()`, mesmo padrão de `atualizarStatusTeseAction`/
 * `criarTarefaCasoAction`, que também nunca navegam para fora da ficha.
 *
 * `maxDuration`: esta action roda dentro do mesmo segmento de rota de
 * `/app/fichas/[id]/page.tsx`, que já exporta `maxDuration = 120` (mesmo teto
 * usado por TODAS as features de IA pesada one-shot do projeto — auditor,
 * advogado do contra, document intelligence, análise de processo). A chamada
 * do Estrategista é text-only (sem multimodal/extração de PDF, ao contrário
 * da análise de processo já inline nesta mesma página) e usa o mesmo
 * `gerarRespostaEstruturada` com a mesma cadeia de fallback de modelo — não
 * há motivo para um teto maior nem para extrair isso para uma rota de API
 * própria: 120s já é folgado para uma única chamada de texto estruturado,
 * mesmo com o teto de saída mais alto (12288 tokens) desta feature.
 */
export async function gerarEstrategiaCasoAction(fichaCasoId: string): Promise<GerarEstrategiaCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  if (!planoTemAcesso(usuario.perfil.escritorio, "estrategista_caso")) {
    return { ok: false, error: "O Estrategista Jurídico é um recurso do plano Pro." };
  }

  const parsedFichaId = z.string().uuid().safeParse(fichaCasoId);
  if (!parsedFichaId.success) return { ok: false, error: "Ficha inválida." };

  const supabase = await createClient();
  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;

  const { data: ficha, error: erroFicha } = await supabase
    .from("fichas_caso")
    .select("resumo_fatos, area_direito, urgencia, status_processual, resumo_ia, questoes_ia, estrategia_ia")
    .eq("id", parsedFichaId.data)
    .eq("escritorio_id", escritorioId)
    .maybeSingle<
      Pick<FichaCaso, "resumo_fatos" | "area_direito" | "urgencia" | "status_processual" | "resumo_ia" | "questoes_ia" | "estrategia_ia">
    >();

  if (erroFicha) {
    console.error("[fichas/estrategia-actions] Falha ao buscar ficha do caso:", erroFicha, { fichaCasoId: parsedFichaId.data });
  }
  if (!ficha) return { ok: false, error: "Ficha de caso não encontrada." };

  if (await existeProcessamentoIaEmAndamento(escritorioId)) {
    return { ok: false, error: MENSAGEM_PROCESSAMENTO_IA_EM_ANDAMENTO };
  }

  const { data: registro, error: erroInsert } = await supabase
    .from("estrategias_caso")
    .insert({
      escritorio_id: escritorioId,
      ficha_caso_id: parsedFichaId.data,
      status: "processando",
      criado_por: perfilId,
    })
    .select("id")
    .single<{ id: string }>();

  if (erroInsert || !registro) {
    console.error("[fichas/estrategia-actions] Falha ao registrar estratégia do caso:", erroInsert, {
      fichaCasoId: parsedFichaId.data,
    });
    return { ok: false, error: "Não foi possível iniciar a geração da estratégia. Tente novamente." };
  }

  const dados = await buscarDadosContextoEstrategiaCaso(supabase, ficha, parsedFichaId.data);
  // Observabilidade (Fase 27): duração real da chamada de IA medida aqui e
  // gravada no insert de `uso_ia` mais adiante.
  const inicioChamadaIaMs = Date.now();
  const resultado = await gerarEstrategiaCaso({ dados });
  const duracaoChamadaIaMs = Date.now() - inicioChamadaIaMs;
  const agora = new Date().toISOString();

  if (!resultado.ok) {
    await supabase
      .from("estrategias_caso")
      .update({ status: "erro", erro: resultado.erro, processado_em: agora })
      .eq("id", registro.id);

    revalidatePath(`/app/fichas/${parsedFichaId.data}`);
    return { ok: false, error: resultado.erro };
  }

  const { error: erroUpdate } = await supabase
    .from("estrategias_caso")
    .update({
      status: "pronto",
      resultado_estrategia: resultado.resultado,
      contexto_resumo: resultado.contextoResumo,
      modelo_ia_usado: resultado.modeloIaUsado,
      processado_em: agora,
    })
    .eq("id", registro.id);

  if (erroUpdate) {
    console.error("[fichas/estrategia-actions] IA respondeu, mas falhou ao salvar o resultado:", erroUpdate, {
      estrategiaId: registro.id,
    });
    return { ok: false, error: "A IA gerou a estratégia, mas houve um erro ao salvar o resultado. Tente novamente." };
  }

  // Observabilidade (Fase 27): duração real + origem para a página /app/uso.
  await supabase.from("uso_ia").insert({
    escritorio_id: escritorioId,
    duracao_ms: duracaoChamadaIaMs,
    origem: "estrategia_caso",
    mes_ref: agora.slice(0, 7),
  });

  revalidatePath(`/app/fichas/${parsedFichaId.data}`);
  return { ok: true, estrategiaId: registro.id };
}

export type ListarEstrategiasCasoResultado = { ok: true; estrategias: EstrategiaCaso[] } | { ok: false; error: string };

/**
 * Lista o histórico de gerações de estratégia da ficha, mais recente
 * primeiro (ADR 0014, seção 6: "mais recente expandida, anteriores
 * colapsadas com timestamp"). RLS de `estrategias_caso` já restringe ao
 * escritório do usuário autenticado.
 */
export async function listarEstrategiasCasoAction(fichaCasoId: string): Promise<ListarEstrategiasCasoResultado> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsedFichaId = z.string().uuid().safeParse(fichaCasoId);
  if (!parsedFichaId.success) return { ok: false, error: "Ficha inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estrategias_caso")
    .select("*")
    .eq("ficha_caso_id", parsedFichaId.data)
    .order("criado_em", { ascending: false })
    .returns<EstrategiaCaso[]>();

  if (error) {
    console.error("[fichas/estrategia-actions] Falha ao listar estratégias do caso:", error, {
      fichaCasoId: parsedFichaId.data,
    });
    return { ok: false, error: "Não foi possível carregar o histórico de estratégias. Tente novamente." };
  }

  return { ok: true, estrategias: data ?? [] };
}
