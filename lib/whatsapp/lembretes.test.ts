import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./enviar", () => ({
  enviarWhatsapp: vi.fn(),
}));

import { enviarWhatsapp } from "./enviar";
import {
  processarLembretesWhatsapp,
  LIMIAR_HORAS_ALERTA_FICHA_URGENTE,
  calcularCorteAlertaUrgenteISO,
  construirMensagemAlertaUrgente,
} from "./lembretes";

const enviarWhatsappMock = enviarWhatsapp as unknown as ReturnType<typeof vi.fn>;

/**
 * Fake mínimo do query builder do Supabase: suporta a cadeia de métodos
 * usada por `lib/whatsapp/lembretes.ts` (select/eq/in/gte/lte/insert) e é
 * "thenable" (resolve como uma Promise), igual ao client real. Cada chamada
 * a `.from(table)` consome a próxima resposta configurada para aquela
 * tabela (fila) — permite simular a MESMA tabela sendo consultada mais de
 * uma vez na mesma execução (ex: `lembretes_whatsapp_enviados`: 1x select de
 * idempotência + 1x insert por candidato).
 */
type RespostaTabela = { data?: unknown[] | null; error?: unknown };

class FakeQueryBuilder implements PromiseLike<RespostaTabela> {
  constructor(private readonly resposta: RespostaTabela) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  in() {
    return this;
  }
  gte() {
    return this;
  }
  lte() {
    return this;
  }
  not() {
    return this;
  }
  insert() {
    return this;
  }
  then<TResult1 = RespostaTabela, TResult2 = never>(
    onfulfilled?: ((value: RespostaTabela) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.resposta.data ?? null, error: this.resposta.error ?? null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function criarSupabaseFake(respostasPorTabela: Record<string, RespostaTabela[]>): SupabaseClient {
  const cursores: Record<string, number> = {};
  const from = vi.fn((tabela: string) => {
    const fila = respostasPorTabela[tabela] ?? [{ data: [], error: null }];
    const indice = Math.min(cursores[tabela] ?? 0, fila.length - 1);
    cursores[tabela] = (cursores[tabela] ?? 0) + 1;
    return new FakeQueryBuilder(fila[indice]!);
  });
  return { from } as unknown as SupabaseClient;
}

beforeEach(() => {
  enviarWhatsappMock.mockReset();
});

describe("calcularCorteAlertaUrgenteISO", () => {
  it("subtrai exatamente o limiar em horas do instante atual", () => {
    const agora = new Date("2026-08-19T15:00:00.000Z");
    const corte = calcularCorteAlertaUrgenteISO(agora, 4);
    expect(corte).toBe("2026-08-19T11:00:00.000Z");
  });
});

describe("construirMensagemAlertaUrgente", () => {
  it("inclui nome do cliente, área e horas sem contato arredondadas para baixo", () => {
    const agora = new Date("2026-08-19T15:00:00.000Z");
    const texto = construirMensagemAlertaUrgente(
      { nomeCliente: "Maria Silva", areaDireito: "Trabalhista", criadoEm: "2026-08-19T09:30:00.000Z" },
      agora,
    );
    expect(texto).toContain("Maria Silva");
    expect(texto).toContain("Trabalhista");
    expect(texto).toContain("5h");
  });

  it("usa rótulos neutros quando cliente/área não informados", () => {
    const agora = new Date("2026-08-19T15:00:00.000Z");
    const texto = construirMensagemAlertaUrgente(
      { nomeCliente: null, areaDireito: null, criadoEm: "2026-08-19T14:00:00.000Z" },
      agora,
    );
    expect(texto).toContain("cliente sem nome informado");
    expect(texto).toContain("área não informada");
  });
});

describe("processarLembretesWhatsapp — alerta de ficha urgente sem contato", () => {
  it("dispara alerta para ficha 'alta' + não lida além do limiar, para o telefone interno do canal", async () => {
    const agora = new Date("2026-08-19T15:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(agora);

    const criadoEmForaDoLimiar = new Date(
      agora.getTime() - (LIMIAR_HORAS_ALERTA_FICHA_URGENTE + 1) * 60 * 60 * 1000,
    ).toISOString();

    enviarWhatsappMock.mockResolvedValue({ enviado: true, mensagemIdExterno: "wamid.123" });

    const supabase = criarSupabaseFake({
      canais_whatsapp_escritorio: [
        // 1ª leitura: buscarEscritoriosComCanalAtivo (só escritorio_id)
        { data: [{ escritorio_id: "esc-1" }], error: null },
        // 2ª leitura: mapa de telefone de alerta interno
        { data: [{ escritorio_id: "esc-1", telefone_alerta_urgencia: "5511999990000" }], error: null },
      ],
      prazos: [{ data: [], error: null }],
      parcelas_honorario: [{ data: [], error: null }],
      fichas_caso: [
        {
          data: [
            {
              id: "ficha-urgente-1",
              escritorio_id: "esc-1",
              nome_cliente: "João Souza",
              area_direito: "Penal",
              criado_em: criadoEmForaDoLimiar,
            },
          ],
          error: null,
        },
      ],
      lembretes_whatsapp_enviados: [
        { data: [], error: null }, // filtrarJaEnviados: nada enviado ainda
        { data: null, error: null }, // insert do log
      ],
    });

    const resumo = await processarLembretesWhatsapp(supabase);

    expect(enviarWhatsappMock).toHaveBeenCalledTimes(1);
    expect(enviarWhatsappMock).toHaveBeenCalledWith(
      expect.objectContaining({
        escritorioId: "esc-1",
        telefoneDestino: "5511999990000",
      }),
    );

    expect(resumo.enviadosAgora).toBe(1);
    expect(resumo.falharam).toBe(0);
    expect(resumo.resultados).toEqual([
      expect.objectContaining({
        tipoReferencia: "ficha_urgente",
        referenciaId: "ficha-urgente-1",
        marco: "sem_resposta",
        enviado: true,
      }),
    ]);

    vi.useRealTimers();
  });

  it("não dispara para escritório sem telefone de alerta interno configurado", async () => {
    const supabase = criarSupabaseFake({
      canais_whatsapp_escritorio: [
        { data: [{ escritorio_id: "esc-2" }], error: null },
        { data: [], error: null }, // nenhum canal com telefone_alerta_urgencia preenchido
      ],
      prazos: [{ data: [], error: null }],
      parcelas_honorario: [{ data: [], error: null }],
      fichas_caso: [{ data: [], error: null }],
      lembretes_whatsapp_enviados: [{ data: [], error: null }],
    });

    const resumo = await processarLembretesWhatsapp(supabase);

    expect(enviarWhatsappMock).not.toHaveBeenCalled();
    expect(resumo.candidatos).toBe(0);
  });

  it("não reenvia alerta 'sem_resposta' já registrado para a mesma ficha (idempotência)", async () => {
    const agora = new Date("2026-08-19T15:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(agora);

    const criadoEmForaDoLimiar = new Date(
      agora.getTime() - (LIMIAR_HORAS_ALERTA_FICHA_URGENTE + 2) * 60 * 60 * 1000,
    ).toISOString();

    const supabase = criarSupabaseFake({
      canais_whatsapp_escritorio: [
        { data: [{ escritorio_id: "esc-3" }], error: null },
        { data: [{ escritorio_id: "esc-3", telefone_alerta_urgencia: "5511988887777" }], error: null },
      ],
      prazos: [{ data: [], error: null }],
      parcelas_honorario: [{ data: [], error: null }],
      fichas_caso: [
        {
          data: [
            {
              id: "ficha-ja-alertada",
              escritorio_id: "esc-3",
              nome_cliente: "Ana",
              area_direito: "Família",
              criado_em: criadoEmForaDoLimiar,
            },
          ],
          error: null,
        },
      ],
      lembretes_whatsapp_enviados: [
        {
          data: [{ tipo_referencia: "ficha_urgente", referencia_id: "ficha-ja-alertada", marco: "sem_resposta" }],
          error: null,
        },
      ],
    });

    const resumo = await processarLembretesWhatsapp(supabase);

    expect(enviarWhatsappMock).not.toHaveBeenCalled();
    expect(resumo.jaEnviadosAntes).toBe(1);
    expect(resumo.enviadosAgora).toBe(0);

    vi.useRealTimers();
  });
});
