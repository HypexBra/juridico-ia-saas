"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

export type Tema = "light" | "dark";

type Listener = () => void;

// Pub-sub mínimo em nível de módulo: permite que múltiplas instâncias do
// toggle (ex: se um dia landing e app renderizassem juntos, ou 2 toggles na
// mesma tela) fiquem sincronizadas entre si via `useSyncExternalStore` — sem
// isso, `alternarTema` de uma instância não re-renderizaria as outras.
const listeners = new Set<Listener>();

function notificarMudanca() {
  for (const listener of listeners) listener();
}

function inscrever(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fonte da verdade é o DOM (a classe `.dark` já aplicada pelo <ThemeScript>
// antes do paint), nunca um useState duplicado — `useSyncExternalStore` é o
// hook do próprio React para ler estado externo mutável durante a
// renderização sem cair na regra "no setState síncrono dentro de effect"
// (ver `react-hooks/set-state-in-effect`) e sem introduzir flash/mismatch:
// `getServerSnapshot` retorna sempre "light" (mesmo default do HTML vindo
// do servidor); no client, a 1ª leitura já pega o valor real do DOM.
function lerTemaDoDom(): Tema {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function lerTemaNoServidor(): Tema {
  return "light";
}

/** Hook client-side para ler/alternar o tema aplicado pelo `<ThemeScript>`. */
export function useTheme() {
  const tema = useSyncExternalStore(inscrever, lerTemaDoDom, lerTemaNoServidor);

  const alternarTema = useCallback(() => {
    const proximo: Tema = lerTemaDoDom() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", proximo === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, proximo);
    } catch {
      // localStorage indisponível (modo privado/quota): tema ainda muda
      // nesta sessão, só não persiste entre visitas — falha silenciosa
      // aceitável aqui, não é uma operação de negócio.
    }
    notificarMudanca();
  }, []);

  return { tema, alternarTema };
}
