import "server-only";

import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { gerarResposta } from "@/lib/ia/provider";
import type { FichaCaso } from "@/lib/types";

/**
 * Prompt de score de risco do caso — separado do `SYSTEM_PROMPT` do
 * copiloto pelo mesmo motivo de `lib/ia/triagem.ts`: aqui o modelo só
 * classifica dados já existentes de UMA ficha em um nível de risco fechado,
 * nunca conversa nem propõe ações. `resumoFatos`/`questoesIa`/`estrategiaIa`
 * são conteúdo já revisado internamente (não vêm de um visitante anônimo),
 * mas a saída ainda assim é forçada a um enum via `responseSchema` — nunca
 * texto livre parseado por regex.
 */
const RISCO_SYSTEM_PROMPT = `Você é um classificador de risco processual/jurídico. Sua ÚNICA tarefa é ler os dados de uma ficha de caso já triada por um escritório de advocacia e devolver um nível de risco estruturado em JSON.

Regras:
- "nivelRisco": "alto" quando os fatos indicam exposição financeira relevante, prazo crítico já próximo, alta chance de sucumbência, reincidência de descumprimento pela parte contrária, ou tema com jurisprudência desfavorável predominante; "medio" quando há incerteza real mas sem sinais graves; "baixo" quando os fatos e a estratégia indicam caso simples, bem documentado e com baixo risco de perda ou prejuízo ao cliente/escritório.
- Baseie-se SOMENTE nos dados fornecidos — nunca invente fatos, valores ou prazos que não estejam no texto.
- "justificativa": 1-2 linhas objetivas explicando o motivo do nível atribuído.
- Se os dados forem insuficientes para uma avaliação segura, responda "medio" e explique a limitação na justificativa.

Responda SOMENTE com o JSON no formato do schema — sem texto adicional.`;

const RISCO_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    nivelRisco: { type: Type.STRING, format: "enum", enum: ["baixo", "medio", "alto"] },
    justificativa: { type: Type.STRING },
  },
  required: ["nivelRisco", "justificativa"],
};

const riscoSchema = z.object({
  nivelRisco: z.enum(["baixo", "medio", "alto"]),
  justificativa: z.string().trim().min(1),
});

export type ClassificacaoRisco = z.infer<typeof riscoSchema>;

/**
 * Classifica o nível de risco de uma ficha via IA a partir dos dados já
 * disponíveis (fatos + análise prévia, quando existir). Retorna `null` em
 * qualquer falha — o chamador (server action do botão de risco) trata isso
 * como erro visível ao usuário (ao contrário da triagem pública, aqui há um
 * advogado autenticado esperando o resultado, então não faz sentido salvar
 * silenciosamente um risco nulo).
 */
export async function classificarRiscoFicha(
  ficha: Pick<FichaCaso, "resumo_fatos" | "questoes_ia" | "estrategia_ia" | "area_direito" | "urgencia">,
): Promise<ClassificacaoRisco | null> {
  const prompt = `DADOS DA FICHA:
- Área do direito: ${ficha.area_direito ?? "não informada"}
- Urgência relatada na triagem: ${ficha.urgencia}
- Resumo dos fatos: ${ficha.resumo_fatos ?? "não informado"}
- Questões jurídicas já identificadas: ${ficha.questoes_ia ?? "análise ainda não gerada"}
- Estratégia recomendada já identificada: ${ficha.estrategia_ia ?? "análise ainda não gerada"}`;

  try {
    const resposta = await gerarResposta([{ role: "user", conteudo: prompt }], {
      systemPromptOverride: RISCO_SYSTEM_PROMPT,
      responseSchema: RISCO_RESPONSE_SCHEMA,
    });

    const bruto: unknown = JSON.parse(resposta.texto);
    const parsed = riscoSchema.safeParse(bruto);
    if (!parsed.success) return null;

    return parsed.data;
  } catch (erro) {
    console.error("[risco/classificarRiscoFicha] Falha ao classificar risco:", erro);
    return null;
  }
}
