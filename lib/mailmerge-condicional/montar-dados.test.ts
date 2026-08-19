import { describe, expect, it } from "vitest";
import { montarDadosCondicionaisDaFicha } from "./montar-dados";

const DATA_REFERENCIA = new Date("2026-08-19T12:00:00-03:00");

describe("montarDadosCondicionaisDaFicha", () => {
  it("usa nome_cliente da ficha quando presente, ignorando o fallback por relação", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: "João Silva",
      nomeClientePorRelacao: "Nome via cliente",
      areaDireito: "Cível",
      prazos: [],
      contratos: [],
      parcelas: [],
      dataReferencia: DATA_REFERENCIA,
    });

    expect(dados.nome_cliente).toBe("João Silva");
    expect(dados.data_hoje).toBe("19/08/2026");
  });

  it("cai para o fallback por relação quando a ficha não tem nome_cliente", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: null,
      nomeClientePorRelacao: "Maria via relação",
      areaDireito: null,
      prazos: [],
      contratos: [],
      parcelas: [],
    });

    expect(dados.nome_cliente).toBe("Maria via relação");
  });

  it("extrai numero_processo do primeiro prazo com processo preenchido", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: "Cliente",
      nomeClientePorRelacao: null,
      areaDireito: null,
      prazos: [
        { titulo: "Prazo sem processo", descricao: null, data_prazo: "2026-01-01", processo: null, concluido: false },
        {
          titulo: "Prazo com processo",
          descricao: null,
          data_prazo: "2026-02-01",
          processo: "0001234-56.2024.8.26.0100",
          concluido: false,
        },
      ],
      contratos: [],
      parcelas: [],
    });

    expect(dados.numero_processo).toBe("0001234-56.2024.8.26.0100");
  });

  it("soma o valor de todos os contratos vinculados para valor_causa", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: "Cliente",
      nomeClientePorRelacao: null,
      areaDireito: null,
      prazos: [],
      contratos: [
        { tipo: "fixo", valor_total: 1000, percentual_exito: null },
        { tipo: "exito", valor_total: 500, percentual_exito: 20 },
      ],
      parcelas: [],
    });

    expect(dados.valor_causa).toMatch(/^R\$\s*1\.500,00$/);
  });

  it("mapeia todas as parcelas (não só a mais recente), derivando 'atrasada' de status/vencimento", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: "Cliente",
      nomeClientePorRelacao: null,
      areaDireito: null,
      prazos: [],
      contratos: [],
      parcelas: [
        { numero_parcela: 1, valor: 500, vencimento: "2020-01-01", status: "pago" },
        { numero_parcela: 2, valor: 500, vencimento: "2020-01-01", status: "atrasado" },
        { numero_parcela: 3, valor: 500, vencimento: "2099-01-01", status: "pendente" },
      ],
    });

    expect(Array.isArray(dados.parcelas)).toBe(true);
    const parcelas = dados.parcelas as Record<string, unknown>[];
    expect(parcelas).toHaveLength(3);
    expect(parcelas[0]?.atrasada).toBe(false); // paga, mesmo com vencimento passado
    expect(parcelas[1]?.atrasada).toBe(true); // status explicitamente atrasado
    expect(parcelas[2]?.atrasada).toBe(false); // pendente mas vencimento futuro
  });

  it("mapeia contratos e prazos preservando os campos usados pelo motor", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: "Cliente",
      nomeClientePorRelacao: null,
      areaDireito: "Trabalhista",
      prazos: [
        { titulo: "Audiência", descricao: "Audiência inicial", data_prazo: "2026-03-10", processo: null, concluido: false },
      ],
      contratos: [{ tipo: "exito", valor_total: 2000, percentual_exito: 30 }],
      parcelas: [],
    });

    const prazos = dados.prazos as Record<string, unknown>[];
    const contratos = dados.contratos as Record<string, unknown>[];
    expect(prazos[0]?.titulo).toBe("Audiência");
    expect(prazos[0]?.data_prazo).toBe("10/03/2026");
    expect(contratos[0]?.percentual_exito).toBe(30);
    expect(contratos[0]?.valor_total).toMatch(/^R\$\s*2\.000,00$/);
  });
});
