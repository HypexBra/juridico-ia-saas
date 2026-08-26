import { describe, expect, it } from "vitest";
import { HORAS_SEM_SUCESSO_PARA_ALERTAR, montarSaudeFonte } from "./execucao";

const AGORA = new Date("2026-08-26T12:00:00.000Z");

function horasAtras(horas: number): string {
  return new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
}

describe("montarSaudeFonte", () => {
  it("não alerta quando houve sucesso dentro da janela", () => {
    const saude = montarSaudeFonte(
      "djen",
      {
        ultimaExecucaoEm: horasAtras(2),
        ultimoSucessoEm: horasAtras(2),
        ultimoStatus: "sucesso",
        ultimaMensagemErro: null,
      },
      AGORA,
    );

    expect(saude.horasSemSucesso).toBeCloseTo(2);
    expect(saude.precisaAlerta).toBe(false);
  });

  it("alerta quando o último sucesso passou do limite", () => {
    const saude = montarSaudeFonte(
      "djen",
      {
        ultimaExecucaoEm: horasAtras(1),
        ultimoSucessoEm: horasAtras(HORAS_SEM_SUCESSO_PARA_ALERTAR + 1),
        ultimoStatus: "erro",
        ultimaMensagemErro: "DJEN indisponível",
      },
      AGORA,
    );

    expect(saude.precisaAlerta).toBe(true);
    expect(saude.ultimaMensagemErro).toBe("DJEN indisponível");
  });

  it("não alerta por uma falha pontual se o último sucesso é recente", () => {
    // Regra central do alerta: ele mede HISTÓRICO, não a execução de agora.
    // Uma fonte que falhou nesta rodada mas rodou bem há 3h não é incidente.
    const saude = montarSaudeFonte(
      "stj_dados_abertos",
      {
        ultimaExecucaoEm: horasAtras(0),
        ultimoSucessoEm: horasAtras(3),
        ultimoStatus: "erro",
        ultimaMensagemErro: "timeout no CKAN",
      },
      AGORA,
    );

    expect(saude.ultimoStatus).toBe("erro");
    expect(saude.precisaAlerta).toBe(false);
  });

  it("alerta quando a fonte nunca teve nenhum sucesso registrado", () => {
    // Cobre a fonte cujo cron nunca disparou: sem esta regra ela sairia do
    // relatório como se estivesse saudável.
    const saude = montarSaudeFonte(
      "legislacao",
      { ultimaExecucaoEm: null, ultimoSucessoEm: null, ultimoStatus: null, ultimaMensagemErro: null },
      AGORA,
    );

    expect(saude.horasSemSucesso).toBeNull();
    expect(saude.precisaAlerta).toBe(true);
  });

  it("trata sucesso_parcial como pipeline vivo", () => {
    const saude = montarSaudeFonte(
      "djen",
      {
        ultimaExecucaoEm: horasAtras(1),
        ultimoSucessoEm: horasAtras(1),
        ultimoStatus: "sucesso_parcial",
        ultimaMensagemErro: "3 OABs falharam",
      },
      AGORA,
    );

    expect(saude.precisaAlerta).toBe(false);
  });

  it("está exatamente no limite sem alertar (fronteira estrita)", () => {
    const saude = montarSaudeFonte(
      "djen",
      {
        ultimaExecucaoEm: horasAtras(HORAS_SEM_SUCESSO_PARA_ALERTAR),
        ultimoSucessoEm: horasAtras(HORAS_SEM_SUCESSO_PARA_ALERTAR),
        ultimoStatus: "sucesso",
        ultimaMensagemErro: null,
      },
      AGORA,
    );

    expect(saude.precisaAlerta).toBe(false);
  });
});
