import "server-only";

import { Type, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";

/**
 * Contrato de cada tool do copiloto. Toda tool só PROPÕE a ação (nunca
 * escreve no banco/gera arquivo direto) — ver app/app/chat/propostas-actions.ts
 * para o fluxo de aprovação. O schema Zod é a validação de verdade: os
 * argumentos que o Gemini devolve nunca são confiáveis por padrão, mesmo
 * já vindo de uma function call "estruturada".
 */

export const propostaUpdatePrazoSchema = z.object({
  prazo_id: z.string().uuid(),
  mudancas: z
    .object({
      titulo: z.string().trim().min(1).max(255).optional(),
      descricao: z.string().trim().max(4000).optional(),
      data_prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD").optional(),
      processo: z.string().trim().max(100).optional(),
      cliente_nome: z.string().trim().max(255).optional(),
      concluido: z.boolean().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, "Informe ao menos um campo para alterar."),
  motivo: z.string().trim().min(1).max(500),
});

export const propostaUpdateFichaSchema = z.object({
  ficha_id: z.string().uuid(),
  mudancas: z
    .object({
      area_direito: z.string().trim().max(100).optional(),
      resumo_fatos: z.string().trim().max(8000).optional(),
      urgencia: z.enum(["baixa", "normal", "alta"]).optional(),
      lida: z.boolean().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, "Informe ao menos um campo para alterar."),
  motivo: z.string().trim().min(1).max(500),
});

export const propostaCreatePrazoSchema = z.object({
  dados: z.object({
    titulo: z.string().trim().min(1).max(255),
    descricao: z.string().trim().max(4000).optional(),
    data_prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
    processo: z.string().trim().max(100).optional(),
    cliente_nome: z.string().trim().max(255).optional(),
  }),
  motivo: z.string().trim().min(1).max(500),
});

export const propostaCreateFichaSchema = z.object({
  dados: z.object({
    nome_cliente: z.string().trim().max(255).optional(),
    telefone: z.string().trim().max(20).optional(),
    area_direito: z.string().trim().max(100).optional(),
    resumo_fatos: z.string().trim().max(8000).optional(),
    urgencia: z.enum(["baixa", "normal", "alta"]).default("normal"),
  }),
  motivo: z.string().trim().min(1).max(500),
});

export const propostaGenerateDocumentoSchema = z.object({
  titulo: z.string().trim().min(1).max(255),
  tipo_documento: z.string().trim().min(1).max(100),
  conteudo: z.string().trim().min(1).max(50000),
  formato: z.enum(["docx", "pdf"]).default("docx"),
});

export const TOOL_SCHEMAS = {
  propose_update_prazo: propostaUpdatePrazoSchema,
  propose_update_ficha: propostaUpdateFichaSchema,
  propose_create_prazo: propostaCreatePrazoSchema,
  propose_create_ficha: propostaCreateFichaSchema,
  propose_generate_document: propostaGenerateDocumentoSchema,
} as const;

export type NomeTool = keyof typeof TOOL_SCHEMAS;

export const TOOL_PARA_TIPO_PROPOSTA: Record<
  NomeTool,
  "update_ficha" | "update_prazo" | "create_ficha" | "create_prazo" | "generate_documento"
> = {
  propose_update_prazo: "update_prazo",
  propose_update_ficha: "update_ficha",
  propose_create_prazo: "create_prazo",
  propose_create_ficha: "create_ficha",
  propose_generate_document: "generate_documento",
};

/** Declarações no formato esperado pelo SDK do Gemini (function calling nativo). */
export const GEMINI_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "propose_update_prazo",
    description:
      "Propõe uma alteração em um prazo já existente (ex: mudar data, marcar como concluído, ajustar descrição). NUNCA aplica a mudança — apenas cria uma proposta para o usuário aprovar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prazo_id: { type: Type.STRING, description: "UUID do prazo a alterar." },
        mudancas: {
          type: Type.OBJECT,
          properties: {
            titulo: { type: Type.STRING },
            descricao: { type: Type.STRING },
            data_prazo: { type: Type.STRING, description: "Formato YYYY-MM-DD" },
            processo: { type: Type.STRING },
            cliente_nome: { type: Type.STRING },
            concluido: { type: Type.BOOLEAN },
          },
        },
        motivo: { type: Type.STRING, description: "Explicação curta do porquê da mudança." },
      },
      required: ["prazo_id", "mudancas", "motivo"],
    },
  },
  {
    name: "propose_update_ficha",
    description:
      "Propõe uma alteração em uma ficha de caso já existente (ex: urgência, resumo dos fatos, área do direito). NUNCA aplica a mudança direto.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ficha_id: { type: Type.STRING, description: "UUID da ficha a alterar." },
        mudancas: {
          type: Type.OBJECT,
          properties: {
            area_direito: { type: Type.STRING },
            resumo_fatos: {
              type: Type.STRING,
              description:
                "Narrativa jurídica COMPLETA dos fatos (não uma frase única) — mesmo padrão de detalhe de " +
                "propose_create_ficha: contexto, cronologia, fundamentos legais potenciais, provas mencionadas " +
                "e o que falta esclarecer.",
            },
            urgencia: { type: Type.STRING, format: "enum", enum: ["baixa", "normal", "alta"] },
            lida: { type: Type.BOOLEAN },
          },
        },
        motivo: { type: Type.STRING },
      },
      required: ["ficha_id", "mudancas", "motivo"],
    },
  },
  {
    name: "propose_create_prazo",
    description: "Propõe a criação de um novo prazo a partir da conversa. NUNCA cria o registro direto.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        dados: {
          type: Type.OBJECT,
          properties: {
            titulo: { type: Type.STRING },
            descricao: { type: Type.STRING },
            data_prazo: { type: Type.STRING, description: "Formato YYYY-MM-DD" },
            processo: { type: Type.STRING },
            cliente_nome: { type: Type.STRING },
          },
          required: ["titulo", "data_prazo"],
        },
        motivo: { type: Type.STRING },
      },
      required: ["dados", "motivo"],
    },
  },
  {
    name: "propose_create_ficha",
    description: "Propõe a criação de uma nova ficha de caso a partir da conversa. NUNCA cria o registro direto.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        dados: {
          type: Type.OBJECT,
          properties: {
            nome_cliente: { type: Type.STRING },
            telefone: { type: Type.STRING },
            area_direito: { type: Type.STRING },
            resumo_fatos: {
              type: Type.STRING,
              description:
                "Narrativa jurídica COMPLETA dos fatos relatados na conversa, não um resumo de uma frase. " +
                "Inclua: contexto e histórico relevante; todos os fatos narrados em ordem cronológica com " +
                "datas/valores/nomes de partes quando informados; direitos/deveres e fundamentos legais " +
                "potencialmente aplicáveis (lei/artigo, quando identificável); documentos e provas já " +
                "mencionados; e o que ainda falta esclarecer. Escreva em parágrafos corridos, linguagem " +
                "jurídica técnica — este texto é o que o advogado vai ler para entender o caso sem precisar " +
                "reler a conversa inteira, então prefira ser mais completo do que sucinto.",
            },
            urgencia: { type: Type.STRING, format: "enum", enum: ["baixa", "normal", "alta"] },
          },
        },
        motivo: { type: Type.STRING },
      },
      required: ["dados", "motivo"],
    },
  },
  {
    name: "propose_generate_document",
    description:
      "Propõe a geração de um documento (petição, contrato, notificação etc.) em docx ou pdf a partir do texto já elaborado na conversa. NUNCA gera o arquivo direto — só depois de aprovado o usuário pode baixá-lo.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titulo: { type: Type.STRING, description: "Nome do documento, vira o nome do arquivo." },
        tipo_documento: { type: Type.STRING, description: "Ex: petição inicial, contrato, notificação." },
        conteudo: { type: Type.STRING, description: "Texto completo do documento já redigido." },
        formato: { type: Type.STRING, format: "enum", enum: ["docx", "pdf"] },
      },
      required: ["titulo", "tipo_documento", "conteudo"],
    },
  },
];
