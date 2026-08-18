import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { EventoWebhookAssinatura, ResultadoEnvioAssinatura, SignatarioEnvio } from "./tipos";

/**
 * Cliente da API do Autentique (https://docs.autentique.com.br).
 *
 * Escolha de provedor (vs. Clicksign): Autentique tem plano gratuito com
 * limite de documentos/mês suficiente para MVP, API única em GraphQL (menos
 * chamadas encadeadas que o fluxo REST multi-step da Clicksign — lá é preciso
 * criar envelope, depois signatário, depois "vincular" documento+signatário
 * em requisições separadas), autenticação simples via Bearer token e
 * webhooks com verificação HMAC-SHA256 nativa (header `x-autentique-signature`).
 * Upload de arquivo segue a spec padrão de GraphQL multipart request
 * (https://github.com/jaydenseric/graphql-multipart-request-spec), suportada
 * nativamente pelo `fetch`/`FormData`/`Blob` do runtime Node do Next — não
 * precisa de SDK/dependência extra.
 */
const AUTENTIQUE_GRAPHQL_URL = "https://api.autentique.com.br/v2/graphql";

const MIME_POR_FORMATO: Record<"docx" | "pdf", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * A feature deve ficar desabilitada (não quebrar o app) quando a API key não
 * está configurada — usado tanto no server action quanto para decidir se a
 * UI mostra o botão de envio ou um aviso.
 */
export function autentiqueEstaConfigurado(): boolean {
  return Boolean(process.env.AUTENTIQUE_API_TOKEN);
}

const CREATE_DOCUMENT_MUTATION = `
  mutation CriarDocumentoAssinatura($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(document: $document, signers: $signers, file: $file) {
      id
      name
      signatures {
        public_id
        email
        link {
          short_link
        }
      }
    }
  }
`;

type RespostaCreateDocument = {
  data?: {
    createDocument?: {
      id: string;
      name: string;
      signatures: Array<{ public_id: string; email: string | null; link: { short_link: string } | null }>;
    };
  };
  errors?: Array<{ message: string }>;
};

/**
 * Cria um documento para assinatura no Autentique a partir do arquivo já
 * gerado (docx/pdf) e da lista de signatários (nome + email).
 *
 * Lança erro claro se `AUTENTIQUE_API_TOKEN` não estiver configurada — quem
 * chama (server action) deve checar `autentiqueEstaConfigurado()` antes e
 * nunca deixar a exceção subir pra UI sem tratamento.
 */
export async function criarDocumentoParaAssinatura(params: {
  nomeDocumento: string;
  arquivo: Buffer;
  nomeArquivo: string;
  formato: "docx" | "pdf";
  signatarios: SignatarioEnvio[];
}): Promise<ResultadoEnvioAssinatura> {
  const apiToken = process.env.AUTENTIQUE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "AUTENTIQUE_API_TOKEN não configurada. Defina essa variável de ambiente para habilitar o envio de assinatura eletrônica.",
    );
  }

  const operations = JSON.stringify({
    query: CREATE_DOCUMENT_MUTATION,
    variables: {
      document: { name: params.nomeDocumento },
      signers: params.signatarios.map((signatario) => ({
        name: signatario.nome,
        email: signatario.email,
        action: "SIGN",
      })),
      file: null,
    },
  });
  const map = JSON.stringify({ "0": ["variables.file"] });

  const formData = new FormData();
  formData.append("operations", operations);
  formData.append("map", map);
  formData.append(
    "0",
    new Blob([new Uint8Array(params.arquivo)], { type: MIME_POR_FORMATO[params.formato] }),
    params.nomeArquivo,
  );

  let resposta: Response;
  try {
    resposta = await fetch(AUTENTIQUE_GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    });
  } catch (erro) {
    return { ok: false, error: `Falha de rede ao contatar o Autentique: ${(erro as Error).message}` };
  }

  if (!resposta.ok) {
    return { ok: false, error: `Autentique retornou HTTP ${resposta.status}.` };
  }

  let corpo: RespostaCreateDocument;
  try {
    corpo = (await resposta.json()) as RespostaCreateDocument;
  } catch {
    return { ok: false, error: "Resposta inválida (não-JSON) do Autentique." };
  }

  if (corpo.errors?.length) {
    return { ok: false, error: corpo.errors.map((e) => e.message).join("; ") };
  }

  const documento = corpo.data?.createDocument;
  if (!documento) {
    return { ok: false, error: "Autentique não retornou o documento criado." };
  }

  const linksPorEmail: Record<string, string> = {};
  for (const assinatura of documento.signatures) {
    if (assinatura.email && assinatura.link?.short_link) {
      linksPorEmail[assinatura.email] = assinatura.link.short_link;
    }
  }

  return { ok: true, idExterno: documento.id, linksPorEmail };
}

/**
 * Valida a assinatura HMAC-SHA256 do webhook do Autentique (header
 * `x-autentique-signature` = HMAC-SHA256(corpo_bruto, secret) em hex).
 * Usa `timingSafeEqual` para evitar timing attack na comparação.
 *
 * Retorna `false` (fecha o acesso, "fail closed") se o secret não estiver
 * configurado — nunca aceita webhook não verificável.
 */
export function validarAssinaturaWebhookAutentique(corpoBruto: string, assinaturaRecebida: string | null): boolean {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  if (!secret || !assinaturaRecebida) return false;

  const assinaturaEsperada = createHmac("sha256", secret).update(corpoBruto, "utf8").digest("hex");

  const bufferRecebido = Buffer.from(assinaturaRecebida.trim().toLowerCase(), "hex");
  const bufferEsperado = Buffer.from(assinaturaEsperada, "hex");
  if (bufferRecebido.length !== bufferEsperado.length) return false;

  return timingSafeEqual(bufferRecebido, bufferEsperado);
}

/**
 * Payload de webhook documentado como: `{ id, event, data: { document_id?,
 * document?: { id }, signatures?: [{ email, action, rejected, signed }] } }`.
 * Como o schema exato varia por evento e a doc pública não detalha 100% dos
 * campos, o parsing é propositalmente defensivo: qualquer campo ausente vira
 * `null`/array vazio em vez de lançar exceção — um webhook com payload
 * inesperado não deve derrubar a rota (ela responde 200 mesmo assim, pra
 * evitar retry storm do provedor), só não teremos o que atualizar.
 */
export function interpretarEventoWebhookAutentique(payloadBruto: unknown): EventoWebhookAssinatura | null {
  if (typeof payloadBruto !== "object" || payloadBruto === null) return null;
  const payload = payloadBruto as Record<string, unknown>;

  const data = (payload.data ?? payload) as Record<string, unknown>;
  const documento = (data.document ?? data) as Record<string, unknown>;
  const idExterno = String(documento.id ?? data.document_id ?? "");
  if (!idExterno) return null;

  const evento = String(payload.event ?? payload.type ?? "").toLowerCase();

  const assinaturasBrutas = Array.isArray(documento.signatures) ? documento.signatures : [];
  const signatariosAtualizados: EventoWebhookAssinatura["signatariosAtualizados"] = [];
  for (const item of assinaturasBrutas) {
    if (typeof item !== "object" || item === null) continue;
    const assinatura = item as Record<string, unknown>;
    const email = typeof assinatura.email === "string" ? assinatura.email : null;
    if (!email) continue;
    if (assinatura.rejected || evento.includes("reject")) {
      signatariosAtualizados.push({ email, status: "recusado" });
    } else if (assinatura.signed || evento.includes("accept") || evento.includes("sign")) {
      signatariosAtualizados.push({ email, status: "assinado" });
    }
  }

  let novoStatusDocumento: EventoWebhookAssinatura["novoStatusDocumento"] = null;
  if (evento.includes("reject") || evento.includes("recus")) {
    novoStatusDocumento = "recusado";
  } else if (evento.includes("finish") || evento.includes("complet") || evento.includes("conclu")) {
    novoStatusDocumento = "assinado";
  }

  return { idExterno, novoStatusDocumento, signatariosAtualizados };
}
