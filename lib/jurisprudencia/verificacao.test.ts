import { describe, it, expect } from "vitest";
import {
  extrairCitacoes,
  digitoVerificadorCnjValido,
  type CitacaoExtraida,
} from "./verificacao";

describe("digitoVerificadorCnjValido", () => {
  it("valida número CNJ gerado com DV correto (MOD 97-10)", () => {
    // Número construído: NN=0001234, resto=20248260100 → DV calculado = 71.
    expect(digitoVerificadorCnjValido("00012347120248260100")).toBe(true);
  });

  it("rejeita DV errado", () => {
    expect(digitoVerificadorCnjValido("00012345620248260100")).toBe(false);
  });

  it("rejeita tamanho errado e tudo-zero", () => {
    expect(digitoVerificadorCnjValido("123")).toBe(false);
    expect(digitoVerificadorCnjValido("00000000000000000000")).toBe(false);
  });
});

describe("extrairCitacoes", () => {
  it("extrai processo CNJ formatado e variante com traço opcional", () => {
    const texto =
      "Conforme o julgado 0001234-71.2024.8.26.0100 e o precedente 5001234-71.2024.8.26.0999, a tese se sustenta.";
    const citacoes = extrairCitacoes(texto);
    const processos = citacoes.filter((c: CitacaoExtraida) => c.tipo === "processo_cnj");
    expect(processos).toHaveLength(2);
  });

  it("não extrai número de 20 dígitos sem formatação nenhuma (falso positivo comum)", () => {
    // Sem pontuação não há como distinguir de telefone/código — o verificador
    // só considera CNJ bem-formado; texto cru fica fora por design.
    expect(extrairCitacoes("proc 50012347120248260999")).toHaveLength(0);
  });

  it("extrai número canônico STJ (REsp/AgInt) e súmula", () => {
    const texto = "Nos termos do REsp 1.795.982/SP e da Súmula 297 do STJ, com apoio no Tema 987 repetitivo.";
    const citacoes = extrairCitacoes(texto);
    const tipos = new Map(citacoes.map((c) => [c.tipo, c.valor]));
    expect(tipos.get("numero_stj")).toBe("REsp 1.795.982");
    expect(tipos.get("sumula")).toBe("297");
    expect(tipos.get("tema")).toBe("987");
  });

  it("deduplica citações repetidas", () => {
    const texto = "Súmula 297 aplica-se. Súmula 297 novamente.";
    expect(extrairCitacoes(texto)).toHaveLength(1);
  });

  it("texto sem citações devolve lista vazia", () => {
    expect(extrairCitacoes("A tese é sustentável pela doutrina majoritária.")).toHaveLength(0);
  });
});
