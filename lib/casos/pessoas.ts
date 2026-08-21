/**
 * Lógica pura (sem I/O) de "Pessoas do Caso" (Fase 1 "Caso Inteligente",
 * migration `0023_caso_pessoas.sql`) — partes, adverso, testemunhas e
 * terceiros vinculados a uma ficha, além do `cliente_id` único que
 * `fichas_caso` já carrega.
 *
 * Mantido isolado de Server Actions/Supabase de propósito: toda regra de
 * validação/normalização testável sem banco fica aqui, seguindo o mesmo
 * padrão de `lib/mensagens-portal/mensagens.ts` e
 * `lib/peticoes/montar-dados-mail-merge.ts`.
 */
import { z } from "zod";
import type { TipoPessoaCaso } from "@/lib/types";

/** Único ponto de verdade dos 4 valores válidos de `pessoas_caso.tipo` (bate com o `check` da migration 0023). */
export const TIPOS_PESSOA_CASO = ["parte", "adverso", "testemunha", "terceiro"] as const;

export function tipoPessoaCasoValido(valor: string): valor is TipoPessoaCaso {
  return (TIPOS_PESSOA_CASO as readonly string[]).includes(valor);
}

const LABELS_TIPO_PESSOA_CASO: Record<TipoPessoaCaso, string> = {
  parte: "Parte",
  adverso: "Parte adversa",
  testemunha: "Testemunha",
  terceiro: "Terceiro interessado",
};

export function labelTipoPessoaCaso(tipo: TipoPessoaCaso): string {
  return LABELS_TIPO_PESSOA_CASO[tipo];
}

/** Retorna só os dígitos de uma string (remove pontuação, espaços etc.). */
function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

function calcularDigitoVerificadorCpf(digitos: string, peso: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos[i]) * (peso - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function cpfValido(digitos: string): boolean {
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;
  const dv1 = calcularDigitoVerificadorCpf(digitos.slice(0, 9), 10);
  if (dv1 !== Number(digitos[9])) return false;
  const dv2 = calcularDigitoVerificadorCpf(digitos.slice(0, 10), 11);
  return dv2 === Number(digitos[10]);
}

function formatarCpf(digitos: string): string {
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

const PESOS_CNPJ_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function calcularDigitoVerificadorCnpj(digitos: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos[i]) * (pesos[i] ?? 0);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjValido(digitos: string): boolean {
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;
  const dv1 = calcularDigitoVerificadorCnpj(digitos.slice(0, 12), PESOS_CNPJ_DV1);
  if (dv1 !== Number(digitos[12])) return false;
  const dv2 = calcularDigitoVerificadorCnpj(digitos.slice(0, 13), PESOS_CNPJ_DV2);
  return dv2 === Number(digitos[13]);
}

function formatarCnpj(digitos: string): string {
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
}

/**
 * Normaliza o campo livre `documento` (`varchar(50)`, pode ser CPF de pessoa
 * física, CNPJ de pessoa jurídica adversa, ou outro documento — RG,
 * passaporte — para testemunhas/terceiros estrangeiros).
 *
 * - `undefined`/string vazia após trim → `null` (não grava string vazia).
 * - Exatamente 11 dígitos → formata como CPF SE os dígitos verificadores
 *   forem válidos; senão devolve só os dígitos (não inventa formatação
 *   sobre um número que não é um CPF real).
 * - Exatamente 14 dígitos → mesma lógica, mas para CNPJ.
 * - Qualquer outro formato (RG, passaporte, CPF/CNPJ digitado errado com
 *   mais/menos dígitos) → devolve o valor original, só com espaços nas
 *   pontas removidos — nunca lança erro nem descarta o dado informado.
 */
export function normalizarDocumentoPessoa(documento: string | null | undefined): string | null {
  if (documento == null) return null;
  const semEspacos = documento.trim();
  if (semEspacos === "") return null;

  const digitos = apenasDigitos(semEspacos);
  if (digitos.length === 11) return cpfValido(digitos) ? formatarCpf(digitos) : digitos;
  if (digitos.length === 14) return cnpjValido(digitos) ? formatarCnpj(digitos) : digitos;
  return semEspacos;
}

/** `null`/string vazia após trim vira `null`; senão devolve trimado. Usado para `contato`/`papel_processual` (colunas opcionais). */
export function normalizarTextoOpcional(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const trimado = valor.trim();
  return trimado === "" ? null : trimado;
}

export const NOME_PESSOA_CASO_MAX = 255;
export const PAPEL_PROCESSUAL_MAX = 100;
export const CONTATO_PESSOA_CASO_MAX = 255;
export const DOCUMENTO_PESSOA_CASO_MAX = 50;

/** Schema de entrada para criar/atualizar uma pessoa do caso (Server Actions). */
export const pessoaCasoInputSchema = z.object({
  tipo: z.enum(TIPOS_PESSOA_CASO, { message: "Tipo de pessoa inválido." }),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome da pessoa.")
    .max(NOME_PESSOA_CASO_MAX, `Nome muito longo (máximo de ${NOME_PESSOA_CASO_MAX} caracteres).`),
  documento: z
    .string()
    .max(DOCUMENTO_PESSOA_CASO_MAX, `Documento muito longo (máximo de ${DOCUMENTO_PESSOA_CASO_MAX} caracteres).`)
    .nullable()
    .optional(),
  contato: z
    .string()
    .max(CONTATO_PESSOA_CASO_MAX, `Contato muito longo (máximo de ${CONTATO_PESSOA_CASO_MAX} caracteres).`)
    .nullable()
    .optional(),
  papelProcessual: z
    .string()
    .max(PAPEL_PROCESSUAL_MAX, `Papel processual muito longo (máximo de ${PAPEL_PROCESSUAL_MAX} caracteres).`)
    .nullable()
    .optional(),
});

export type PessoaCasoInput = z.infer<typeof pessoaCasoInputSchema>;

/** Mesmo schema, mas todos os campos opcionais — usado na atualização parcial (`atualizarPessoaCasoAction`). */
export const pessoaCasoUpdateSchema = pessoaCasoInputSchema.partial();

export type PessoaCasoUpdateInput = z.infer<typeof pessoaCasoUpdateSchema>;

/**
 * Monta o payload pronto para `insert`/`update` em `pessoas_caso` a partir de
 * um input já validado pelo Zod, aplicando a normalização de
 * documento/contato/papel processual. Função pura — não decide
 * `escritorio_id`/`ficha_caso_id`, isso é responsabilidade da Server Action
 * (que conhece o usuário autenticado).
 */
export function montarPayloadPessoaCaso(input: PessoaCasoInput): {
  tipo: TipoPessoaCaso;
  nome: string;
  documento: string | null;
  contato: string | null;
  papel_processual: string | null;
} {
  return {
    tipo: input.tipo,
    nome: input.nome.trim(),
    documento: normalizarDocumentoPessoa(input.documento),
    contato: normalizarTextoOpcional(input.contato),
    papel_processual: normalizarTextoOpcional(input.papelProcessual),
  };
}

/**
 * Mesma montagem, mas parcial (só inclui as chaves de fato presentes no
 * input) — usada na atualização, para não sobrescrever colunas que o
 * chamador não pretendia alterar com `null`.
 */
export function montarPayloadParcialPessoaCaso(input: PessoaCasoUpdateInput): Partial<{
  tipo: TipoPessoaCaso;
  nome: string;
  documento: string | null;
  contato: string | null;
  papel_processual: string | null;
}> {
  const payload: Partial<{
    tipo: TipoPessoaCaso;
    nome: string;
    documento: string | null;
    contato: string | null;
    papel_processual: string | null;
  }> = {};

  if (input.tipo !== undefined) payload.tipo = input.tipo;
  if (input.nome !== undefined) payload.nome = input.nome.trim();
  if (input.documento !== undefined) payload.documento = normalizarDocumentoPessoa(input.documento);
  if (input.contato !== undefined) payload.contato = normalizarTextoOpcional(input.contato);
  if (input.papelProcessual !== undefined) payload.papel_processual = normalizarTextoOpcional(input.papelProcessual);

  return payload;
}
