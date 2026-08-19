import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ConfiguracoesPlataforma = {
  modoManutencao: boolean;
  novosCadastrosHabilitados: boolean;
  atualizadoEm: string;
};

const PADRAO: ConfiguracoesPlataforma = {
  modoManutencao: false,
  novosCadastrosHabilitados: true,
  atualizadoEm: new Date(0).toISOString(),
};

/** Lê a linha singleton de `configuracoes_plataforma`. Nunca lança — degrada para o padrão (produto operando normalmente) se a leitura falhar. */
export async function buscarConfiguracoesPlataforma(): Promise<ConfiguracoesPlataforma> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes_plataforma")
    .select("modo_manutencao, novos_cadastros_habilitados, atualizado_em")
    .eq("id", true)
    .maybeSingle<{ modo_manutencao: boolean; novos_cadastros_habilitados: boolean; atualizado_em: string }>();

  if (error || !data) {
    if (error) console.error("[admin/configuracoes] Falha ao ler configuracoes_plataforma:", error);
    return PADRAO;
  }

  return {
    modoManutencao: data.modo_manutencao,
    novosCadastrosHabilitados: data.novos_cadastros_habilitados,
    atualizadoEm: data.atualizado_em,
  };
}
