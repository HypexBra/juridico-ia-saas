import { describe, expect, it } from "vitest";
import { parsearPaginacao } from "./paginacao";

function paramsDe(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parsearPaginacao", () => {
  it("usa limit=20 e offset=0 por padrão quando nada é informado", () => {
    expect(parsearPaginacao(paramsDe(""))).toEqual({ limit: 20, offset: 0 });
  });

  it("respeita limit e offset válidos informados", () => {
    expect(parsearPaginacao(paramsDe("limit=5&offset=10"))).toEqual({ limit: 5, offset: 10 });
  });

  it("trava limit em 100 mesmo se o cliente pedir mais", () => {
    expect(parsearPaginacao(paramsDe("limit=99999"))).toEqual({ limit: 100, offset: 0 });
  });

  it("nunca deixa limit menor que 1", () => {
    expect(parsearPaginacao(paramsDe("limit=0"))).toEqual({ limit: 1, offset: 0 });
    expect(parsearPaginacao(paramsDe("limit=-5"))).toEqual({ limit: 1, offset: 0 });
  });

  it("nunca deixa offset negativo", () => {
    expect(parsearPaginacao(paramsDe("offset=-10"))).toEqual({ limit: 20, offset: 0 });
  });

  it("cai no padrão para valores não numéricos", () => {
    expect(parsearPaginacao(paramsDe("limit=abc&offset=xyz"))).toEqual({ limit: 20, offset: 0 });
  });
});
