"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResultadoBuscaCommand } from "@/app/app/command-center/actions";

/**
 * COMMAND CENTER — CTRL/CMD+K (Fase 26 + orquestração leve Fase 18).
 *
 * Quatro camadas, da mais rápida para a mais cara:
 *   1. COMANDOS estáticos: navegação instantânea (zero rede) para todas as
 *      seções + atalhos de criação.
 *   2. BUSCA server-side: casos e prazos por termo (debounce 250ms).
 *   3. LINGUAGEM NATURAL heurística: frases do tipo "prazos essa semana" /
 *      "tarefas atrasadas" / "financeiro" roteiam direto pra tela certa
 *      sem LLM (latência zero, custo zero) — o chat IA continua sendo a
 *      porta para pedidos complexos.
 *   4. SUGESTÃO por intenção (Fase 18): se a busca NÃO encontrou nada, o
 *      servidor classifica o pedido (heurística pura, custo zero) e devolve
 *      uma sugestão de ferramenta — exibida como item comum do palette.
 */

type Comando = {
  id: string;
  rotulo: string;
  descricao?: string;
  href: string;
  grupo: string;
};

const COMANDOS: Comando[] = [
  { id: "dashboard", rotulo: "Ir para Dashboard", href: "/app/dashboard", grupo: "Navegação" },
  { id: "chat", rotulo: "Abrir Chat IA", href: "/app/chat", grupo: "Navegação", descricao: "Copiloto jurídico com RAG" },
  { id: "fichas", rotulo: "Ver Fichas / Casos", href: "/app/fichas", grupo: "Navegação" },
  { id: "prazos", rotulo: "Ver Prazos", href: "/app/prazos", grupo: "Navegação" },
  { id: "calculadoras", rotulo: "Abrir Calculadoras", href: "/app/calculadoras", grupo: "Navegação", descricao: "Juros, art. 85, prazos, prescrição" },
  { id: "pesquisa", rotulo: "Pesquisa Jurídica", href: "/app/pesquisa", grupo: "Navegação", descricao: "Jurisprudência verificável STJ" },
  { id: "documentos", rotulo: "Document Intelligence", href: "/app/documentos", grupo: "Análises IA" },
  { id: "auditor", rotulo: "Auditar peça", href: "/app/auditor", grupo: "Análises IA" },
  { id: "contra", rotulo: "Testar tese (Advogado do Contra)", href: "/app/advogado-contra/novo", grupo: "Análises IA" },
  { id: "redline", rotulo: "Analisar risco contratual (Redline)", href: "/app/redline", grupo: "Análises IA" },
  { id: "modelos", rotulo: "Modelos de documentos", href: "/app/modelos", grupo: "Gestão" },
  { id: "workflows", rotulo: "Workflows / automação de rotinas", href: "/app/workflows", grupo: "Gestão", descricao: "Cadeia de etapas por caso, com aprovação humana" },
  { id: "financeiro", rotulo: "Financeiro / honorários", href: "/app/financeiro", grupo: "Gestão" },
  { id: "relatorios", rotulo: "Relatórios", href: "/app/relatorios", grupo: "Gestão" },
  { id: "equipe", rotulo: "Equipe", href: "/app/equipe", grupo: "Gestão" },
];

/** Roteamento heurístico pt-BR — cobre as perguntas mais frequentes sem IA. */
function rotearLinguagemNatural(termo: string): string | null {
  const t = termo.toLowerCase();
  if (/(prazo|vencimento).*(semana|pr[óo]ximo)|prazos? (essa|esta|da) semana/.test(t)) return "/app/prazos";
  if (/tarefa/.test(t)) return "/app/dashboard";
  if (/(financeiro|honor[aá]rio|parcela|receb)/.test(t)) return "/app/financeiro";
  if (/(jurisprud[eê]ncia|stj|precedente|pesquisar direito)/.test(t)) return "/app/pesquisa";
  if (/(calcular|c[aá]lculo|juros|prescri|sucumb)/.test(t)) return "/app/calculadoras";
  if (/(auditar|auditoria).*(pe[cç]a|petição)|auditor/.test(t)) return "/app/auditor";
  if (/contra|tese advers/.test(t)) return "/app/advogado-contra/novo";
  if (/(documento|intelig[eê]ncia).*(analis)|analisar documento/.test(t)) return "/app/documentos";
  if (/caso[s]?|ficha[s]?|cliente[s]?/.test(t)) return "/app/fichas";
  return null;
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function CommandCenter() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState<ResultadoBuscaCommand | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerBusca = useRef<ReturnType<typeof setTimeout> | null>(null);

  function alternar() {
    // Reset no momento da ABERTURA (evento do usuário), não em effect —
    // evita render em cascata e garante foco no frame certo.
    setAberto((prev) => {
      const proximo = !prev;
      if (proximo) {
        setTermo("");
        setBusca(null);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return proximo;
    });
  }

  // Busca incremental com debounce. O reset de `busca` quando o termo fica
  // curto é DERIVADO na renderização (buscaVisivel), nunca setState em effect.
  useEffect(() => {
    if (!aberto || termo.trim().length < 2) return;
    if (timerBusca.current) clearTimeout(timerBusca.current);
    timerBusca.current = setTimeout(() => {
      startTransition(async () => {
        const { buscarNoCommandCenterAction } = await import("@/app/app/command-center/actions");
        const resposta = await buscarNoCommandCenterAction({ termo });
        setBusca(resposta.ok ? resposta.resultados : null);
      });
    }, 250);
    return () => {
      if (timerBusca.current) clearTimeout(timerBusca.current);
    };
  }, [termo, aberto]);

  const buscaVisivel = termo.trim().length >= 2 ? busca : null;
  const sugestaoVisivel = buscaVisivel?.sugestao ?? null;

  const comandoNatural = useMemo(() => (termo.trim().length >= 3 ? rotearLinguagemNatural(termo) : null), [termo]);

  const comandosFiltrados = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return COMANDOS;
    return COMANDOS.filter((c) => c.rotulo.toLowerCase().includes(t) || c.grupo.toLowerCase().includes(t));
  }, [termo]);

  useEffect(() => {
    function onKeyDown(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        alternar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);


  function ir(href: string) {
    setAberto(false);
    router.push(href);
  }

  function aoDigitarEnter() {
    if (comandoNatural) {
      ir(comandoNatural);
      return;
    }
    const primeiraFicha = buscaVisivel?.fichas[0];
    if (primeiraFicha) {
      ir(`/app/fichas/${primeiraFicha.id}`);
      return;
    }
    // Sugestão por intenção (só existe quando a busca veio vazia).
    const sugestao = buscaVisivel?.sugestao;
    if (sugestao) {
      ir(sugestao.href);
      return;
    }
    const primeiroComando = comandosFiltrados[0];
    if (primeiroComando) ir(primeiroComando.href);
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setAberto(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Center"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-[0_16px_48px_-8px_rgba(20,20,18,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAberto(false);
            if (e.key === "Enter") aoDigitarEnter();
          }}
          placeholder="Buscar caso, prazo ou digite um pedido… (ESC fecha)"
          className="w-full border-b border-ink/10 bg-transparent px-4 py-3.5 text-sm text-ice placeholder:text-muted outline-none"
        />

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {comandoNatural ? (
            <button
              type="button"
              onClick={() => ir(comandoNatural)}
              className="flex w-full items-center justify-between rounded-lg bg-silver/15 px-3 py-2.5 text-left text-sm text-ice hover:bg-silver/25"
            >
              <span>Entendi: abrir tela correspondente</span>
              <kbd className="rounded border border-ink/15 px-1.5 text-[10px] text-muted">ENTER</kbd>
            </button>
          ) : null}

          {buscaVisivel?.fichas.length ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Casos / clientes</p>
              {buscaVisivel.fichas.map((ficha) => (
                <button
                  key={ficha.id}
                  type="button"
                  onClick={() => ir(`/app/fichas/${ficha.id}`)}
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-ink/5"
                >
                  <p className="text-sm text-ice">{ficha.nomeCliente ?? "(sem nome)"}</p>
                  <p className="text-xs text-muted">{ficha.areaDireito ?? "Área não informada"} · ver ficha completa →</p>
                </button>
              ))}
            </>
          ) : null}

          {buscaVisivel?.prazos.length ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Prazos</p>
              {buscaVisivel.prazos.map((prazo) => (
                <button
                  key={prazo.id}
                  type="button"
                  onClick={() => ir("/app/prazos")}
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-ink/5"
                >
                  <p className="text-sm text-ice">{prazo.titulo}</p>
                  <p className="text-xs text-muted">
                    Vence em {dataBr(prazo.dataPrazo)}
                    {prazo.clienteNome ? ` · ${prazo.clienteNome}` : ""}
                  </p>
                </button>
              ))}
            </>
          ) : null}

          {isPending && !busca ? (
            <p className="px-3 py-2 text-xs text-muted">Buscando…</p>
          ) : null}

          {sugestaoVisivel ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Sugestão</p>
              <button
                type="button"
                onClick={() => ir(sugestaoVisivel.href)}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-ink/5"
              >
                <p className="text-sm text-ice">
                  <span className="text-muted">Sugestão · </span>
                  Ir para {sugestaoVisivel.label}
                </p>
                <p className="text-xs text-muted">{sugestaoVisivel.motivoCurto}</p>
              </button>
            </>
          ) : null}

          {comandosFiltrados.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Comandos</p>
              {comandosFiltrados.map((comando) => (
                <button
                  key={comando.id}
                  type="button"
                  onClick={() => ir(comando.href)}
                  className="flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left hover:bg-ink/5"
                >
                  <span>
                    <span className="text-sm text-ice">{comando.rotulo}</span>
                    {comando.descricao ? <span className="ml-2 text-xs text-muted">{comando.descricao}</span> : null}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{comando.grupo}</span>
                </button>
              ))}
            </>
          ) : null}

          {!comandoNatural && !buscaVisivel?.fichas.length && !buscaVisivel?.prazos.length && !buscaVisivel?.sugestao && !isPending && comandosFiltrados.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted">
              Nada encontrado. Para pesquisas complexas, use o Chat IA.
            </p>
          ) : null}
        </div>

        <div className="border-t border-ink/10 px-4 py-2 text-[10px] text-muted">
          CTRL+K abre · ENTER vai ao primeiro resultado · ESC fecha
        </div>
      </div>
    </div>
  );
}
