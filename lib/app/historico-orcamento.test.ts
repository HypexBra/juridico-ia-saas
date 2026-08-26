import { describe, expect, it } from "vitest";
import { ORCAMENTO_CHARS_HISTORICO, recortarHistoricoPorOrcamento } from "./chat-shared";
import type { ChatTurno } from "@/lib/ia/provider";

function turno(role: ChatTurno["role"], chars: number, marca: string): ChatTurno {
  return { role, conteudo: marca.repeat(chars) };
}

describe("recortarHistoricoPorOrcamento", () => {
  it("devolve tudo quando cabe no orçamento", () => {
    const historico = [turno("user", 100, "a"), turno("assistant", 100, "b")];
    expect(recortarHistoricoPorOrcamento(historico)).toEqual(historico);
  });

  it("descarta os turnos mais ANTIGOS, preservando os recentes", () => {
    const antigo = turno("user", 60, "x");
    const meio = turno("assistant", 60, "y");
    const recente = turno("user", 60, "z");

    const r = recortarHistoricoPorOrcamento([antigo, meio, recente], 130);

    expect(r).toHaveLength(2);
    expect(r[0]).toBe(meio);
    expect(r[1]).toBe(recente);
  });

  it("mantém a ordem cronológica na saída", () => {
    const turnos = [turno("user", 10, "1"), turno("assistant", 10, "2"), turno("user", 10, "3")];
    expect(recortarHistoricoPorOrcamento(turnos, 1000)).toEqual(turnos);
  });

  it("preserva o último turno mesmo que sozinho estoure o orçamento", () => {
    // Perder a troca imediatamente anterior quebra a continuidade da
    // conversa; é o único turno que quase sempre importa.
    const enorme = turno("assistant", 5000, "g");
    const r = recortarHistoricoPorOrcamento([turno("user", 100, "a"), enorme], 200);
    expect(r).toEqual([enorme]);
  });

  it("lista vazia devolve vazio", () => {
    expect(recortarHistoricoPorOrcamento([])).toEqual([]);
  });

  it("o orçamento padrão corta uma conversa longa bem abaixo do pior caso antigo", () => {
    // 19 turnos no teto de MAX_CHARS_TURNO_ANTIGO (900) eram ~17.100 chars
    // reenviados a cada mensagem. O orçamento derruba isso pela metade.
    const longa = Array.from({ length: 19 }, (_, i) => turno(i % 2 === 0 ? "user" : "assistant", 900, "c"));
    const r = recortarHistoricoPorOrcamento(longa);
    const total = r.reduce((soma, t) => soma + t.conteudo.length, 0);

    expect(total).toBeLessThanOrEqual(ORCAMENTO_CHARS_HISTORICO);
    expect(r.length).toBeLessThan(longa.length);
    // E o que sobrou é o FIM da conversa, não o começo.
    expect(r[r.length - 1]).toBe(longa[longa.length - 1]);
  });
});
