/**
 * Utilitários de conversão de schema entre o formato do Gemini (`@google/genai`)
 * e o JSON Schema padrão OpenAI/Groq — extraído de `lib/ia/groq.ts` para
 * `lib/ia/langchain/` junto com o resto da camada LangChain do Groq, sem
 * dependência de nenhum SDK específico (função pura, testável isoladamente).
 */

/**
 * Converte uma `FunctionDeclaration` no formato do Gemini (tipos em
 * MAIÚSCULAS, ex: `Type.OBJECT` = "OBJECT") para JSON Schema padrão OpenAI
 * (tipos em minúsculas), único ajuste estrutural necessário — o restante
 * (properties/required/enum/description) já é compatível entre os dois
 * formatos.
 */
export function paraJsonSchemaOpenAi(valor: unknown): unknown {
  if (valor === null || typeof valor !== "object") return valor;
  if (Array.isArray(valor)) return valor.map(paraJsonSchemaOpenAi);

  const objeto = valor as Record<string, unknown>;
  const resultado: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(objeto)) {
    if (chave === "type" && typeof item === "string") {
      resultado.type = item.toLowerCase();
    } else if (chave === "format" && item === "enum") {
      // "format: enum" é sintaxe específica do Gemini para sinalizar que
      // "enum" abaixo restringe os valores — no JSON Schema padrão o array
      // `enum` já basta, então o campo é descartado (não tem equivalente).
      continue;
    } else {
      resultado[chave] = paraJsonSchemaOpenAi(item);
    }
  }
  return resultado;
}
