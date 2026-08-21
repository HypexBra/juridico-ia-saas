import { describe, expect, it } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { paraRespostaIa } from "./mapeamento";

describe("paraRespostaIa", () => {
  it("mapeia texto simples e usage_metadata para o shape RespostaIa", () => {
    const mensagem = new AIMessage({
      content: "Olá, como posso ajudar?",
      usage_metadata: { input_tokens: 120, output_tokens: 45, total_tokens: 165 },
    });

    const resposta = paraRespostaIa(mensagem);

    expect(resposta.texto).toBe("Olá, como posso ajudar?");
    expect(resposta.tokensIn).toBe(120);
    expect(resposta.tokensOut).toBe(45);
    expect(resposta.functionCalls).toEqual([]);
  });

  it("mapeia tool_calls para ChamadaFuncao[]", () => {
    const mensagem = new AIMessage({
      content: "",
      tool_calls: [{ id: "call_1", name: "propose_update_prazo", args: { prazo_id: "abc-123", nova_data: "2026-09-01" } }],
    });

    const resposta = paraRespostaIa(mensagem);

    expect(resposta.functionCalls).toEqual([
      { name: "propose_update_prazo", args: { prazo_id: "abc-123", nova_data: "2026-09-01" } },
    ]);
  });

  it("descarta tool_calls sem nome", () => {
    const mensagem = new AIMessage({
      content: "",
      tool_calls: [{ id: "call_1", name: "", args: {} }],
    });

    expect(paraRespostaIa(mensagem).functionCalls).toEqual([]);
  });

  it("usa 0 como default quando usage_metadata está ausente", () => {
    const mensagem = new AIMessage({ content: "sem uso reportado" });
    const resposta = paraRespostaIa(mensagem);
    expect(resposta.tokensIn).toBe(0);
    expect(resposta.tokensOut).toBe(0);
  });

  it("concatena blocos de texto quando content é um array (conteúdo complexo)", () => {
    const mensagem = new AIMessage({
      content: [
        { type: "text", text: "Parte 1. " },
        { type: "text", text: "Parte 2." },
      ],
    });

    expect(paraRespostaIa(mensagem).texto).toBe("Parte 1. Parte 2.");
  });
});
