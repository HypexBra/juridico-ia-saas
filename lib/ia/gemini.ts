import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT } from "./system-prompt";

const MODEL = "gemini-2.0-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  return new GoogleGenerativeAI(apiKey);
}

export type ChatTurno = { role: "user" | "assistant"; conteudo: string };

export async function gerarResposta(historico: ChatTurno[]) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const ultima = historico[historico.length - 1];
  const anteriores = historico.slice(0, -1);

  const chat = model.startChat({
    history: anteriores.map((turno) => ({
      role: turno.role === "assistant" ? "model" : "user",
      parts: [{ text: turno.conteudo }],
    })),
  });

  const resultado = await chat.sendMessage(ultima.conteudo);
  const resposta = resultado.response;
  const uso = resposta.usageMetadata;

  return {
    texto: resposta.text(),
    tokensIn: uso?.promptTokenCount ?? 0,
    tokensOut: uso?.candidatesTokenCount ?? 0,
  };
}
