import { describe, expect, it } from "vitest";
import { CATALOGO_VARIAVEIS_CASO, variaveisDaColecao, variaveisRaizDoCatalogo } from "./catalogo-variaveis";
import { montarDadosCondicionaisDaFicha } from "./montar-dados";
import {
  CHAVES_RAIZ_CONTEXTO_CASO,
  montarContextoCaso,
} from "./contexto-caso";

describe("CATALOGO_VARIAVEIS_CASO", () => {
  it("não tem chaves raiz duplicadas entre grupos", () => {
    const raiz = variaveisRaizDoCatalogo();
    expect(new Set(raiz).size).toBe(raiz.length);
  });

  it("cobre todas as chaves raiz produzidas pelo contexto do Caso Inteligente", () => {
    const catalogadas = new Set(variaveisRaizDoCatalogo());
    for (const chave of CHAVES_RAIZ_CONTEXTO_CASO) {
      expect(catalogadas.has(chave)).toBe(true);
    }
  });

  it("documenta as variáveis pré-existentes da ficha/prazos/contratos/parcelas", () => {
    const raiz = new Set(variaveisRaizDoCatalogo());
    for (const chave of ["nome_cliente", "numero_processo", "area_direito", "valor_causa", "data_hoje"]) {
      expect(raiz.has(chave)).toBe(true);
    }
  });

  it("toda variável catalogada tem descrição não vazia (sanidade da UI)", () => {
    for (const grupo of CATALOGO_VARIAVEIS_CASO) {
      expect(grupo.grupo.length).toBeGreaterThan(0);
      for (const variavel of grupo.variaveis) {
        expect(variavel.descricao.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("cobre TODOS os campos gerados pelas coleções antigas (montar-dados)", () => {
    const dados = montarDadosCondicionaisDaFicha({
      nomeClienteFicha: "Cliente",
      nomeClientePorRelacao: null,
      areaDireito: "Cível",
      prazos: [
        { titulo: "Audiência", descricao: "Inicial", data_prazo: "2026-03-10", processo: "0001234-56.2024.8.26.0100", concluido: false },
      ],
      contratos: [{ tipo: "exito", valor_total: 2000, percentual_exito: 30 }],
      parcelas: [{ numero_parcela: 1, valor: 500, vencimento: "2026-02-01", status: "atrasado" }],
    });

    // Cada campo que o motor resolve dentro do loop precisa estar no catálogo
    // (`indice` é injetado pelo motor em qualquer coleção, então é sempre válido).
    const colecoes = ["parcelas", "prazos", "contratos"] as const;
    for (const colecao of colecoes) {
      const catalogadas = new Set(variaveisDaColecao(colecao));
      const itens = dados[colecao] as Record<string, unknown>[];
      for (const item of itens) {
        for (const campo of Object.keys(item)) {
          expect(catalogadas.has(campo), `${colecao}.${campo} ausente no catálogo`).toBe(true);
        }
        expect(catalogadas.has("indice"), `${colecao}.indice ausente no catálogo`).toBe(true);
      }
    }
  });

  it("cobre EXATAMENTE os campos gerados pelas coleções novas do Caso Inteligente", () => {
    const contexto = montarContextoCaso({
      pessoas: [
        { nome: "João Silva", tipo: "parte", documento: "123", contato: "a@b.c", papel_processual: "autor" },
      ],
      eventos: [
        { tipo_evento: "audiencia", descricao: "Inicial", data_evento: "2026-02-01T12:00:00Z", origem: "manual" },
      ],
      teses: [
        { id: "id-1", tese: "Tese principal", fundamentacao: "STF RE 123", status: "adotada" },
      ],
      tarefas: [
        { titulo: "Protocolizar", status: "pendente", prioridade: "alta", prazo_opcional: "2099-01-15" },
      ],
      estrategia: null,
    });

    const colecoes = ["pessoas", "eventos", "teses", "tarefas"] as const;
    for (const colecao of colecoes) {
      const catalogadas = [...variaveisDaColecao(colecao)].sort();
      const geradas = Object.keys(contexto[colecao][0] ?? {}).sort();
      expect(catalogadas.length, `coleção ${colecao} sem campos no catálogo`).toBeGreaterThan(0);
      expect(geradas, `campos gerados divergem do catálogo em ${colecao}`).toEqual(catalogadas);
    }
  });
});
