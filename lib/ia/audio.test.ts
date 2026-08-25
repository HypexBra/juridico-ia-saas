import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock do SDK ANTES do import do módulo (padrão do repo, ver
// chamada-estruturada.test.ts): nenhum teste deste arquivo toca rede.
const { transcriptionsCreateMock, groqConstructorMock } = vi.hoisted(() => ({
  transcriptionsCreateMock: vi.fn(),
  groqConstructorMock: vi.fn(),
}));

vi.mock("groq-sdk", () => ({
  default: class GroqFalso {
    audio = { transcriptions: { create: transcriptionsCreateMock } };
    constructor(config: unknown) {
      groqConstructorMock(config);
    }
  },
}));

const {
  TAMANHO_MAX_AUDIO_BYTES,
  MODELO_TRANSCRICAO,
  MENSAGEM_CHAVE_AUSENTE,
  validarAudioUpload,
  transcreverAudio,
} = await import("./audio");

const CHAVE_ORIGINAL = process.env.GROQ_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GROQ_API_KEY = "chave-de-teste";
});

afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = CHAVE_ORIGINAL;
  vi.restoreAllMocks();
});

describe("validarAudioUpload", () => {
  it.each([
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
    "audio/mpeg",
    "audio/wav",
    "audio/x-m4a",
  ])("aceita mimetype de áudio suportado (%s)", (mimetype) => {
    expect(validarAudioUpload({ tamanho: 1024, mimetype })).toEqual({ ok: true });
  });

  it("aceita mimetype com parâmetros de codec e caixa alta (MediaRecorder real: 'audio/webm;codecs=opus')", () => {
    expect(validarAudioUpload({ tamanho: 2048, mimetype: "AUDIO/WebM;codecs=opus" })).toEqual({
      ok: true,
    });
  });

  it("recusa vídeo explicitamente ('video/webm' NÃO é aceito)", () => {
    const resultado = validarAudioUpload({ tamanho: 1024, mimetype: "video/webm" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toMatch(/ÁUDIO/i);
  });

  it.each(["application/pdf", "text/plain", "image/png"])(
    "recusa mimetype fora de audio/* (%s)",
    (mimetype) => {
      expect(validarAudioUpload({ tamanho: 1024, mimetype }).ok).toBe(false);
    },
  );

  it("recusa mimetype vazio ou só espaços", () => {
    expect(validarAudioUpload({ tamanho: 1024, mimetype: "" }).ok).toBe(false);
    expect(validarAudioUpload({ tamanho: 1024, mimetype: "   " }).ok).toBe(false);
    // String estranha que viraria undefined em runtime JS solto:
    expect(
      validarAudioUpload({ tamanho: 1024, mimetype: undefined as unknown as string }).ok,
    ).toBe(false);
  });

  it.each([0, -1, Number.NaN])("recusa tamanho inválido (%p)", (tamanho) => {
    const resultado = validarAudioUpload({ tamanho, mimetype: "audio/webm" });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toMatch(/vazio|corrompido/i);
  });

  it(`aceita exatamente no limite (${TAMANHO_MAX_AUDIO_BYTES} bytes = 20 MB)`, () => {
    expect(
      validarAudioUpload({ tamanho: TAMANHO_MAX_AUDIO_BYTES, mimetype: "audio/webm" }),
    ).toEqual({ ok: true });
  });

  it("recusa 1 byte acima do limite, citando o teto de 20 MB", () => {
    const resultado = validarAudioUpload({
      tamanho: TAMANHO_MAX_AUDIO_BYTES + 1,
      mimetype: "audio/webm",
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toContain("20 MB");
  });

  it("exporta o teto correto de 20 MB", () => {
    expect(TAMANHO_MAX_AUDIO_BYTES).toBe(20 * 1024 * 1024);
  });

  it("exporta o modelo Whisper turbo da Fase 15", () => {
    expect(MODELO_TRANSCRICAO).toBe("whisper-large-v3-turbo");
  });
});

describe("transcreverAudio", () => {
  const ENTRADA_BASE = {
    dados: new ArrayBuffer(16),
    nomeArquivo: "ditado.webm",
    mimetype: "audio/webm",
  };

  function mockResposta(texto: string) {
    transcriptionsCreateMock.mockResolvedValueOnce({ text: texto });
  }

  it("sem GROQ_API_KEY lança a mensagem canônica e NÃO chega a chamar o provider", async () => {
    delete process.env.GROQ_API_KEY;

    await expect(transcreverAudio(ENTRADA_BASE)).rejects.toThrow(MENSAGEM_CHAVE_AUSENTE);
    expect(transcriptionsCreateMock).not.toHaveBeenCalled();
  });

  it("instancia o client localmente com a chave da env var e pede pt + json", async () => {
    mockResposta("Peça de contestação pronta.");

    const texto = await transcreverAudio(ENTRADA_BASE);

    expect(texto).toBe("Peça de contestação pronta.");
    expect(groqConstructorMock).toHaveBeenCalledWith({ apiKey: "chave-de-teste" });
    expect(transcriptionsCreateMock).toHaveBeenCalledTimes(1);

    const corpo = transcriptionsCreateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(corpo.model).toBe("whisper-large-v3-turbo");
    expect(corpo.language).toBe("pt");
    expect(corpo.response_format).toBe("json");
    const arquivo = corpo.file as File;
    expect(arquivo.name).toBe("ditado.webm");
    expect(arquivo.type).toBe("audio/webm");
  });

  it("normaliza o mimetype antes de enviar (remove parâmetros de codec)", async () => {
    mockResposta("ok");
    await transcreverAudio({ ...ENTRADA_BASE, mimetype: "audio/webm;codecs=opus" });

    const corpo = transcriptionsCreateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect((corpo.file as File).type).toBe("audio/webm");
  });

  it("aceita Buffer Node como entrada (rota pode receber buffer)", async () => {
    mockResposta("texto");
    const buffer = Buffer.from([1, 2, 3, 4]);

    await expect(transcreverAudio({ ...ENTRADA_BASE, dados: buffer })).resolves.toBe("texto");
  });

  it("transcrição vazia (silêncio) lança orientação específica de repetir a gravação", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockResposta("   ");

    await expect(transcreverAudio(ENTRADA_BASE)).rejects.toThrow(/identificar fala/i);
  });

  it("erro 429 do provider vira mensagem de limite temporário em pt-BR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    transcriptionsCreateMock.mockRejectedValueOnce(new Error("429 rate limit exceeded"));

    await expect(transcreverAudio(ENTRADA_BASE)).rejects.toThrow(
      /limite do provedor de voz/i,
    );
  });

  it("erro 401 do provider vira mensagem de chave inválida em pt-BR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    transcriptionsCreateMock.mockRejectedValueOnce(new Error("401 invalid_api_key"));

    await expect(transcreverAudio(ENTRADA_BASE)).rejects.toThrow(/chave inválida/i);
  });

  it("falha genérica do provider vira mensagem limpa sem vazar o texto original em inglês", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    transcriptionsCreateMock.mockRejectedValueOnce(new Error("internal upstream explosion"));

    await expect(transcreverAudio(ENTRADA_BASE)).rejects.toThrow(
      /^Falha ao transcrever o áudio\. Tente novamente em instantes\.$/,
    );
  });

  it("erro não-Error (string lançada pelo provider) também é classificado sem quebrar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    transcriptionsCreateMock.mockRejectedValueOnce("500 boom");

    await expect(transcreverAudio(ENTRADA_BASE)).rejects.toThrow(/Falha ao transcrever/i);
  });
});
