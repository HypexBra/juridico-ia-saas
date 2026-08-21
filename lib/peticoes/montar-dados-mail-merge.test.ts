import { describe, expect, it } from "vitest";
import { montarDadosMailMergeDaFicha } from "./montar-dados-mail-merge";

describe("montarDadosMailMergeDaFicha", () => {
  it("usa nome_cliente da própria ficha quando presente, ignorando o fallback por relação", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: "Maria Souza",
      nomeClientePorRelacao: "Nome Errado Da Relação",
      areaDireito: "Trabalhista",
      numeroProcessoCnj: null,
      valorCausaTotal: null,
    });

    expect(dados.nome_cliente).toBe("Maria Souza");
  });

  it("usa o nome do cliente vinculado (clientes.nome) quando a ficha não tem nome_cliente direto", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: null,
      nomeClientePorRelacao: "João Pereira",
      areaDireito: null,
      numeroProcessoCnj: null,
      valorCausaTotal: null,
    });

    expect(dados.nome_cliente).toBe("João Pereira");
  });

  it("fica null quando nem a ficha nem a relação têm nome de cliente", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: null,
      nomeClientePorRelacao: null,
      areaDireito: null,
      numeroProcessoCnj: null,
      valorCausaTotal: null,
    });

    expect(dados.nome_cliente).toBeNull();
  });

  it("repassa area_direito e numero_processo_cnj tal como recebidos", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: "Cliente X",
      nomeClientePorRelacao: null,
      areaDireito: "Cível",
      numeroProcessoCnj: "0001234-56.2026.8.26.0100",
      valorCausaTotal: null,
    });

    expect(dados.area_direito).toBe("Cível");
    expect(dados.numero_processo).toBe("0001234-56.2026.8.26.0100");
  });

  it("formata valor_causa em moeda BRL a partir do número puro do contrato", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: "Cliente X",
      nomeClientePorRelacao: null,
      areaDireito: null,
      numeroProcessoCnj: null,
      valorCausaTotal: 15000,
    });

    // Delega no mesmo `toLocaleString("pt-BR", { style: "currency", ... })` de
    // `formatarValorCausaMailMerge` — comparar contra ele evita hardcodar o
    // caractere de espaço específico da localidade (nbsp vs espaço comum),
    // que varia entre versões do Node/ICU.
    expect(dados.valor_causa).toBe((15000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  });

  it("valor_causa fica null quando não há contrato de honorário vinculado", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: "Cliente X",
      nomeClientePorRelacao: null,
      areaDireito: null,
      numeroProcessoCnj: null,
      valorCausaTotal: null,
    });

    expect(dados.valor_causa).toBeNull();
  });

  it("usa a data de referência informada para data_hoje (determinístico em teste)", () => {
    const dados = montarDadosMailMergeDaFicha({
      nomeClienteFicha: null,
      nomeClientePorRelacao: null,
      areaDireito: null,
      numeroProcessoCnj: null,
      valorCausaTotal: null,
      dataReferencia: new Date("2026-08-19T12:00:00Z"),
    });

    expect(dados.data_hoje).toBe("19/08/2026");
  });
});
