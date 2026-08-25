import type { SupabaseClient } from "@supabase/supabase-js";

export interface RegistroUso {
  supabase: SupabaseClient;
  escritorioId: string;
  /** Mês de referência "YYYY-MM" — derivado de agora() quando omitido. */
  mesRef?: string;
  conversaId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  /** Identificador do modelo usado (ex.: "gemini-2.0-flash", "llama-3.3-70b"). */
  modelo?: string;
  /** Duração da chamada em milissegundos. */
  duracaoMs?: number;
  /** Origem funcional (ex.: "chat", "audio", "auditor", "calculadora"). */
  origem?: string;
}

/** Mês de referência no formato usado pela coluna `mes_ref` ("YYYY-MM"). */
export function mesReferencia(data = new Date()): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/**
 * Registra uma chamada de IA em `uso_ia` com metadados de observabilidade
 * (modelo, duração, origem). BEST-EFFORT por design: falha de telemetria
 * NUNCA pode bloquear a resposta do usuário — erros são engolidos e ficam
 * visíveis apenas nos logs do servidor.
 *
 * As chamadas antigas que gravavam só tokens/mes_ref continuam válidas:
 * as novas colunas são opcionais e preenchidas quando disponíveis.
 */
export async function registrarUso(entrada: RegistroUso): Promise<void> {
  try {
    await entrada.supabase.from("uso_ia").insert({
      escritorio_id: entrada.escritorioId,
      conversa_id: entrada.conversaId ?? null,
      tokens_in: entrada.tokensIn ?? 0,
      tokens_out: entrada.tokensOut ?? 0,
      mes_ref: entrada.mesRef ?? mesReferencia(),
      modelo: entrada.modelo ?? null,
      duracao_ms: entrada.duracaoMs ?? null,
      origem: entrada.origem ?? null,
    });
  } catch (erro) {
    console.error("[registro-uso] falha ao registrar uso de IA:", erro);
  }
}
