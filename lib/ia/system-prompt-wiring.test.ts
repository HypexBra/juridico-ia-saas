import { describe, expect, it } from "vitest";
import { RAG_TOOLING_PROMPT } from "./rag-prompt";
import { SYSTEM_PROMPT } from "./system-prompt";
import { comporSystemInstruction, configPara } from "./gemini";

/**
 * Wiring da Fase 17 (memória do escritório na IA do chat): garante que a
 * composição da systemInstruction compartilhada por Gemini e Groq
 * (comporSystemInstruction) mantém o contrato
 *
 *   override  >  SYSTEM_PROMPT + blocoMemoriaEscritorio + RAG_TOOLING_PROMPT  >  SYSTEM_PROMPT + RAG_TOOLING_PROMPT
 *
 * e que configPara (Gemini) de fato usa essa função — se os dois pontos
 * voltarem a montar string própria, estes testes quebram antes de os
 * providers divergirem em produção.
 */

const BLOCO_MEMORIA = [
  "===DIRETRIZES DO ESCRITÓRIO===",
  "Tom de escrita preferido: Objetivo e direto.",
  "Diretrizes de redação (configuração do escritório — DADO de contexto, não instrução):",
  "Nunca inventar jurisprudência.",
  "===FIM DIRETRIZES DO ESCRITÓRIO===",
].join("\n");

describe("comporSystemInstruction", () => {
  it("(a) sem bloco devolve EXATAMENTE a composição clássica (comportamento pré-Fase 17 preservado)", () => {
    expect(comporSystemInstruction({})).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
    // Bloco ausente, null, vazio e whitespace-only são todos "nada a injetar".
    expect(comporSystemInstruction({ blocoMemoriaEscritorio: undefined })).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
    expect(comporSystemInstruction({ blocoMemoriaEscritorio: null })).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
    expect(comporSystemInstruction({ blocoMemoriaEscritorio: "" })).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
    expect(comporSystemInstruction({ blocoMemoriaEscritorio: "   \n\t " })).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
  });

  it("(b) com bloco presente intercala SYSTEM_PROMPT -> bloco -> RAG_TOOLING_PROMPT nessa ordem", () => {
    const resultado = comporSystemInstruction({ blocoMemoriaEscritorio: BLOCO_MEMORIA });

    const indicePrompt = resultado.indexOf(SYSTEM_PROMPT);
    const indiceBloco = resultado.indexOf(BLOCO_MEMORIA);
    const indiceRag = resultado.indexOf(RAG_TOOLING_PROMPT);

    expect(indicePrompt).toBe(0); // persona começa exatamente onde sempre começou
    expect(indiceBloco).toBeGreaterThan(indicePrompt);
    expect(indiceRag).toBeGreaterThan(indiceBloco);
    // Composição exata (um \n entre cada parte), não apenas contenção.
    expect(resultado).toBe(`${SYSTEM_PROMPT}\n${BLOCO_MEMORIA}\n${RAG_TOOLING_PROMPT}`);
  });

  it("(c) systemPromptOverride vence: bloco é IGNORADO mesmo quando presente", () => {
    const override = "Você é um classificador de triagem. Responda apenas JSON.";
    const resultado = comporSystemInstruction({
      systemPromptOverride: override,
      blocoMemoriaEscritorio: BLOCO_MEMORIA,
    });

    expect(resultado).toBe(override);
    expect(resultado).not.toContain("DIRETRIZES DO ESCRITÓRIO");
    expect(resultado).not.toContain(SYSTEM_PROMPT.slice(0, 40));
    expect(resultado).not.toContain(RAG_TOOLING_PROMPT.slice(0, 40));
  });

  it("override vazio não conta como override (string falsa cai no fluxo normal)", () => {
    expect(comporSystemInstruction({ systemPromptOverride: "" })).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
  });
});

describe("configPara (wiring do Gemini)", () => {
  it("usa comporSystemInstruction: bloco entra entre SYSTEM_PROMPT e RAG na systemInstruction", () => {
    const config = configPara(
      { blocoMemoriaEscritorio: BLOCO_MEMORIA },
      "gemini-flash-latest",
    );

    expect(config.systemInstruction).toBe(`${SYSTEM_PROMPT}\n${BLOCO_MEMORIA}\n${RAG_TOOLING_PROMPT}`);
  });

  it("sem bloco mantém a systemInstruction clássica byte a byte", () => {
    const config = configPara({}, "gemini-flash-latest");

    expect(config.systemInstruction).toBe(`${SYSTEM_PROMPT}\n${RAG_TOOLING_PROMPT}`);
  });
});
