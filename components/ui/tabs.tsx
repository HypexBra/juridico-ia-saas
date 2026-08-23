"use client";

import { useState, type ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  /** Contador opcional exibido ao lado do rótulo (ex: nº de pessoas/tarefas). `undefined`/0 não renderiza nada. */
  contador?: number;
  content: ReactNode;
};

/**
 * Navegação por abas, sem dependência externa (Radix/headless-ui não estão
 * instalados no projeto). Todo o conteúdo de cada aba já chega pronto via
 * `content` (renderizado no Server Component pai, incluindo Client
 * Components filhos quando precisam de interatividade) — este componente só
 * decide qual aba fica visível, sem refazer nenhum fetch ao trocar de aba.
 */
export function Tabs({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const primeiraAba = items[0]?.id ?? "";
  const [abaAtiva, setAbaAtiva] = useState(defaultTabId ?? primeiraAba);
  const ativa = items.some((item) => item.id === abaAtiva) ? abaAtiva : primeiraAba;

  return (
    <div>
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-ink/10">
        {items.map((item) => {
          const selecionada = item.id === ativa;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selecionada}
              onClick={() => setAbaAtiva(item.id)}
              className={`relative -mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selecionada
                  ? "border-silver text-ice"
                  : "border-transparent text-muted hover:text-ice-2"
              }`}
            >
              {item.label}
              {Boolean(item.contador) && (
                <span className="ml-1.5 rounded-full bg-ink/10 px-1.5 py-0.5 text-[11px] text-muted">
                  {item.contador}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div key={item.id} role="tabpanel" hidden={item.id !== ativa}>
          {item.id === ativa ? item.content : null}
        </div>
      ))}
    </div>
  );
}
