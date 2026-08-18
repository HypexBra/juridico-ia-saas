import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { indexarTexto } from "./ingestao";

/**
 * Reindexação sob demanda dos dados internos do escritório (fichas de caso,
 * prazos, modelos de peça) como fonte de RAG. Não é acoplada a cada action
 * de CRUD existente (evitaria tocar vários arquivos já em produção e
 * acoplar toda escrita a uma chamada de embedding síncrona); em vez disso é
 * chamada:
 *   1. manualmente pelo botão "Reindexar dados internos" em
 *      app/app/base-conhecimento/actions.ts;
 *   2. automaticamente logo após uma proposta de create/update ser
 *      aprovada (o registro que acabou de mudar entra imediatamente na
 *      base de busca — ver app/app/chat/propostas-actions.ts).
 */
export async function reindexarFichaCaso(supabase: SupabaseClient, escritorioId: string, fichaId: string) {
  const { data: ficha } = await supabase
    .from("fichas_caso")
    .select("id, nome_cliente, area_direito, resumo_fatos, resumo_ia, questoes_ia, estrategia_ia, urgencia")
    .eq("id", fichaId)
    .maybeSingle();
  if (!ficha) return;

  const texto = [
    `Ficha de caso — cliente: ${ficha.nome_cliente ?? "não informado"}`,
    ficha.area_direito ? `Área: ${ficha.area_direito}` : null,
    `Urgência: ${ficha.urgencia}`,
    ficha.resumo_fatos ? `Fatos: ${ficha.resumo_fatos}` : null,
    ficha.resumo_ia ? `Resumo: ${ficha.resumo_ia}` : null,
    ficha.questoes_ia ? `Questões jurídicas: ${ficha.questoes_ia}` : null,
    ficha.estrategia_ia ? `Estratégia: ${ficha.estrategia_ia}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!texto.trim()) return;
  await indexarTexto(supabase, {
    escritorioId,
    fonteTipo: "ficha_caso",
    fonteId: fichaId,
    texto,
    metadata: { nome_cliente: ficha.nome_cliente, area_direito: ficha.area_direito },
  });
}

export async function reindexarPrazo(supabase: SupabaseClient, escritorioId: string, prazoId: string) {
  const { data: prazo } = await supabase
    .from("prazos")
    .select("id, titulo, descricao, data_prazo, processo, cliente_nome, concluido")
    .eq("id", prazoId)
    .maybeSingle();
  if (!prazo) return;

  const texto = [
    `Prazo: ${prazo.titulo}`,
    `Data: ${prazo.data_prazo}`,
    prazo.processo ? `Processo: ${prazo.processo}` : null,
    prazo.cliente_nome ? `Cliente: ${prazo.cliente_nome}` : null,
    `Status: ${prazo.concluido ? "concluído" : "pendente"}`,
    prazo.descricao ? `Descrição: ${prazo.descricao}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await indexarTexto(supabase, {
    escritorioId,
    fonteTipo: "prazo",
    fonteId: prazoId,
    texto,
    metadata: { titulo: prazo.titulo, data_prazo: prazo.data_prazo },
  });
}

export async function reindexarModelo(supabase: SupabaseClient, escritorioId: string, modeloId: string) {
  const { data: modelo } = await supabase
    .from("modelos")
    .select("id, nome, area, tipo, descricao, conteudo")
    .eq("id", modeloId)
    .maybeSingle();
  if (!modelo) return;

  const texto = [
    `Modelo de peça: ${modelo.nome}`,
    modelo.area ? `Área: ${modelo.area}` : null,
    modelo.tipo ? `Tipo: ${modelo.tipo}` : null,
    modelo.descricao ? `Descrição: ${modelo.descricao}` : null,
    "",
    modelo.conteudo,
  ]
    .filter((linha) => linha !== null)
    .join("\n");

  await indexarTexto(supabase, {
    escritorioId,
    fonteTipo: "modelo",
    fonteId: modeloId,
    texto,
    metadata: { nome: modelo.nome, area: modelo.area },
  });
}

/** Reindexa TODOS os registros internos do escritório (uso: botão manual na base de conhecimento). */
export async function reindexarTudoDoEscritorio(supabase: SupabaseClient, escritorioId: string) {
  const [{ data: fichas }, { data: prazos }, { data: modelos }] = await Promise.all([
    supabase.from("fichas_caso").select("id"),
    supabase.from("prazos").select("id"),
    supabase.from("modelos").select("id"),
  ]);

  let total = 0;
  for (const f of fichas ?? []) {
    await reindexarFichaCaso(supabase, escritorioId, f.id);
    total++;
  }
  for (const p of prazos ?? []) {
    await reindexarPrazo(supabase, escritorioId, p.id);
    total++;
  }
  for (const m of modelos ?? []) {
    await reindexarModelo(supabase, escritorioId, m.id);
    total++;
  }
  return { totalRegistros: total };
}
