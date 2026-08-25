"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/app/current-user";
import {
  classificarIntencao,
  rotaParaDestino,
  type RotaAgente,
} from "@/lib/ia/orquestrador";

/**
 * Command Center (CTRL+K) — Fase 26. Busca server-side de casos/clientes
 * para o palette. RLS garante o isolamento por escritório; limite baixo
 * porque é busca incremental enquanto o usuário digita.
 *
 * Fase 18 (orquestração leve): quando a busca NÃO encontra nada, o pedido é
 * reclassificado pela heurística de intenção (lib/ia/orquestrador — pura,
 * custo zero) e devolvido como SUGESTÃO de navegação — nunca como dado.
 */

const buscaSchema = z.object({
  termo: z.string().trim().min(2, "Digite ao menos 2 caracteres.").max(120),
});

export type ResultadoBuscaCommand = {
  fichas: { id: string; nomeCliente: string | null; areaDireito: string | null }[];
  prazos: { id: string; titulo: string; dataPrazo: string; clienteNome: string | null }[];
  sugestao: SugestaoComando | null;
};

/** Sugestão pronta para o palette (destino já resolvido). */
export type SugestaoComando = {
  rota: RotaAgente;
  href: string;
  label: string;
  motivoCurto: string;
};

export type ResultadoCommand =
  | { ok: true; resultados: ResultadoBuscaCommand }
  | { ok: false; error: string };

/**
 * Fallback heurístico: só aciona quando a busca estrutural veio vazia e a
 * confiança é alta/média ("baixa" poluiria o palette com chute fraco).
 */
function sugerirRotaFallback(termo: string): SugestaoComando | null {
  const sugestao = classificarIntencao(termo);
  if (!sugestao || sugestao.confianca === "baixa") return null;
  const destino = rotaParaDestino(sugestao.rota);
  if (!destino) return null;
  return {
    rota: sugestao.rota,
    href: destino.href,
    label: destino.label,
    motivoCurto: sugestao.motivoCurto,
  };
}

export async function buscarNoCommandCenterAction(input: z.infer<typeof buscaSchema>): Promise<ResultadoCommand> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = buscaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Termo inválido." };

  const padrao = `%${parsed.data.termo.replace(/[%_]/g, "")}%`;
  const supabase = await createClient();

  const [fichasRes, prazosRes] = await Promise.all([
    supabase
      .from("fichas_caso")
      .select("id, nome_cliente, area_direito")
      .or(`nome_cliente.ilike.${padrao},resumo_fatos.ilike.${padrao},area_direito.ilike.${padrao}`)
      .is("deletado_em", null)
      .order("criado_em", { ascending: false })
      .limit(6),
    supabase
      .from("prazos")
      .select("id, titulo, data_prazo, cliente_nome")
      .eq("concluido", false)
      .ilike("titulo", padrao)
      .order("data_prazo", { ascending: true })
      .limit(4),
  ]);

  const fichas = (fichasRes.data ?? []).map((f) => ({
    id: f.id,
    nomeCliente: f.nome_cliente,
    areaDireito: f.area_direito,
  }));
  const prazos = (prazosRes.data ?? []).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    dataPrazo: p.data_prazo,
    clienteNome: p.cliente_nome,
  }));

  // Nem comando nem resultado: sugere a ferramenta certa pela intenção.
  const sugestao =
    fichas.length === 0 && prazos.length === 0 ? sugerirRotaFallback(parsed.data.termo) : null;

  return {
    ok: true,
    resultados: { fichas, prazos, sugestao },
  };
}
