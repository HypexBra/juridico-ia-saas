import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decifrarChaveIa } from "./criptografia";
import type { ChaveProviderSelecionada, ProviderIa, StatusChave } from "./tipos";

type LinhaChaveCompleta = {
  id: string;
  provider: ProviderIa;
  nome: string;
  chave_cifrada: string;
  status: StatusChave;
};

/**
 * Seleciona a próxima chave disponível de `provider` via a RPC
 * `selecionar_e_registrar_uso_chave` (transação atômica no Postgres — ver
 * migration 0032), decifra o ciphertext e devolve a chave já em texto puro,
 * pronta para montar o client HTTP do provedor.
 *
 * A chave decifrada NUNCA é armazenada em variável de módulo, cache ou
 * qualquer estado que sobreviva além do escopo desta chamada — quem chama
 * (gemini.ts/groq.ts) usa e descarta dentro da própria função de request.
 * Retorna `null` quando o pool está esgotado para este provider (nenhuma
 * chave ativa/disponível/dentro do rpm), sinal para o caller lançar
 * `QuotaExcedidaError` e deixar `lib/ia/provider.ts` decidir o fallback.
 */
export async function selecionarChave(provider: ProviderIa): Promise<ChaveProviderSelecionada | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("selecionar_e_registrar_uso_chave", { p_provider: provider })
    .returns<LinhaChaveCompleta[]>();

  if (error) {
    console.error("[ia/chaves/pool] Falha ao chamar selecionar_e_registrar_uso_chave:", error.message, {
      provider,
    });
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  const linha = data[0] as LinhaChaveCompleta | undefined;
  if (!linha) return null;

  let chavePlana: string;
  try {
    chavePlana = decifrarChaveIa(linha.chave_cifrada);
  } catch (erroDecifra) {
    // Ciphertext corrompido/master key trocada: nunca propaga o erro cru
    // (poderia vazar detalhe do ciphertext em log) — trata como pool
    // esgotado para este provider e registra falha, para a chave sair de
    // circulação até intervenção manual via /admin.
    console.error("[ia/chaves/pool] Falha ao decifrar chave — marcando indisponível:", provider, linha.id, erroDecifra);
    await registrarFalhaQuota(linha.id, "Falha ao decifrar chave (ciphertext inválido ou master key divergente).");
    return null;
  }

  return { id: linha.id, provider: linha.provider, chavePlana, nome: linha.nome };
}

/**
 * Marca a chave `chaveId` como temporariamente indisponível após um 429/
 * rate-limit real do provedor: o pool volta a considerá-la elegível só após
 * `disponivel_em` (65s à frente, calculado no PRÓPRIO Postgres via `now()`
 * — nunca `Date.now()` do Node, para não sofrer de clock skew entre
 * instâncias serverless). `motivo` é livre-texto para diagnóstico em
 * `/admin/ia-chaves`, nunca contém a chave em si.
 */
export async function registrarFalhaQuota(chaveId: string, motivo: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("registrar_falha_quota_chave_ia", {
    p_chave_id: chaveId,
    p_motivo: motivo,
  });

  if (error) {
    console.error("[ia/chaves/pool] Falha ao registrar falha de quota:", error.message, { chaveId });
  }
}
