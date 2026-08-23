import { NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  MODELO_TRANSCRICAO,
  transcreverAudio,
  validarAudioUpload,
} from "@/lib/ia/audio";
import { mesReferencia, registrarUso } from "@/lib/ia/registro-uso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcrição de ditados curtos: teto generoso para áudios longos em conexão
// lenta, bem abaixo do timeout de funções serverless.
export const maxDuration = 60;

/**
 * Fallback quando o navegador envia o blob SEM type (acontece em alguns
 * Safari/Firefox com MediaRecorder): infere o mimetype pela extensão do
 * nome. Só cobre os containers que o próprio Groq Whisper aceita.
 */
const MIME_POR_EXTENSAO: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  wav: "audio/wav",
  wave: "audio/wav",
  mp4: "audio/mp4",
  m4a: "audio/x-m4a",
  aac: "audio/aac",
  flac: "audio/flac",
};

function inferirMimetype(nomeArquivo: string): string {
  const extensao = nomeArquivo.split(".").pop()?.trim().toLowerCase() ?? "";
  return MIME_POR_EXTENSAO[extensao] ?? "";
}

function respostaJson(status: number, corpo: Record<string, unknown>): Response {
  return Response.json(corpo, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * POST /api/audio/transcrever — recebe multipart/form-data com campo "audio"
 * (gravado no composer do chat) e devolve { texto } para preencher o textarea
 * (HITL: o usuário revisa e envia manualmente — esta rota NUNCA escreve na
 * conversa). Fluxo: auth → validação pura → Groq Whisper (pt) → registro
 * best-effort em uso_ia.
 */
export async function POST(request: NextRequest) {
  // ── Auth obrigatória (mesmo padrão de app/api/chat/mensagem/route.ts) ──
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return respostaJson(401, { error: "Sessão expirada. Faça login novamente." });
  }

  // ── Parse multipart defensivo ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return respostaJson(400, { error: "Requisição inválida: esperado multipart/form-data." });
  }

  const arquivo = formData.get("audio");
  if (!arquivo || typeof arquivo === "string") {
    return respostaJson(400, { error: 'Envie o campo "audio" como arquivo no formulário.' });
  }

  // Browsers entregam File/Blob; quando vier sem type, inferimos pela extensão.
  const mimetypeDeclarado = arquivo.type || inferirMimetype(arquivo.name);

  // ── Validação PURA (testada em lib/ia/audio.test.ts) antes de gastar rede ──
  const validacao = validarAudioUpload({ tamanho: arquivo.size, mimetype: mimetypeDeclarado });
  if (!validacao.ok) {
    return respostaJson(400, { error: validacao.motivo });
  }

  const inicioMs = Date.now();
  try {
    const texto = await transcreverAudio({
      dados: await arquivo.arrayBuffer(),
      nomeArquivo: arquivo.name || "ditado.webm",
      mimetype: mimetypeDeclarado,
    });

    // ── Observabilidade (Fase 27): best-effort, nunca bloqueia a resposta.
    // Usa o helper canônico do repo (lib/ia/registro-uso.ts), que já engole
    // falhas de telemetria com log. tokens 0/0: Whisper cobra por minuto de
    // áudio, não por token. Registrado só em SUCESSO para não consumir quota
    // mensal (uso_ia alimenta a contagem do plano) com tentativas falhas.
    await registrarUso({
      supabase: await createClient(),
      escritorioId: usuario.perfil.escritorio_id,
      tokensIn: 0,
      tokensOut: 0,
      mesRef: mesReferencia(),
      modelo: MODELO_TRANSCRICAO,
      duracaoMs: Date.now() - inicioMs,
      origem: "audio_transcricao",
    });

    return respostaJson(200, { texto });
  } catch (erro) {
    // transcreverAudio lança APENAS mensagens pt-BR prontas para o usuário
    // (contrato documentado no módulo); este catch é a rede de segurança.
    console.error("[api/audio/transcrever] Falha ao transcrever:", erro);
    const mensagem =
      erro instanceof Error && erro.message
        ? erro.message
        : "Não foi possível transcrever o áudio. Tente novamente.";
    return respostaJson(500, { error: mensagem });
  }
}
