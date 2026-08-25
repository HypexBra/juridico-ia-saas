import "server-only";

import Groq from "groq-sdk";

/**
 * Transcrição de áudio (ditado por voz) do chat interno via Groq Whisper.
 *
 * Fase 15 do roadmap. Este módulo é DELEGAÇÃO DIRETA ao Groq com a env var
 * fixa GROQ_API_KEY: NÃO usa o pool de chaves de `lib/ia/chaves/pool.ts`
 * (posse da frente de LLM) nem `lib/ia/groq.ts`. Quando o pool passar a
 * suportar transcrição, este módulo é o ponto único de troca.
 *
 * Fluxo HITL (human-in-the-loop): o áudio gravado no composer vira TEXTO
 * preenchido no textarea para revisão manual — nunca é enviado sozinho.
 */

/** Teto de upload aceito pela rota /api/audio/transcrever (20 MB). */
export const TAMANHO_MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/**
 * Modelo de transcrição do Groq ("Whisper large-v3-turbo"): a melhor relação
 * custo/latência do catálogo de speech-to-text deles, com suporte explícito
 * a pt (ISO-639-1).
 */
export const MODELO_TRANSCRICAO = "whisper-large-v3-turbo";

/** Mensagem canônica para chave ausente — testada em audio.test.ts. */
export const MENSAGEM_CHAVE_AUSENTE =
  "Transcrição indisponível: chave de voz não configurada.";

export type ResultadoValidacaoAudio = { ok: true } | { ok: false; motivo: string };

/**
 * Normaliza um mimetype de multipart/FormData: minúsculas e sem parâmetros
 * ("AUDIO/Webm;codecs=opus" → "audio/webm"). Defensivo na fronteira: valor
 * não-string (FormData malformado) vira string vazia, nunca TypeError.
 */
function normalizarMimetype(mimetype: string): string {
  if (typeof mimetype !== "string") return "";
  return mimetype.split(";")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Validação PURA (sem I/O, 100% coberta por testes) do upload de áudio antes
 * de gastar rede/dinheiro com o provedor. Regras:
 *   - tamanho > 0 e <= TAMANHO_MAX_AUDIO_BYTES;
 *   - mimetype precisa ser de ÁUDIO ("audio/*") — vídeo é recusado de propósito:
 *     MediaRecorder no navegador produz audio/webm|mp4|ogg, e aceitar "video/webm"
 *     abriria porta para uploads que o Whisper rejeita depois mesmo.
 */
export function validarAudioUpload(entrada: { tamanho: number; mimetype: string }): ResultadoValidacaoAudio {
  if (!Number.isFinite(entrada.tamanho) || entrada.tamanho <= 0) {
    return { ok: false, motivo: "O arquivo de áudio está vazio ou corrompido." };
  }
  if (entrada.tamanho > TAMANHO_MAX_AUDIO_BYTES) {
    return {
      ok: false,
      motivo: `Áudio muito grande (${(entrada.tamanho / (1024 * 1024)).toFixed(1)} MB). O limite é ${TAMANHO_MAX_AUDIO_BYTES / (1024 * 1024)} MB.`,
    };
  }

  const mimetypeNormalizado = normalizarMimetype(entrada.mimetype);
  if (!mimetypeNormalizado) {
    return { ok: false, motivo: "Formato de áudio não identificado. Tente gravar novamente." };
  }
  if (!mimetypeNormalizado.startsWith("audio/")) {
    return {
      ok: false,
      motivo: "Formato não suportado: envie um arquivo de ÁUDIO (webm, mp4/m4a, ogg, mp3 ou wav).",
    };
  }
  return { ok: true };
}

/**
 * Converte o corpo recebido na rota (ArrayBuffer de `file.arrayBuffer()` ou
 * Buffer Node) em bytes próprios para o construtor de File. A CÓPIA é
 * intencional: um Buffer pode ser uma fatia de pool interno (byteOffset > 0)
 * e o BlobPart do File exige ArrayBuffer estrito — passar a view original
 * vaza memória compartilhada e não compila sob strict.
 */
function paraBytes(dados: ArrayBuffer | Buffer): Uint8Array<ArrayBuffer> {
  if (dados instanceof ArrayBuffer) return new Uint8Array(dados);
  return Uint8Array.from(dados);
}

/**
 * Classifica falhas do provider em mensagens pt-BR seguras para exibir ao
 * usuário (nunca vaza stack trace/texto em inglês do SDK). Erros 4xx/5xx do
 * Groq chegam como APIError cujo `message` inclui o status HTTP — mesma
 * heurística de regex já usada em lib/ia/groq.ts#isErroDeQuotaGroq.
 */
function mensagemDeFalhaProvider(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro);
  if (/401|403|unauthorized|invalid[_ ]api[_ ]key|permission/i.test(texto)) {
    return "Transcrição recusada pelo provedor de voz: chave inválida ou sem permissão.";
  }
  if (/429|rate.?limit|quota/i.test(texto)) {
    return "Transcrição temporariamente indisponível (limite do provedor de voz). Tente novamente em instantes.";
  }
  if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed|network/i.test(texto)) {
    return "Não foi possível conectar ao serviço de voz. Verifique sua conexão e tente novamente.";
  }
  return "Falha ao transcrever o áudio. Tente novamente em instantes.";
}

export interface EntradaTranscricao {
  /** Conteúdo bruto do arquivo (ArrayBuffer do File/Blob ou Buffer Node). */
  dados: ArrayBuffer | Buffer;
  /** Nome com extensão — o provider infere o container por ela (ex.: "ditado.webm"). */
  nomeArquivo: string;
  /** Mimetype declarado pelo cliente (já validado por validarAudioUpload). */
  mimetype: string;
}

/**
 * Transcreve um áudio curto (ditado do chat) para TEXTO em português usando
 * o Groq Whisper. Instancia o client LOCALMENTE com GROQ_API_KEY — sem tocar
 * no pool de chaves de lib/ia/groq.ts (fronteira de posse entre frentes).
 *
 * Contrato de erros (sempre Error com mensagem pt-BR pronta pro usuário):
 *   - GROQ_API_KEY ausente → "Transcrição indisponível: chave de voz não configurada."
 *   - provider fora/quota/chave inválida → mensagens classificadas acima.
 *   - transcrição vazia (silêncio/ruído) → orienta repetir a gravação.
 */
export async function transcreverAudio(entrada: EntradaTranscricao): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(MENSAGEM_CHAVE_AUSENTE);
  }

  // Client criado por chamada (não singleton): transcrição de ditado é
  // esporádica e o custo de handshake é irrelevante perto do upload do áudio.
  const cliente = new Groq({ apiKey });

  const arquivoUpload = new File([paraBytes(entrada.dados)], entrada.nomeArquivo, {
    type: normalizarMimetype(entrada.mimetype),
  });

  let texto = "";
  try {
    const resposta = await cliente.audio.transcriptions.create({
      file: arquivoUpload,
      model: MODELO_TRANSCRICAO,
      language: "pt",
      response_format: "json",
    });
    texto = typeof resposta.text === "string" ? resposta.text.trim() : "";
  } catch (erro) {
    console.error("[ia/audio] Falha na transcrição via Groq:", erro);
    // Re-classifica falhas do provider (SDK/status HTTP em inglês) em
    // mensagem pt-BR segura para exibir ao usuário.
    throw new Error(mensagemDeFalhaProvider(erro));
  }

  // Fora do catch de propósito: este erro NÃO é do provider e não pode ser
  // re-classificado — precisa chegar ao usuário com a orientação específica.
  if (!texto) {
    throw new Error(
      "Não conseguimos identificar fala no áudio. Fale um pouco mais perto do microfone e grave novamente.",
    );
  }
  return texto;
}
