import { describe, it, expect } from "vitest";
import { classificarSinais, type RadarSinais } from "./radar";

function sinaisBase(parcial: Partial<RadarSinais> = {}): RadarSinais {
  return {
    prazosVencidos: [],
    prazosHoje: [],
    prazos3Dias: [],
    tarefasAtrasadas: [],
    fichasNaoLidas: 0,
    mensagensPortalNaoLidas: 0,
    casosSemAtividadeDias: 0,
    propostasPendentes: 0,
    parcelasVencidas: [],
    coletadoEm: "2026-08-22T12:00:00.000Z",
    ...parcial,
  };
}

describe("classificarSinais", () => {
  it("sem sinais devolve lista vazia (nunca inventa alerta)", () => {
    expect(classificarSinais(sinaisBase())).toEqual([]);
  });

  it("prioriza prazo vencido acima de tudo", () => {
    const sinais = classificarSinais(
      sinaisBase({
        prazosVencidos: [{ id: "1", titulo: "Contestação", dataPrazo: "2026-08-20", clienteNome: "João" }],
        fichasNaoLidas: 5,
        parcelasVencidas: [{ id: "2", vencimento: "2026-08-01", valor: 1500 }],
      }),
    );
    expect(sinais[0].codigo).toBe("prazo_vencido");
    expect(sinais[0].severidade).toBe("alta");
  });

  it("ordena alta > media > baixa", () => {
    const ordem = classificarSinais(
      sinaisBase({
        propostasPendentes: 2,
        fichasNaoLidas: 3,
        prazosHoje: [{ id: "9", titulo: "Manifestação", clienteNome: null }],
      }),
    ).map((s) => s.codigo);
    expect(ordem.indexOf("prazo_hoje")).toBeLessThan(ordem.indexOf("ficha_nao_lida"));
    expect(ordem.indexOf("ficha_nao_lida")).toBeLessThan(ordem.indexOf("proposta_pendente"));
  });

  it("caso sem atividade só aparece com >= 30 dias e é severidade baixa", () => {
    const abaixo = classificarSinais(sinaisBase({ casosSemAtividadeDias: 29 }));
    expect(abaixo).toHaveLength(0);
    const noLimite = classificarSinais(sinaisBase({ casosSemAtividadeDias: 30 }));
    expect(noLimite.map((s) => s.codigo)).toContain("caso_sem_atividade");
    expect(noLimite.find((s) => s.codigo === "caso_sem_atividade")?.severidade).toBe("baixa");
  });

  it("alerta de parcela vencida soma valores em BRL", () => {
    const sinais = classificarSinais(
      sinaisBase({
        parcelasVencidas: [
          { id: "a", vencimento: "2026-08-01", valor: 1000 },
          { id: "b", vencimento: "2026-08-05", valor: 500 },
        ],
      }),
    );
    const alerta = sinais.find((s) => s.codigo === "parcela_vencida");
    expect(alerta?.detalhe).toContain("R$");
    expect(alerta?.detalhe).toContain("1.500,00");
  });

  it("todo sinal tem href para ação imediata", () => {
    const sinais = classificarSinais(
      sinaisBase({ prazos3Dias: [{ id: "x", titulo: "Audiência", dataPrazo: "2026-08-24", clienteNome: null }] }),
    );
    for (const sinal of sinais) {
      expect(sinal.href).toMatch(/^\/app\//);
    }
  });
});
